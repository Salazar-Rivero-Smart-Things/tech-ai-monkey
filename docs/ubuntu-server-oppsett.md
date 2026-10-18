# Tech AI monkey på egen Ubuntu-server

Komplett oppsett av en fysisk server som kjører **agenten, nettsiden og
lagringen** — uten TrueNAS, uten VM, uten skyleverandør.

Målgruppe: deg som har (eller skal kjøpe) maskinen og vil gjøre alt selv.
Regn med **2–4 timer** første gang, hvorav mesteparten er installasjon og
ZFS-oppretting.

---

## Innhold

1. [Når passer dette oppsettet](#1-når-passer-dette-oppsettet)
2. [Hardware-sjekkliste](#2-hardware-sjekkliste)
3. [Installer Ubuntu Server 26.04 LTS](#3-installer-ubuntu-server-2604-lts)
4. [Ubuntu Pro](#4-ubuntu-pro)
5. [Nettverk og brannmur](#5-nettverk-og-brannmur)
6. [ZFS og RAIDZ2](#6-zfs-og-raidz2)
7. [Cockpit – web-UI fra mobilen](#7-cockpit--web-ui-fra-mobilen)
8. [Fildeling (Samba / NFS)](#8-fildeling-samba--nfs)
9. [Kjøretidsmiljø](#9-kjøretidsmiljø)
10. [Installer Tech AI monkey](#10-installer-tech-ai-monkey)
11. [Cloudflare Tunnel og DNS](#11-cloudflare-tunnel-og-dns)
12. [Video-verktøyet (FFmpeg)](#12-video-verktøyet-ffmpeg)
13. [Backup](#13-backup)
14. [Drift og vedlikehold](#14-drift-og-vedlikehold)
15. [Flytte fra gammel maskin](#15-flytte-fra-gammel-maskin)
16. [Feilsøking](#16-feilsøking)
17. [Sjekkliste](#17-sjekkliste)

---

## 1. Når passer dette oppsettet

| Du vil … | Velg |
| --- | --- |
| Kjøre AI-agenten native med Microsandbox (KVM) | **Dette dokumentet** |
| Ha en polert NAS med GUI først og fremst | TrueNAS SCALE |
| Begge deler, men enklest mulig drift | Ubuntu + ZFS + Cockpit (dette dokumentet) |

Repoet krever Linux x86-64, `/dev/kvm`, Node ≥ 24, PostgreSQL, `ffmpeg` og
`systemd`. Alt det får du rett ut av boksen på Ubuntu Server.

---

## 2. Hardware-sjekkliste

### CPU – må være x86-64-v2

Ubuntu 24.04 og nyere krever **SSE4.2 + POPCNT**. Sjekk før du kjøper:

```bash
# Etter at Ubuntu er installert:
/lib64/ld-linux-x86-64.so.2 --help | grep x86-64
#   x86-64-v4 (supported, searched)
#   x86-64-v3 (supported, searched)
#   x86-64-v2 (supported, searched)   <- denne MÅ stå
```

- ✅ Xeon E5 v1/v2/v3/v4, Core i 4. gen og nyere
- ❌ Xeon 5500/5600 (Nehalem/Westmere) og eldre DDR3-plattformer

### Resten

| Del | Krav | Merk |
| --- | --- | --- |
| HBA til SAS-diskene | LSI/Broadcom 9300-8i eller 9207-8i, **IT-modus** | Ikke hardware-RAID – ZFS skal se diskene direkte |
| Kabinett | **6 × 3,5"** brønner | ASUS AP201 har ikke plass til seks disker |
| RAM | Helst ECC | DDR3 ECC RDIMM er billig på Xeon E5-plattformer |
| Boot-disk | 128 GB SSD | To i speil er bedre |
| Strøm | 550–650 W | Seks disker spinner opp samtidig – sjekk staggered spin-up i HBA |
| Kjøling | Luftstrøm over diskene | 14 TB-disker blir varme i små kabinett |

### RAID-nivå

Med 6 × 14 TB: bruk **RAIDZ2** (to disker kan feile), ikke RAIDZ1. Resilver av
en 14 TB-disk tar dager, og RAIDZ1 tåler ikke en feil til i det vinduet.

```
6 × 14 TB RAIDZ2  →  ca. 56 TB brukbart
```

---

## 3. Installer Ubuntu Server 26.04 LTS

1. Last ned **Ubuntu Server 26.04 LTS** (ikke Desktop) fra
   <https://ubuntu.com/download/server>.
2. Skriv til USB:
   ```bash
   sudo dd if=ubuntu-26.04-live-server-amd64.iso of=/dev/sdX bs=4M status=progress oflag=sync
   ```
   (`/dev/sdX` er **pinnen**, ikke systemdisken – sjekk med `lsblk`.)
3. Under installasjonen:
   - **Hostname:** `tech-ai` (eller det du vil)
   - **Bruker:** f.eks. `ai` (ikke `root`)
   - **Installer OpenSSH server:** ✅
   - **Disk:** hele 128 GB SSD-en, ext4, **ikke** LVM hvis du vil ha det enkelt
   - **Snaps:** ingen
4. Etter første oppstart:
   ```bash
   sudo apt update && sudo apt full-upgrade -y
   sudo timedatectl set-timezone Europe/Oslo
   sudo reboot
   ```

> Ikke installer ZFS på rot-disken. Root = ext4, all data på ZFS-poolen.

---

## 4. Ubuntu Pro

Gratis for privat bruk inntil 5 maskiner. Gir sikkerhetsoppdateringer i 10 år
og kjerneoppdatering uten nedetid.

```bash
# Hent token på https://ubuntu.com/pro/dashboard
sudo pro attach <TOKEN>

sudo pro status
#   esm-infra    enabled
#   esm-apps     enabled
#   livepatch    enabled

# Hvis livepatch ikke er på:
sudo pro enable livepatch
```

Automatiske sikkerhetsoppdateringer:

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades   # velg Yes
```

---

## 5. Nettverk og brannmur

### Statisk IP (anbefalt)

```bash
ip -br a                       # finn interfacet, f.eks. enp1s0
sudo nano /etc/netplan/50-static.yaml
```

```yaml
network:
  version: 2
  ethernets:
    enp1s0:
      dhcp4: false
      addresses: [192.168.1.50/24]
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```

```bash
sudo chmod 600 /etc/netplan/50-static.yaml
sudo netplan apply
```

### Brannmur

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                    # SSH
sudo ufw allow from 192.168.1.0/24 to any port 9090 proto tcp   # Cockpit, kun LAN
sudo ufw enable
sudo ufw status verbose
```

**Ikke** åpne 2000 eller 3000 mot internett. De nås via Cloudflare Tunnel
(seksjon 11) eller SSH-tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 ai@192.168.1.50
```

---

## 6. ZFS og RAIDZ2

```bash
sudo apt install -y zfsutils-linux smartmontools
```

### Finn diskene

```bash
lsblk -o NAME,SIZE,MODEL,SERIAL,TRAN
ls -l /dev/disk/by-id/ | grep -E 'ata-|wwn-'
```

Bruk **`/dev/disk/by-id/…`** – ikke `/dev/sdX`. Ellers bytter diskene navn
etter en omstart, og poolen starter ikke.

### Opprett poolen

```bash
sudo zpool create -o ashift=12 -O compression=lz4 -O atime=off \
  tank raidz2 \
  /dev/disk/by-id/ata-DISK1 \
  /dev/disk/by-id/ata-DISK2 \
  /dev/disk/by-id/ata-DISK3 \
  /dev/disk/by-id/ata-DISK4 \
  /dev/disk/by-id/ata-DISK5 \
  /dev/disk/by-id/ata-DISK6

sudo zpool status
sudo zfs list
```

### Datasett

```bash
sudo zfs create tank/data       # generell lagring
sudo zfs create tank/backup     # backup/arkiv
sudo zfs create tank/vms        # hvis du senere vil ha VM-er

sudo zfs set quota=40T tank/data        # valgfritt
sudo zfs set recordsize=1M tank/data    # store filer (video, backup)
```

### Scrub og SMART

```bash
sudo zpool scrub tank
systemctl list-timers 'zfs*'            # innebygd månedlig scrub
sudo systemctl enable --now smartd
sudo smartctl -a /dev/sda | head -30    # helse per disk
```

### Snapshot som kan rulleres

```bash
sudo zfs snapshot tank/data@$(date +%F)
sudo zfs list -t snapshot
# automatisk: sanoid (seksjon 13)
```

### Bytte en disk

```bash
sudo zpool status -v                     # finn navnet på disken
sudo zpool offline tank ata-DISK3
# fysisk bytte, finn ny id:
ls -l /dev/disk/by-id/ | grep ata-
sudo zpool replace tank ata-DISK3 /dev/disk/by-id/ata-NY-DISK
sudo zpool status -v                     # følg resilver
```

---

## 7. Cockpit – web-UI fra mobilen

Cockpit gir deg disker, SMART, tjenester, terminal, nettverk og oppdateringer
i nettleseren. Fungerer fint fra telefon.

```bash
sudo apt install -y cockpit cockpit-storaged cockpit-networkmanager cockpit-packagekit
sudo systemctl enable --now cockpit.socket
```

Åpne `https://192.168.1.50:9090` og logg inn med Linux-brukeren din.
Sertifikatet er selvsignert første gang – godkjenn det.

Valgfritt (tredjeparts repo, ZFS-visning i UI):

```bash
curl -sSL https://repo.45drives.com/setup | sudo bash
sudo apt install -y cockpit-navigator
```

> Cockpit er administrasjonsflaten. Selve appen (agent + web) kjører som
> systemd-tjenester, ikke som Cockpit-apper.

---

## 8. Fildeling (Samba / NFS)

### Samba (Windows/macOS)

```bash
sudo apt install -y samba
sudo mkdir -p /tank/data/share
sudo chown -R ai:ai /tank/data/share

sudo nano /etc/samba/smb.conf
```

```ini
[share]
   path = /tank/data/share
   browseable = yes
   read only = no
   valid users = ai
   create mask = 0664
   directory mask = 0775
```

```bash
sudo smbpasswd -a ai
sudo systemctl restart smbd
```

### NFS (Linux)

```bash
sudo apt install -y nfs-kernel-server
sudo mkdir -p /tank/data/nfs
echo '/tank/data/nfs 192.168.1.0/24(rw,sync,no_subtree_check)' | sudo tee -a /etc/exports
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
```

---

## 9. Kjøretidsmiljø

```bash
sudo apt install -y git curl build-essential ffmpeg postgresql postgresql-contrib
sudo systemctl enable --now postgresql

ffmpeg -version | head -1
psql --version
```

### Node 24 med nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm alias default 24
node --version      # v24.x
```

> Repoet har `.nvmrc` med `24`. Kjør `nvm use` i prosjektmappen hvis du er i tvil.

### KVM / Microsandbox

```bash
ls -l /dev/kvm
# hvis "No such file": slå på VT-x/VT-d i BIOS

sudo usermod -aG kvm ai
# logg ut og inn igjen, eller: newgrp kvm

npx microsandbox run --cpus 1 --memory 1024 \
  ghcr.io/vercel/eve:latest -- bash -lc 'echo kvm-ok'
```

---

## 10. Installer Tech AI monkey

### Hent koden

```bash
cd ~
git clone https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey.git
cd tech-ai-monkey
nvm use
```

### Hemmeligheter

```bash
cp .env.example .env
cp web/.env.example web/.env.local
chmod 600 .env web/.env.local
nano .env
nano web/.env.local
```

Må fylles ut i **`.env`**:

| Variabel | Verdi |
| --- | --- |
| `AGENT_API_KEY_SECRET` | `openssl rand -hex 32` |
| `OPENAI_COMPAT_BASE_URL` / `_MODEL` / `_API_KEY` | modellleverandøren din |
| `DEEPSEEK_API_KEY` | valgfri failover |
| `EVE_PUBLIC_URL` | `http://127.0.0.1:2000` |

I **`web/.env.local`**:

| Variabel | Verdi |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `SECRET_KEK` | `openssl rand -base64 32` |
| `AGENT_API_KEY_SECRET` | **nøyaktig samme** som i `.env` |
| `NEXT_PUBLIC_APP_URL` | `https://tech-ai.tech` |
| `EVE_AGENT_URL` | `http://127.0.0.1:2000` |
| `DATABASE_URL` | skrives automatisk av `deploy/setup-db.sh` |

### Database

```bash
bash deploy/setup-db.sh
# lager rolle + database, skriver DATABASE_URL i web/.env.local,
# og oppretter tabellene med drizzle-kit
```

### Bygg

```bash
npm install
npm run build            # bygger agenten og patcher eve (postbuild)

cd web
npm install
npm run build
cd ..
```

### Tjenestene

`deploy/install-services.sh` fyller selv inn bruker, gruppe, repo-sti og
Node-sti i `myai-agent.service` og `myai-web.service`. Den kjører som den som
eier repoet (via `SUDO_USER`), ikke som root.

Vil du overstyre noe:

```bash
sudo AI_SERVICE_USER=ai AI_NODE_BIN=/home/ai/.nvm/versions/node/v24.21.0/bin/node \
  bash deploy/install-services.sh
```

### Start

```bash
# se hva som skrives, uten å endre noe:
bash deploy/install-services.sh --dry-run

sudo bash deploy/install-services.sh
systemctl status myai-agent myai-web --no-pager
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:2000/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/download
```

Begge skal svare `200`.

---

## 11. Cloudflare Tunnel og DNS

```bash
# 1) cloudflared
curl -L -o /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb

# 2) logg inn (åpner nettleser – gjør det fra laptop via SSH-videreføring,
#    eller kopier URL-en til mobilen)
cloudflared tunnel login

# 3) opprett/gjenbruk tunnel for tech-ai.tech -> localhost:3000
bash deploy/setup-cloudflare-tunnel.sh

# 4) kjør som tjeneste
sudo systemctl enable --now cloudflared
systemctl status cloudflared --no-pager
```

Test:

```bash
curl -s -o /dev/null -w 'local  %{http_code}\n' http://127.0.0.1:3000/
curl -s -o /dev/null -w 'public %{http_code}\n' https://tech-ai.tech/
```

> Tunnelen trenger ingen åpne porter i ruteren. 2000 og 3000 forblir lukket
> mot internett.

---

## 12. Video-verktøyet (FFmpeg)

Agenten kan se på skjermopptak og videoer. Det krever:

```bash
sudo apt install -y ffmpeg
ffmpeg -version | head -1
ffprobe -version | head -1
```

Legg videoer i repoets `videos/`-mappe (git-ignorert), eller pek et annet sted:

```bash
# .env
EVE_VIDEOS_DIR=/tank/data/videos

# valgfritt: egen bildemodell (ellers gjenbrukes OPENAI_COMPAT_*)
VIDEO_VISION_BASE_URL=https://api.groq.com/openai/v1
VIDEO_VISION_MODEL=qwen/qwen3.8-27b
VIDEO_VISION_API_KEY=gsk_...
VIDEO_VISION_MAX_TOKENS=900
```

Test fra chatten: *«Hva viser videoen demo.mp4?»* – agenten skal kalle
`list_videos` og `analyze_video`.

---

## 13. Backup

### Database (innebygd)

```bash
sudo bash deploy/install-backup.sh
systemctl list-timers myai-backup.timer
sudo systemctl start myai-backup.service      # kjør nå
```

Backupen havner i `~/backups/tech-ai-monkey/`. Pek den til ZFS-poolen:

```bash
# deploy/backup.env  (kopier fra backup.env.example)
BACKUP_DIR=/tank/backup/db
```

### ZFS-snapshots med sanoid

```bash
sudo apt install -y sanoid
sudo nano /etc/sanoid/sanoid.conf
```

```ini
[tank/data]
    use_template = production
    recursive = yes

[template_production]
    frequently = 0
    hourly = 36
    daily = 30
    monthly = 3
    autosnap = yes
    autoprune = yes
```

```bash
sudo systemctl enable --now sanoid.timer
sudo sanoid --monitor-snapshots
```

### Replikering til ekstern disk

```bash
sudo zfs snapshot tank/data@offsite-$(date +%F)
sudo zfs send -R tank/data@offsite-$(date +%F) | sudo zfs recv backup/data
```

**3-2-1:** data på `tank`, snapshot på samme maskin, og en kopi på en disk som
ligger et annet sted. ZFS beskytter mot diskfeil – ikke mot sletting,
ransomware eller brann.

---

### Opprydding av sandkasser (viktig)

Hver chat starter en Microsandbox-VM som blir stående (`EVE_PERSIST_SANDBOX=1`).
Uten opprydding hoper de seg opp, RAM og swap blir fulle, og «opening sandbox
session» henger til slutt. Hold maks 3 kjørende:

```bash
node scripts/prune-sandboxes.mjs                       # manuelt
MAX_RUNNING_SANDBOXES=2 node scripts/prune-sandboxes.mjs
DRY_RUN=1 node scripts/prune-sandboxes.mjs             # vis hva som ville skjedd
```

Legg den i cron hvert 10. minutt (ingen sudo):

```cron
*/10 * * * * cd /home/ai/tech-ai-monkey && MAX_RUNNING_SANDBOXES=3 \
  /home/ai/.nvm/versions/node/v24.21.0/bin/node scripts/prune-sandboxes.mjs \
  >> /home/ai/.cache/tech-ai-prune.log 2>&1
```

Skriptet rører bare `eve-sbx-ses-*`; test-VM-er og annet står urørt.

---

## 14. Drift og vedlikehold

```bash
# helse
zpool status -v
zfs list -o name,used,avail,compressratio
sudo smartctl -H /dev/sda

# tjenester
systemctl status myai-agent myai-web cloudflared --no-pager
journalctl -u myai-agent -f
journalctl -u myai-web -n 100 --no-pager

# oppdateringer
sudo apt update && sudo apt full-upgrade -y
pro status
sudo pro fix <USN>              # målrettet sikkerhetsfiks

# oppdatere appen
cd ~/tech-ai-monkey
git pull
npm install && npm run build
cd web && npm install && npm run build && cd ..
sudo systemctl restart myai-agent myai-web

# appens egen test
bash scripts/preflight.sh
```

Anbefalt cron (systemd-timer eller `crontab -e`):

```cron
# ukentlig scrub
0 3 * * 0   /sbin/zpool scrub tank
# daglig helsesjekk til logg
0 6 * * *   /sbin/zpool status -x >> /var/log/zpool-health.log
```

---

## 15. Flytte fra gammel maskin

```bash
# 1) Stopp tjenestene på den gamle maskinen
sudo systemctl stop myai-agent myai-web

# 2) Kopier repo + hemmeligheter + brukerdata
rsync -av --exclude node_modules --exclude .next --exclude .output \
  --exclude .eve --exclude .build \
  ai@gammel-maskin:~/tech-ai-monkey/ ~/tech-ai-monkey/

# 3) Database
pg_dump -Fc "$(grep '^DATABASE_URL=' web/.env.local | cut -d= -f2-)" \
  > /tmp/tech-ai.dump
scp /tmp/tech-ai.dump ai@ny-maskin:/tmp/
# på den nye maskinen:
pg_restore --clean --if-exists -d "$DATABASE_URL" /tmp/tech-ai.dump

# 4) Innhold som ikke ligger i git
#    skills/users/  .agent-memory/  books/  videos/  web/public/downloads/
```

Husk å kopiere `.env` og `web/.env.local` separat (de er git-ignorerte), og at
`AGENT_API_KEY_SECRET` må være lik i begge.

Etter flyttingen: `bash scripts/preflight.sh` og en runde i chatten.

---

## 16. Feilsøking

| Symptom | Årsak / løsning |
| --- | --- |
| `/dev/kvm` finnes ikke | VT-x/VT-d av i BIOS, eller CPU uten støtte |
| `permission denied` på `/dev/kvm` | `sudo usermod -aG kvm $USER`, logg inn på nytt |
| `EADDRINUSE :2000` | Gammel prosess: `ss -ltnp \| grep 2000`, drep PID-en |
| `myai-web` svarer 502 via Cloudflare | Web kjører ikke, eller tunnelen peker på feil port |
| `relation "user" does not exist` | `deploy/setup-db.sh` er ikke kjørt, eller feil `DATABASE_URL` |
| `password authentication failed` | `DATABASE_URL` stemmer ikke med rollen i Postgres |
| Agenten svarer ikke | `journalctl -u myai-agent -n 80`; sjekk modellnøkkel og `OPENAI_COMPAT_*` |
| `Cannot find module` etter `git pull` | `npm install` i rot **og** i `web/` |
| ZFS-pool starter ikke etter omstart | Disker er referert som `/dev/sdX`; bytt til `/dev/disk/by-id/…` |
| Pool `DEGRADED` | `zpool status -v`, bytt disk som vist i seksjon 6 |
| Video-verktøyet svarer «FFmpeg mangler» | `sudo apt install ffmpeg` |
| `429` fra bildemodellen | Senk `VIDEO_VISION_MAX_TOKENS` (standard 900) |

---

## 17. Sjekkliste

- [ ] CPU støtter x86-64-v2
- [ ] HBA i IT-modus, seks disker synlige i `lsblk`
- [ ] Ubuntu 26.04 LTS installert, oppdatert, `Europe/Oslo`
- [ ] `pro status` viser esm-infra, esm-apps, livepatch
- [ ] Statisk IP + `ufw` (kun 22 og 9090 fra LAN)
- [ ] `zpool status` = ONLINE, RAIDZ2
- [ ] Cockpit tilgjengelig på `:9090` fra mobil
- [ ] `ffmpeg`, Node 24, PostgreSQL installert
- [ ] `/dev/kvm` finnes, bruker i `kvm`-gruppen
- [ ] `.env` og `web/.env.local` fylt ut, `chmod 600`
- [ ] `deploy/setup-db.sh`, `npm run build` (rot + web)
- [ ] `myai-agent` og `myai-web` aktive, begge svarer 200 lokalt
- [ ] Cloudflare Tunnel aktiv, `https://tech-ai.tech` svarer 200
- [ ] `myai-backup.timer` og `sanoid.timer` aktive
- [ ] `bash scripts/preflight.sh` uten feil
- [ ] Video-test i chatten gir metadata + tidsstempler

---

## Se også

- [`deploy/`](../deploy) – tjenestefiler og hjelpeskript
- [`docs/backup-og-gjenoppretting.md`](backup-og-gjenoppretting.md)
- [`docs/casa-security-plan.md`](casa-security-plan.md)
- [`videos/README.md`](../videos/README.md) – video-verktøyet
- [`docs/macos-bygg-cli.txt`](macos-bygg-cli.txt) – signert macOS-CLI
