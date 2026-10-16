# Udgivelse og opdateringer

Bing Ads Chat er sat op som Inventarland: appen opdaterer sig selv med signerede opdateringer
fra Cloudflare, så ingen skal hente en ny exe-fil efter den første installation.

| Del | Adresse |
| --- | --- |
| Download-side | https://bing-ads-chat.casperjohansen.workers.dev (findes automatisk ud fra API-tokenet – står også i Actions-loggen under **Find the Cloudflare address**) |
| Opdateringsfeed (signeret) | https://bing-ads-chat.casperjohansen.workers.dev/updates/latest.json |
| Kildekode + byggeri | https://github.com/imnotcap/bing-ads-chat (GitHub Actions bygger Windows) |

* Cloudflare: **din egen konto** (Workers Free – ikke Inventarlands) · Worker `bing-ads-chat`: statiske filer + `/api/teams`
  til delte planlægningstavler (`cloudflare/src/worker.ts`, én Durable Object med SQLite pr. team – med i Free-planen).
  Et team åbnes med sin invitationskode; kun en hash af koden gemmes. Lokal test: `npx wrangler@4 dev --config cloudflare/wrangler.jsonc`
  og `VITE_SITE_URL=http://localhost:8787 pnpm dev`.
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

### Login med Microsoft (konti i appen)

Man logger ind i appen med sin Microsoft-konto. Det giver en konto i afdelingens fælles arbejdsområde på
Cloudflare og lader appen lægge påmindelser i ens egen Outlook-kalender – intet andet. Den første, der logger
ind, bliver administrator. Kolleger med en `inventarland.dk`-adresse kommer ind med det samme (`ALLOWED_DOMAINS`
i `cloudflare/wrangler.jsonc`); andre skal godkendes under **Indstillinger → Brugere**.

Forbindelserne (Microsoft Advertising, Claude- og Gemini-nøglerne) og planlægningstavlerne gemmes fælles på
Cloudflare. De forbindes én gang inde i appen under **Indstillinger → Forbindelser**, og alle kan ændre dem.

| Secret | Indhold |
| --- | --- |
| `MS_CLIENT_ID` | **Påkrævet til login.** *Application (client) ID* fra en app-registrering: https://entra.microsoft.com → **Applikationer → App-registreringer → Ny registrering** · navn "Bing Ads Chat" · kontotyper: *Accounts in any organizational directory and personal Microsoft accounts* · Registrér. Under **Godkendelse**: *Tilføj en platform → Mobil- og skrivebordsprogrammer* → brugerdefineret omdirigerings-URI `http://localhost` → Konfigurer, og slå **Tillad offentlige klientflows** til → Gem. Under **API-tilladelser**: *Tilføj en tilladelse → Microsoft Graph → Delegerede tilladelser* → `Calendars.ReadWrite` (og `openid`, `profile`, `email`, `offline_access`). Kopiér *Application (client) ID* fra Oversigt. Det bygges ind i appen og gives til Cloudflare-workeren, som kun godtager logins fra netop denne app-registrering |
| `MS_DEVELOPER_TOKEN` | Valgfrit. Dit developer token: log ind på https://ads.microsoft.com (Super Admin) → **Indstillinger → Developer settings** → vælg din bruger → **Request Developer Token**. Udfyldes ellers i appen, når Microsoft Advertising forbindes |

Inventarland-data (webshoppens salg og de andre annoncekanaler) forbindes også inde i appen under
**Indstillinger → Forbindelser → Inventarland** med en Inventarland-bruger med rollen *Læser* – se README.

Uden `MS_CLIENT_ID` stopper udgivelsen med en fejl, så ingen bliver låst ude af en ny version.

Client ID og developer token ligger i den app, man henter, så alle med installeren kan læse dem. De giver ikke
adgang til noget alene: man skal stadig logge ind med en Microsoft-bruger.

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
