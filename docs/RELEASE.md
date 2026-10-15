# Udgivelse og opdateringer

Bing Ads Chat er sat op som Inventarland: appen opdaterer sig selv med signerede opdateringer
fra Cloudflare, så ingen skal hente en ny exe-fil efter den første installation.

| Del | Adresse |
| --- | --- |
| Download-side | https://bing-ads-chat.casperjohansen.workers.dev (findes automatisk ud fra API-tokenet – står også i Actions-loggen under **Find the Cloudflare address**) |
| Opdateringsfeed (signeret) | https://bing-ads-chat.casperjohansen.workers.dev/updates/latest.json |
| Kildekode + byggeri | https://github.com/imnotcap/bing-ads-chat (GitHub Actions bygger Windows) |

* Cloudflare: **din egen konto** (Workers Free – ikke Inventarlands) · Worker `bing-ads-chat` (kun statiske filer, ingen database).
* Kontoen og dens workers.dev-adresse findes automatisk ud fra API-tokenet (`scripts/resolve-site.mjs`)
  og bages ind i appen ved hvert build. Har kontoen ingen workers.dev-adresse endnu, oprettes en.
* Appen tjekker for opdateringer 3 sek. efter start, hver halve time og når du vender tilbage til den.
  En ny version vises som "Bing Ads Chat X er klar" med knappen **Opdatér nu** (også i topbaren og under
  **Indstillinger → Om appen**). Appen henter, kontrollerer signaturen, installerer og genstarter selv.

## Sådan udgives en ny version

Helt automatisk: hver ændring, der pushes til hovedgrenen på GitHub, bygges, signeres og udgives
til Cloudflare (ca. 8 min). Versionsnummeret er `0.2.<byggenummer>`, så hver udgivelse er nyere end
den forrige. Nyhederne i opdaterings-vinduet er commit-beskeden. Følg med på
https://github.com/imnotcap/bing-ads-chat/actions.

Større spring (fx 0.3.x eller 1.0.x): ret `version` i `src-tauri/tauri.conf.json` (kun første to tal bruges).

## Engangsopsætning: to GitHub-secrets

GitHub → repoet **bing-ads-chat** → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Indhold |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Hele indholdet af Bing Ads Chats egen signeringsnøgle `updater.key` (uden adgangskode – den offentlige del står i `src-tauri/tauri.release.conf.json`). Gem filen i din password manager |
| `CLOUDFLARE_API_TOKEN` | API-token til **din nye Cloudflare-konto**: log ind på dash.cloudflare.com → My Profile → API Tokens → Create Token → skabelonen **Edit Cloudflare Workers** → vælg din konto under *Account Resources* → Continue → Create Token, og kopiér tokenet |

### Valgfrit: "Log ind med Microsoft" med ét klik

Tilføj også disse to secrets, så appen har Microsoft Advertising-adgangen indbygget. Så skal man kun klikke
**Log ind med Microsoft** og logge ind med sin Microsoft-konto. Uden dem spørger appen om dem første gang.

| Secret | Indhold |
| --- | --- |
| `MS_DEVELOPER_TOKEN` | Dit developer token: log ind på https://ads.microsoft.com (Super Admin) → **Indstillinger → Developer settings** → vælg din bruger → **Request Developer Token** → kopiér det |
| `MS_CLIENT_ID` | *Application (client) ID* fra en app-registrering: https://entra.microsoft.com → **Applikationer → App-registreringer → Ny registrering** · navn "Bing Ads Chat" · kontotyper: *Accounts in any organizational directory and personal Microsoft accounts* · Registrér. Under **Godkendelse**: *Tilføj en platform → Mobil- og skrivebordsprogrammer* → brugerdefineret omdirigerings-URI `http://localhost` → Konfigurer, og slå **Tillad offentlige klientflows** til → Gem. Kopiér *Application (client) ID* fra Oversigt |

Developer token og client ID ligger i den app, man henter, så alle med installeren kan læse dem. De giver ikke
adgang til nogen konto alene: man skal stadig logge ind med en Microsoft-bruger, der har adgang til kontoen.

Kør derefter workflowet igen (Actions → Build Windows app → **Run workflow**) eller push en ændring.
Uden secrets bygger GitHub stadig exe-filerne (artefakt + "Seneste build"), men uden automatiske opdateringer.

## Første gang

Versioner fra før Cloudflare-opsætningen kan ikke opdatere sig selv. Installér én gang fra
download-siden (installeres ovenpå – samtaler, indstillinger og nøgler bevares). Derefter kommer
alle nye versioner automatisk i appen.

## Kendte begrænsninger

* **Ikke kodesigneret:** Windows viser "Windows beskyttede din pc" ved første installation
  (Flere oplysninger → Kør alligevel). Opdateringer inde i appen er signeret med updater-nøglen.
* **Signeringsnøglen:** Bing Ads Chat har sin egen `updater.key` (ikke Inventarlands). Mistes den, kan
  installerede apps ikke længere opdatere sig selv (alle skal installere én gang manuelt med en ny nøgle).
  Tag backup, og del den aldrig.
* Download-siden er offentlig (installeren indeholder ingen nøgler – de gemmes i Windows Credential Manager).
  Vil du begrænse den, kan Cloudflare Access sættes på Workeren, men så kan appen ikke hente opdateringer.
