# Bing Ads Chat

En lokal **Windows-desktopapp**, hvor du styrer din **Microsoft Advertising (Bing Ads)**-konto ved at chatte med en
AI-assistent (Claude). Assistenten kan analysere, rapportere og ændre kontoen – men altid inden for de
**forbrugsregler**, du selv sætter, og med **godkendelse** og **fortryd** på ændringerne.

Bygget med samme teknologi som Inventarland-dashboardet: **Tauri 2** (native Windows-vindue) +
**React 19 / TypeScript / Tailwind 4**, animationer med **motion** og komponenter i **React Bits**-stil.
Designet er enkelt og lyst med fonten **Funnel Sans** (bundlet i appen, virker offline), en rolig lavendel-accent og
et sammenfoldeligt **indsigtsvindue** i højre side.

## Hent appen (Windows)

**Download-side på Cloudflare:** https://bing-ads-chat.casperjohansen.workers.dev → **Bing-Ads-Chat-Setup.exe**.

Du installerer kun én gang. Derefter **opdaterer appen sig selv**: når en ny version er udgivet, viser
appen "Bing Ads Chat X er klar" → **Opdatér nu**. Den henter den signerede opdatering fra Cloudflare,
installerer og genstarter. Samtaler, indstillinger og nøgler bevares. Det fungerer som i Inventarland,
men på din egen Cloudflare-konto: hver ændring på hovedgrenen bygges og udgives automatisk af GitHub
Actions. Engangsopsætning (to GitHub-secrets): se [docs/RELEASE.md](docs/RELEASE.md).

Appen er ikke kodesigneret, så Windows SmartScreen kan vise "Windows beskyttede din pc" ved første
installation → klik **Flere oplysninger → Kør alligevel**.

Hvert build ligger også som backup under
[Releases → "Seneste build"](https://github.com/imnotcap/bing-ads-chat/releases/tag/build-latest).

![Chat](docs/chat.png)

## Hvad kan den?

**Chatten** (hovedvisningen)
- Streamede svar med markdown, tabeller og en sammenklappelig "tankegang".
- Værktøjstrin vises som en tidslinje, der kan foldes ud (fx *Henter kampagner · 8 kampagner* med datatabel).
- Grafer, nøgletal og tabeller direkte i chatten (`show_chart`, `show_kpis`, `show_table`).
- Svar i et fast, skimbart format: fed konklusion, korte sektioner, punktlister og den vigtigste anbefaling fremhævet.
- **Forslag til næste skridt** efter hvert svar ("Skal jeg lave flere ændringer?") med det vigtigste forslag som
  knap i fuld bredde – efter nye kampagner altid *Titel-optimér de nye kampagner*.
- **Godkendelseskort** for ændringer: før → efter, begrundelse, hvilke forbrugsregler der gælder, Godkend/Afvis (med
  kommentar til assistenten) og **Fortryd** bagefter. Navne, søgeord og annoncetekster kan rettes direkte i kortet før
  godkendelse (med tegntæller), og nye navne kræver altid din godkendelse – også på autopilot.
- Slash-kommandoer (`/overblik`, `/spild`, `/budget`, `/fordeling`, `/annonce`, `/søgeord`, `/rapport`, `/forbrug`,
  `/ændringer`) og forslag på startskærmen.
- Chatfelt som i Claude: **+** til venstre, mikrofon (diktering) og lille send-knap til højre, og under feltet
  godkendelsestilstand (*Auto*), model + indsats og en ring med AI-forbruget – klik på den for et
  *Brug*-vindue med forbrug i dag og denne måned i forhold til dit loft.
- **Indstillinger som popup** med søgning og grupperet menu (Ctrl+,).
- **Vedhæft filer** med **+** (filer, billeder, mapper, udklipsholder), træk-og-slip eller Ctrl+V: billeder, PDF, CSV og
  tekstfiler sendes til Claude (fx skærmbilleder af rapporter eller CSV-eksporter fra Google Ads).
- Startskærm med en diskret, animeret **GradientASCII**-horisont og **Orb** (React Bits).
- **Topbaren er vinduets titellinje** (som i Claude desktop – Windows' egen er skjult): træk for at flytte,
  dobbeltklik for at maksimere, menu, skjul/vis sidebar (Ctrl+B), tilbage/frem (Alt+←/→), samtaletitel med
  menu (omdøb/slet) og vinduesknapper. Til højre: indsigt (Ctrl+I), eksportér samtalen som Markdown
  (gemmes i *Overførsler › Bing Ads Chat*), filer i samtalen, del/kopiér og flere handlinger.
  Sidebaren kan foldes helt væk.
- Samtalehistorik med søgning, omdøb og slet. Genveje: `Ctrl+N` ny samtale, `Ctrl+K` fokus på chatfeltet, `Ctrl+B` sidebar, `Ctrl+I` indsigt, `Ctrl+,` indstillinger, `Alt+←/→` tilbage/frem.

**Assistentens værktøjer (Microsoft Advertising API v13)**

| Læse | Ændre |
| --- | --- |
| Konti, kampagner, annoncegrupper, søgeord, annoncer, negative søgeord | Kampagner: status, dagsbudget, navn, budstrategi (Manuel/Forbedret CPC, Maks. klik/konverteringer, Mål-CPA, Mål-ROAS …) |
| Overblik med sammenligning mod forrige periode | Opret / slet kampagner og annoncegrupper |
| Rapporter: konto, kampagne, annoncegruppe, søgeord, **søgetermer**, annonce, geografi, enhed, alder/køn, time, ugedag | Søgeord: tilføj, bud, pause, slet |
| Søgeordsidéer og budgetanbefalinger (Ad Insight) | Negative søgeord på kampagne/annoncegruppe |
| Forbrug denne måned + prognose | Responsive søgeannoncer: opret, pause/aktivér |
| Ændringsloggen | **Alt andet** via et generelt REST v13-værktøj (udvidelser, målretning, målgrupper, konverteringsmål …) – kræver altid godkendelse |

**Forbrug (Indstillinger → Forbrug)**
- Godkendelsestilstand: *Godkend alt* · *Godkend forbrugsøgninger* (anbefalet) · *Autopilot inden for grænser*.
- Månedsbudget med prognose, advarsel ved X % og **budgetvagt**, der kan pause alt ved 100 %.
- Hårde grænser: maks. dagsbudget pr. kampagne, maks. samlet dagsbudget, maks. CPC-bud, tilladt at oprette/slette,
  nye kampagner starter pauset, **beskyttede kampagner** som assistenten ikke må røre.
- Budgetstigninger over X % kræver altid godkendelse (også i autopilot).
- **Nødstop**: pause alle kampagner med ét klik (kan fortrydes).

**Øvrigt**
- Sammenfoldeligt indsigtsvindue ved chatten med sektioner, der hver kan foldes ud og sammen: nøgletal, trend,
  månedsbudget og automatiske *opmærksomhedspunkter* (budgetbegrænsede kampagner, høj CPA, forbrug uden
  konverteringer …) – klik for at få assistenten til at analysere dem.
- Kampagneside med inline-redigering af budget og status og "Spørg AI" pr. kampagne.
- Aktivitetslog over alle ændringer (assistent, dig, budgetvagt) med fortryd.
- AI-indstillinger: model (Opus 5.5 anbefalet, Sonnet 5.5, Haiku 5.5, Fable 5.1), indsats, vis tankegang,
  **månedligt AI-budget** og forbrugsoversigt i USD/DKK.
- Virksomhedsprofil (mål-CPA/ROAS, dækningsgrad, tone of voice, egne instruktioner), som assistenten bruger.
- **Demo-konto** ("Nordlys Interiør") med realistiske, deterministiske data – hele appen kan prøves uden Microsoft-login.

## Kom i gang

Forudsætninger (de samme som til Inventarland): **Node.js 20+**, **pnpm 10**, **Rust (stable-msvc)**,
**Visual Studio 2022 Build Tools** med "Desktop development with C++" og **WebView2** (følger med Windows 10/11).
Se evt. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/#windows).

```bash
pnpm install
pnpm app:dev      # åbner appen i et native vindue (hot reload)
```

Byg en installer (`.msi` og `setup.exe` i `src-tauri/target/release/bundle/`):

```bash
pnpm app:build
```

Første gang du åbner appen, logger du ind med din Microsoft-konto. Derefter guider en velkomst dig igennem:
Claude-nøgle → Microsoft Advertising (eller demo) → forbrugsregler.

### Konti og fælles forbindelser

- **Log ind med Microsoft** giver dig en konto i appen og lader appen lægge påmindelser og begivenheder i din egen
  Outlook-kalender (`Calendars.ReadWrite`). Det er alt, dit eget login bruges til.
- **Forbindelserne er fælles for hele afdelingen** og gemmes på jeres Cloudflare (`cloudflare/src/workspace.ts`):
  Microsoft Advertising-login, developer token, Claude- og Gemini-nøgler samt planlægningstavlerne. Alle, der er
  logget ind, ser de samme data og kan ændre forbindelserne under *Indstillinger → Forbindelser*.
- Microsoft Advertising-refresh-tokenet forlader aldrig Cloudflare – appen får korte adgangstokens derfra.
- Den første, der logger ind, bliver **administrator**. Kolleger med en `inventarland.dk`-adresse kommer ind med det
  samme; andre venter, til en administrator giver adgang under *Indstillinger → Brugere*.
- Opsætning (app-registrering og `MS_CLIENT_ID`): se [docs/RELEASE.md](docs/RELEASE.md).

### Inventarland (webshop og andre kanaler)

Under *Indstillinger → Forbindelser → Inventarland* forbindes appen til Inventarlands API (`inventarland-api` på
Cloudflare, fra Inventarland-appen). Det giver assistenten tre læse-værktøjer:

| Værktøj | Hvad assistenten får | Brug det til |
| --- | --- | --- |
| `get_shop_sales` | Webshoppens faktiske salg fra Magento: omsætning, ordrer, gns. ordre, refusioner, dag for dag og bedst sælgende produkter | Se om Bing-annoncerne giver rigtigt salg – ikke kun Microsofts egne konverteringer. Fx *"Hvor stor en del af webshoppens omsætning bruger vi på Bing?"* |
| `get_shop_products` | Produktsalg pr. SKU: stk., omsætning, andel og udvikling | Vælg hvad der skal annonceres, og skriv annoncer/søgeord til produkter, der sælger. Fx *"Lav annoncer til de 5 bedst sælgende kontorstole"* |
| `get_channel_comparison` | Google Ads, Microsoft Ads, Meta og Daisycon side om side (forbrug, omsætning, ROAS, CPA) og en kanals kampagner | Sæt Bing i perspektiv. Fx *"Er vores ROAS på Bing bedre end på Google?"* |

Opsætning (én gang): opret i Inventarland en bruger med rollen **Læser** (*Administration → Brugere*), fx
`bing-ads-chat@inventarland.dk`, og skriv e-mail og adgangskode ind i Bing Ads Chat. Adgangskoden gemmes kun på jeres
Cloudflare; Workeren logger selv ind igen, når Inventarland-sessionen udløber. Der læses kun – intet ændres i
Inventarland. Værktøjerne kan slås fra i chatfeltet under *Inventarland · webshop og kanaler*.

### Lokal udvikling med test-login

```bash
cd cloudflare && npx wrangler dev --port 8787 --var DEV_LOGIN:1 --var MS_CLIENT_ID:<client-id>
VITE_SITE_URL=http://localhost:8787 pnpm dev   # i en anden terminal
```

`DEV_LOGIN=1` giver et test-login med blot en e-mailadresse. Det må kun bruges lokalt – aldrig i `wrangler.jsonc`.

## Kommandoer

| Kommando | Formål |
| --- | --- |
| `pnpm app:dev` | Desktop-app i udviklingstilstand |
| `pnpm app:build` | Byg Windows-installere |
| `pnpm dev` | Kun UI i browseren (Microsoft-kald går via en lille dev-proxy; nøgler gemmes i localStorage – kun til udvikling) |
| `pnpm check` | TypeScript + tests |
| `pnpm app:icons` | Generér ikoner fra `src-tauri/icons/app-icon.svg` |

## Arkitektur

```
src/
  ai/            agent-løkke (streaming + værktøjer), systemprompt, forbrugsregler (guardrails), værktøjer, modelpriser
  bing/          Microsoft Advertising: OAuth, REST v13-klient, live-backend, rapporter, demo-konto
  components/    reactbits/ (Orb, GradientASCII, BlurText, SpotlightCard, ClickSpark, CountUp, ElasticSlider, Stepper …),
                 ui/ (knapper, felter, dropdowns, dialoger), blocks/ (KPI'er, grafer, tabeller), layout/
  features/      chat, insights, campaigns, activity, settings, onboarding
  stores/        zustand: indstillinger, forbindelse, samtaler (IndexedDB), aktivitetslog, AI-forbrug
src-tauri/       Rust-skal: sikker lagring af login (Credential Manager), OAuth-loopback, HTTP-scope til Microsoft
```

- **Sikkerhed:** Webdelen kan kun kalde Microsofts domæner via Tauri HTTP-pluginnet (scope i
  `src-tauri/capabilities/default.json`) og Claude via CSP. Fælles nøgler og forbindelser ligger på jeres Cloudflare; på PC'en gemmes kun login-sessionen og kalender-tokenet (Windows Credential Manager).
  Indhold fra kontoen (kampagnenavne, søgetermer, API-svar) behandles som data, ikke instruktioner.
- **Hver ændring** bliver til en *ChangePlan*, der vurderes af `src/ai/guardrails.ts` (bloker / kræv godkendelse /
  tillad) før noget sendes til Microsoft, og logges med en fortryd-operation.
- **Claude:** Messages API med streaming, adaptive thinking, effort, prompt caching og server-side fallback.
  Historikken er append-only, så cache og tankeblokke forbliver gyldige.
