# Backup og gjenoppretting — Tech AI monkey

> Krav i CASA/ASVS 8.3 «Data backup» og ISO 27001 A.12.3: sikkerhetskopier skal tas
> **regelmessig**, **testes**, og gjenoppretting skal være **dokumentert og øvd**.

All kundedata ligger i den lokale PostgreSQL-databasen. Denne siden beskriver hvordan vi
sikkerhetskopierer den, hvordan vi gjenoppretter, og hvordan du **verifiserer at det virker**.

---

## 1. Hva sikkerhetskopieres

| Data | Metode | Hvor | Oppbevaring |
| --- | --- | --- | --- |
| Hele databasen (`tech_ai_monkey`) | `pg_dump` + `gzip`, nattlig | `~/backups/tech-ai-monkey/daily/` | 30 dager |
| Månedlig kopi (tas den 1. hver måned) | kopi av nattlig dump | `~/backups/tech-ai-monkey/monthly/` | 12 måneder |
| Hemmeligheter (`.env`, `.env.local`, `SSN_KEK`) | **ikke** i backup-scriptet | egen, sikker lagring | — |

> Ren kode ligger på GitHub. Backupene inneholder **persondata** og skal derfor aldri
> committes, deles eller legges i en skytjeneste uten DPA. De skrives med filrettighet
> `600` i en mappe med `700`.

**Sikkerhetskopiering lagrer ikke `.env`/`.env.local`.** Krypteringsnøkkelen (`SSN_KEK`)
må derfor oppbevares separat og sikkert — uten den kan fødselsnumre i en gjenopprettet
database ikke dekrypteres. Ta vare på den i en passordbehandler eller et lukket, sikkert
medium.

---

## 2. Ta en backup manuelt

```bash
bash deploy/backup-db.sh
```

Skriptet leser `DATABASE_URL` fra `web/.env.local`, dumper databasen og skriver:

```
~/backups/tech-ai-monkey/daily/tech_ai_monkey-2026-10-05_0330.sql.gz
```

Du kan peke backupen et annet sted (f.eks. NAS eller ekstern disk):

```bash
BACKUP_DIR=/mnt/nas/tech-ai-backups bash deploy/backup-db.sh
```

### Valgfri konfigurasjon

Kopier `deploy/backup.env.example` til `deploy/backup.env` (git-ignorert) og sett:

| Variabel | Standard | Betydning |
| --- | --- | --- |
| `BACKUP_DIR` | `~/backups/tech-ai-monkey` | hvor backupene lagres |
| `DAILY_KEEP_DAYS` | `30` | antall dager med daglige backuper |
| `MONTHLY_KEEP_MONTHS` | `12` | antall månedlige backuper |

---

## 3. Automatisk nattlig backup

```bash
bash deploy/install-backup.sh
```

Installerer `myai-backup.service` + `myai-backup.timer`, kjører **en backup med en gang**
for å verifisere, og aktiverer timeren (hver natt kl. 03:30, med tilfeldig forsinkelse for
å jevne ut last).

Sjekk at det kjører:

```bash
systemctl list-timers myai-backup.timer     # neste kjøring
journalctl -u myai-backup.service -n 50     # siste logg
sudo systemctl start myai-backup.service    # kjør nå
```

Den nattlige jobben er en **oneshot**-tjeneste: den kjører, logger og avslutter. Feiler den,
vises det i `journalctl` og i `systemctl status myai-backup.service`.

---

## 4. Gjenopprette

> ⚠️ Gjenoppretting **overskriver** tabellene i databasen. Skriptet tar derfor først en
> sikkerhetskopi av nåværende tilstand, slik at en feil kan reverseres.

```bash
# 1. Se hvilke backuper som finnes
ls -lh ~/backups/tech-ai-monkey/daily/

# 2. Gjenopprett (spør om bekreftelse)
bash deploy/restore-db.sh ~/backups/tech-ai-monkey/daily/tech_ai_monkey-2026-10-05_0330.sql.gz

# 3. Start web-appen på nytt
sudo systemctl restart myai-web
```

Uten bekreftelsesspørsmål (f.eks. i et script):

```bash
bash deploy/restore-db.sh <fil.sql.gz> --yes
```

Hva skriptet gjør:

1. Leser `DATABASE_URL` fra `web/.env.local`.
2. Tar en **fersk backup av nåværende database** (sikkerhetsnett).
3. Bekreftelse.
4. Pakker ut dumpen og kjører den inn i databasen i **én transaksjon** (`psql -1`), slik at
   en halvferdig gjenoppretting ikke blir liggende.

### Gjenoppretting fra bunnen av (ny maskin)

```bash
# 1. Klon koden
git clone https://github.com/HollmanRivero/Tech-ai-monkey.git
cd tech-ai-monkey

# 2. Gjenopprett hemmeligheter (.env, web/.env.local, SSN_KEK) fra sikker lagring

# 3. Opprett database og bruker
bash deploy/setup-db.sh

# 4. Importer backupen
bash deploy/restore-db.sh /sti/til/tech_ai_monkey-<dato>.sql.gz --yes

# 5. Bygg og start
npm install && npm run build
(cd web && npm install && npm run build)
bash deploy/install-services.sh
bash deploy/install-backup.sh
```

---

## 5. Test at backupen faktisk kan brukes

En backup er verdiløs til den er prøvd. Vi tester slik:

```bash
# 1. Lag en test-database (rører ikke produksjon)
sudo -u postgres createdb tech_ai_monkey_restoretest

# 2. Gjenopprett dumpen dit
gunzip -c ~/backups/tech-ai-monkey/daily/<fil>.sql.gz \
  | psql "postgresql://tech_ai_monkey@127.0.0.1/tech_ai_monkey_restoretest" -v ON_ERROR_STOP=1 -q

# 3. Sjekk at tabellene og radene er der
psql "postgresql://tech_ai_monkey@127.0.0.1/tech_ai_monkey_restoretest" -c '\dt'
psql "postgresql://tech_ai_monkey@127.0.0.1/tech_ai_monkey_restoretest" -c 'SELECT count(*) FROM "user";'

# 4. Rydd opp
sudo -u postgres dropdb tech_ai_monkey_restoretest
```

**Anbefalt rutine:** gjør dette **én gang i kvartalet**, og etter enhver endring i
database-skjemaet. Noter dato og resultat nedenfor.

| Dato | Utført av | Resultat |
| --- | --- | --- |
| | | |

---

## 6. Feilsøking

| Symptom | Årsak | Løsning |
| --- | --- | --- |
| `Fant ingen DATABASE_URL` | `web/.env.local` mangler eller har ikke linjen | kjør `bash deploy/setup-db.sh` |
| `Fant ikke pg_dump` | `postgresql-client` mangler | `sudo apt-get install -y postgresql-client` |
| `Backupen ble tom` | feil DB-tilgang | test `psql "$DATABASE_URL" -c '\dt'` |
| Timeren kjører ikke | timeren ikke aktivert | `sudo systemctl enable --now myai-backup.timer` |
| Disk full | for mange backuper | senk `DAILY_KEEP_DAYS`, flytt `BACKUP_DIR` til større disk |

---

## 7. Lenker

- Sikkerhetsplan: [`casa-security-plan.md`](casa-security-plan.md)
- Dataflyt: [`dataflyt.md`](dataflyt.md)
- Personvernerklæring (retensjon): <https://tech-ai.tech/privacy>
