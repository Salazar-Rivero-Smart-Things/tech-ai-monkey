# START HER — bygg macOS-versjonen på Mac'en

Denne pakken inneholder alt som trengs for å bygge, signere, notarisere og
stifte **tech-ai.tech monkey v2.0** for macOS. Du trenger ca. 20 minutter
første gang, pluss 2–15 minutter mens Apple behandler notariseringen.

---

## 0. Før du begynner

Du trenger:

| Ting | Hvordan |
| --- | --- |
| Apple Developer-konto med **Admin/Account Holder** | <https://developer.apple.com/account> |
| **Developer ID Application**-sertifikat | lages i Xcode, se steg 3 |
| Xcode Command Line Tools | `xcode-select --install` |
| Bun (kompilatoren) | `curl -fsSL https://bun.sh/install \| bash` |
| Et app-spesifikt passord til notarisering | <https://appleid.apple.com> → Sign-In and Security → App-Specific Passwords |

> **Viktig:** Et «Apple Development»-sertifikat kan **ikke** notariseres.
> Det MÅ være «Developer ID Application», og den private nøkkelen må ligge i
> nøkkelringen. Derfor gjøres dette på Mac'en, ikke på Linux.

---

## 1. Pakk ut

```bash
cd ~/Downloads
unzip tech-ai-monkey-macos.zip
cd tech-ai-monkey
```

## 2. Installer Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.zshrc          # eller åpne et nytt terminalvindu
bun --version
```

## 3. Lag Developer ID-sertifikatet

1. Åpne **Xcode** → **Settings** → **Accounts**.
2. Logg inn med Apple-ID-en som har developer-medlemskap.
3. Velg kontoen → **Manage Certificates…** → **+** → **Developer ID Application**.
4. Lukk vinduet. Sjekk i Terminal:

```bash
security find-identity -v -p codesigning
# skal vise: "Developer ID Application: Ditt Navn (TEAMID)"
```

> Sertifikatet havner i **Nøkkelringtilgang** sammen med den private nøkkelen.
> Det er denne kombinasjonen som signerer.

## 4. Lagre notariseringspålogging (én gang)

```bash
xcrun notarytool store-credentials "tech-ai-notary" \
  --apple-id "DIN-APPLE-ID@EPOST.NO" \
  --team-id "DIN-TEAM-ID" \
  --password "xxxx-xxxx-xxxx-xxxx"
```

`xxxx-xxxx-xxxx-xxxx` er det app-spesifikke passordet fra steg 0 — ikke
Apple-ID-passordet. Du blir spurt om Mac-passordet for å låse opp nøkkelringen.

## 5. Sjekk at alt er på plass

```bash
bash scripts/macos-release.sh --check
```

Alt skal være grønt. Mangler noe, sier skriptet nøyaktig hva som skal gjøres.

## 6. Bygg + signer + notariser + stift

```bash
bash scripts/macos-release.sh
```

Dette gjør hele kjeden:

1. kompilerer CLI-en for **både Apple Silicon og Intel** og slår dem sammen
   til én universal-binær,
2. signerer binæren med hardened runtime,
3. lager DMG med `hdiutil` og leser den tilbake for å bevise at binæren er
   byte-identisk,
4. signerer DMG-en,
5. sender den til Apple og venter på svar (`status: Accepted`),
6. stifter notariseringsbilletten fast (`stapler`) og kontrollerer med
   Gatekeeper (`spctl` → `accepted  source=Notarized Developer ID`),
7. oppdaterer `web/public/downloads/checksums.txt`.

Resultatet:

```
web/public/downloads/tech-ai_2.0.0_macos_universal.dmg
```

## 7. Kontroller selv

```bash
spctl -a -t open --context context:primary-signature -vv \
  web/public/downloads/tech-ai_2.0.0_macos_universal.dmg
# forventet: accepted  source=Notarized Developer ID

hdiutil attach web/public/downloads/tech-ai_2.0.0_macos_universal.dmg
ls -l "/Volumes/Tech AI monkey"
bash "/Volumes/Tech AI monkey/Installer tech-ai.command"
tech-ai --version        # tech-ai CLI 2.0.0
hdiutil detach "/Volumes/Tech AI monkey"
```

Nå åpner DMG-en uten advarsel på alle Mac'er.

## 8. Ta filen med tilbake

Kopier DMG-en (og `web/public/downloads/checksums.txt`) tilbake til
Linux-serveren, legg den i `web/public/downloads/`, og restart nettappen:

```bash
sudo systemctl restart myai-web
```

Eller last den opp som release-asset fra Mac'en:

```bash
gh release upload v2.0.0 \
  web/public/downloads/tech-ai_2.0.0_macos_universal.dmg --clobber
```

---

## Hvis noe feiler

| Symptom | Årsak / løsning |
| --- | --- |
| `--check` sier «fant ikke Developer ID Application» | Sertifikatet er ikke laget i Xcode (steg 3), eller du er logget inn med feil Apple-ID |
| `Invalid` fra Apple | Kjør `xcrun notarytool log <id> --keychain-profile tech-ai-notary` og les begrunnelsen |
| `spctl` sier `rejected` | Stiften feilet, eller DMG-en ble endret etter notariseringen — kjør skriptet på nytt |
| `bun: command not found` | `source ~/.zshrc`, eller `export PATH="$HOME/.bun/bin:$PATH"` |
| `hdiutil: create failed - File exists` | En gammel DMG ligger åpen: `hdiutil detach /Volumes/Tech*` |

---

## Vil du kjøre hele appen på Mac'en også?

`.env` og `web/.env.local` inneholder ekte hemmeligheter og følger **ikke**
med pakken. Se `docs/macos-oppsett.txt` for hvordan du setter opp agent +
web lokalt på Mac'en. For å bygge DMG-en er de ikke nødvendige.

## Om video-verktøyet

Agenten kan se på videoer (FFmpeg + bildemodell). På serveren kreves
`ffmpeg`/`ffprobe` (`apt install ffmpeg` på Linux, `brew install ffmpeg` på
Mac) og en bildemodell — se `videos/README.md` og `agent/lib/video.ts`.
