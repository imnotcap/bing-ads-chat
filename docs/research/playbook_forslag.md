# Forslag til ændringer i playbook og systemprompt

Konkrete rettelser til `src/ai/playbooks/microsoftAds.ts` (playbook, dansk) og `src/ai/prompt.ts` (systemprompt, engelsk), baseret på researchnoterne i `docs/research/research_notes/Microsoft Ads ekspertviden til playbook/`. Baggrund og vurdering står i `docs/research/RAPPORT.md`.

Sådan læses filen:
- Hver rettelse har et id (P = playbook, Q = prompt), en begrundelse på én linje og kilden fra noterne.
- "Gammel tekst" er kopieret ordret fra filen og forekommer præcis én gang. Den kan erstattes direkte med "Ny tekst". Rettelserne overlapper ikke hinanden og kan anvendes i den viste rækkefølge.
- Ny tekst indeholder ingen backticks eller `${`, så den kan stå direkte i template-strengene.
- Kun ændringer, som kilderne understøtter. Hvor reglen er teamets egen (husregel), siger den nye tekst det.

**Status:** Alle 68 rettelser er lagt ind i koden, med tre afvigelser:
- **Q11:** Roden "Alle produkter" kan ikke selv udelukkes, men edit_product_groups kan stoppe alle produkter ved at dele roden og udelukke "alt andet" (kun når brugeren udtrykkeligt beder om det). Teksten siger det i stedet for kun "pause annoncegruppen".
- **Q16 og P5:** Tilføjet, at appens egne værktøjer stadig advarer under 15 konverteringer (`MIN_CONVERSIONS_30D`), da det er en husregel, teamet ikke har ændret endnu.

Desuden:
- `LEVER`-teksterne i `checks.ts` nævner ikke længere maks. CPC-loft eller skift til Mål-CPA.
- Loftet for promptens længde i `src/test/prompt.test.ts` er hævet fra 70.000 til 85.000 tegn, da prompten nu er ca. 81.000 tegn (ca. 20.000 tokens).

---

## Del 1 – src/ai/playbooks/microsoftAds.ts

### P1 – Trin 1: nyeste klikdage og konverteringsforsinkelse
Begrundelse: Microsoft bogfører konverteringer på klikdatoen og har en kolonne for konverteringsforsinkelse, så "3 dage" er for kort til ROAS/CPA.
Kilde: [Understanding conversion delay](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_conversiondelay); [Discrepancy article](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_baawdiscrepancy)

Gammel tekst:
```text
Til beslutninger: 30–90 dage (B2B har lang beslutningstid), og ekskluder de seneste 3 dage, fordi konverteringer kommer forsinket.
```
Ny tekst:
```text
Til beslutninger: 30–90 dage (B2B har lang beslutningstid), og ekskluder de nyeste klikdage: Microsoft bogfører konverteringer på klikdatoen, så de seneste dage får stadig konverteringer. Brug kampagnens konverteringsforsinkelse (Conversion delay = dage til 90 % af konverteringerne); findes den ikke, så mindst 3–7 dage.
```

### P2 – Trin 1: forsinkelse pr. datatype
Begrundelse: Kvalitetsresultatets 14–18 timer er bekræftet; visningsandel, auktionsindsigt og PMax-søgetermindsigt har deres egne forsinkelser.
Kilde: [Is my data updated in real time?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_datafreshness); [KeywordPerformanceReportColumn](https://learn.microsoft.com/en-us/advertising/reporting-service/keywordperformancereportcolumn?view=bingads-13)

Gammel tekst:
```text
Data er først "lukket" ca. 3 timer efter; kvalitetsresultat opdateres 14–18 timer efter dagens slutning (UTC).
```
Ny tekst:
```text
Data er først "lukket" ca. 3 timer efter (klik og omkostning); kvalitetsresultat opdateres 14–18 timer efter dagens slutning (UTC); visningsandel kan være op til ca. 16 timer forsinket, auktionsindsigt ca. 2,5 dage og Performance Max-søgetermindsigt op til 3 dage.
```

### P3 – Trin 1: flere forklaringer på udsving
Begrundelse: Ændrede konverteringsmål, auto-anvendte anbefalinger og Microsofts nye budmodeller (fra 18. nov. 2026) giver også udsving.
Kilde: [Conversions versus All conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_convsvsallconvs); [Auto-apply recommendation settings](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_autoapplyrec); [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)

Gammel tekst:
```text
Tjek get_change_history for de sidste 7 dage: Google-import, automatiske regler eller andres ændringer kan forklare udsving – nævn det før du konkluderer.
```
Ny tekst:
```text
Tjek get_change_history for de sidste 7 dage: Google-import, automatiske regler, auto-anvendte anbefalinger, ændrede konverteringsmål (Medtag i Konverteringer, attributionsmodel, importerede Google-mål) eller andres ændringer kan forklare udsving – nævn det før du konkluderer. Microsoft udruller nye budmodeller fra 18. nov. 2026, så udsving i automatiske kampagner kan også komme fra Microsofts side.
```

### P4 – Trin 2: læringsfase – mål må justeres i små skridt
Begrundelse: Microsoft (nov. 2026): mål kan ændres løbende i ca. 15 %-skridt; strategiskift, nye mål og store budgetændringer forlænger læringen.
Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)

Gammel tekst:
```text
Så skal den have ro – foreslå ikke ændringer i budget, mål eller strategi.
```
Ny tekst:
```text
Så skal den have ro – foreslå ikke skift af strategi eller konverteringsmål, og ingen store budgetændringer (de forlænger læringen). Mål må ifølge Microsoft (nov. 2026) justeres løbende i små skridt (ca. 15 %), men vurder først effekten efter 1–2 konverteringscyklusser.
```

### P5 – Trin 2: konverteringsvolumen og strategivalg
Begrundelse: Microsoft anbefaler nu konverteringsbaseret start ved mindst 5 konto-konverteringer; manuel CPC findes ikke i Søgning/Shopping; lang konverteringstid taler imod Maksimér konverteringer.
Kilde: [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising); [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13); [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

Gammel tekst:
```text
- Konverteringsvolumen: Automatiske strategier (Maksimér konverteringer/-værdi med mål-CPA/-ROAS) kræver mindst 30 konverteringer på 30 dage. Under det: anbefal manuel/Forbedret CPC eller samling af kampagner.
```
Ny tekst:
```text
- Konverteringsvolumen: Microsoft anbefaler (nov. 2026), at nye kampagner starter på en konverteringsbaseret strategi (Maksimér konverteringer/-værdi, evt. med mål-CPA/-ROAS), når kontoen har mindst 5 konverteringer – under 5: Forbedret CPC. Vurder strategien først efter ca. 30 konverteringer på 30 dage på kampagne- eller porteføljeniveau; under 30 på 30 dage optimerer den ifølge Microsofts API-guide ikke ordentligt (status "Limited: low data volume"). Ved lav volumen: saml kampagner eller brug en porteføljestrategi. Manuel CPC findes ikke i Søgning og Shopping. Kommer de fleste konverteringer mere end 7 dage efter klikket, eller uploades offline-konverteringer ikke dagligt, fraråder Microsoft Maksimér konverteringer/mål-CPA.
```

### P6 – Trin 2: LinkedIn er ikke bekræftet for Danmark
Begrundelse: Microsofts egne sider nævner kun seks markeder (ikke Danmark) for LinkedIn-profilmålretning.
Kilde: [help 56905 (snippet)](https://help.ads.microsoft.com/apex/index/3/en/56905); [Microsoft blog, 4. feb. 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february)

Gammel tekst:
```text
LinkedIn-dimensioner (virksomhed, branche, jobfunktion), hvis data findes.
```
Ny tekst:
```text
LinkedIn-dimensioner (virksomhed, branche, jobfunktion), hvis data findes. LinkedIn-profilmålretning er officielt kun nævnt for kampagner rettet mod USA, Canada, UK, Australien, Frankrig og Tyskland – er rapporten tom for en dansk kampagne, er det sandsynligvis manglende tilgængelighed, ikke en datafejl.
```

### P7 – Trin 2: søgetermrapportens filter og danske bøjninger
Begrundelse: Rapporten viser kun termer med "et betydeligt antal klik", og negative søgeord rammer ikke varianter (flertal, bøjninger).
Kilde: [Run a search term report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchqueryreport); [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)

Gammel tekst:
```text
- Søgetermer (ugentligt): spild uden konverteringer, irrelevante hensigter og nye søgeordskandidater.
```
Ny tekst:
```text
- Søgetermer (ugentligt): spild uden konverteringer, irrelevante hensigter og nye søgeordskandidater. Søgetermrapporten viser kun termer med et betydeligt antal klik – spild fundet der er et minimum. Negative søgeord rammer ikke bøjninger, flertal og sammensætninger (brugt/brugte, gratis/gratisfragt) – tilføj hver form, der ses i søgetermerne.
```

### P8 – Værktøjer: standardmålretningens begrænsninger
Begrundelse: −90 % er kun et signal under automatiske strategier, kun −100 % udelukker; annoncegruppens målretning erstatter kampagnens; lokationshensigt er som standard "i eller søger efter".
Kilde: [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13); [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding); [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13); [LocationIntentCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationintentcriterion?view=bingads-13)

Gammel tekst:
```text
set_campaign_targeting (enheder, tidsplan, lokationer – standard: mobil og tablet -90 %, standardtidsplanen, Danmark + 5 regioner)
```
Ny tekst:
```text
set_campaign_targeting (enheder, tidsplan, lokationer – standard: mobil og tablet -90 %, standardtidsplanen, Danmark + 5 regioner; -90 % er ikke et hårdt loft under automatiske strategier – kun -100 % udelukker en enhed; annoncegruppens egne lokationer, enheder eller tidsplan erstatter kampagnens; lokationshensigt er som standard "i eller søger efter", så "kun tilstedeværelse" er et bevidst valg)
```

### P9 – RSA: automatisk genererede elementer
Begrundelse: Microsoft tilføjer som standard egen tekst fra landingssiden til RSA'er uden 15 overskrifter og 4 beskrivelser; den tekst går uden om appens tjek.
Kilde: [Microsoft blog, 15. jan. 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026); [Microsoft blog, 16. apr. 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026); [About Responsive Search ads](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_responsivesearchads)

Gammel tekst:
```text
- Fastgørelse: mindst én overskrift skal kunne stå i hver position (1–3) og mindst én beskrivelse i hver (1–2). Fastgør ikke alle til samme sted.
```
Ny tekst:
```text
- Fastgørelse: mindst én overskrift skal kunne stå i hver position (1–3) og mindst én beskrivelse i hver (1–2). Fastgør ikke alle til samme sted.
- Automatisk genererede elementer: slået til som standard for nye RSA'er siden 15. jan. 2026 og fra april 2026 også for eksisterende RSA'er uden 15 overskrifter og 4 beskrivelser. Microsoft skriver teksten ud fra landingssiden, og den går uden om review_ad_copy og vores påstandstjek (priser, "gratis", førpriser). Tjek kampagnens indstilling, og foreslå at slå den fra, hvor påstande skal styres. Automatiske udvidelser kan kun slås fra på kontoniveau.
```

### P10 – RSA: stilregler efter Microsofts redaktionelle krav
Begrundelse: Politikken tillader ét ! eller ? pr. sætning, højst én pris/procent pr. annonce, forbyder hastesprog uden undtagelse og kræver sætningsstil i beskrivelser; telefonnummer-reglen er ikke bekræftet som politik.
Kilde: [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1); [Call extensions help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addcallextension)

Gammel tekst:
```text
- Stilregler: ingen unødvendige symboler eller gentaget tegnsætning, korrekt brug af store og små bogstaver, ingen gentagne ord, intet presserende sprog uden et rigtigt tilbud med slutdato, telefonnumre kun i opkaldsudvidelse.
```
Ny tekst:
```text
- Stilregler (Microsofts redaktionelle krav): ingen unødvendige symboler, højst ét ! eller ? pr. sætning og aldrig flere tegn i træk, korrekt brug af store og små bogstaver (højst ét ord med kun versaler; beskrivelser i sætningsstil – brug ikke engelsk Title Case på dansk), højst én pris eller én procentsats pr. annonce, ingen gentagne ord, intet presserende sprog ("kun i dag", "begrænset lager") – en rigtig slutdato hører hjemme i en kampagneudvidelse eller en nedtælling. Telefonnumre i opkaldsudvidelsen (vores praksis; i Danmark vises den kun på smartphones).
```

### P11 – RSA: annoncestyrke og elementvurderinger er to ting
Begrundelse: Annoncestyrke er Dårlig/Gennemsnitlig/God/Fremragende (ny model 0–100 %); Lav/God/Bedst er elementvurderinger; Microsoft siger selv, at scoren ikke garanterer resultater.
Kilde: [About Ad strength](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_adstrength); [AssetLink](https://learn.microsoft.com/en-us/advertising/campaign-management-service/assetlink?view=bingads-13); [Optmyzr 2024](https://www.optmyzr.com/blog/google-ad-strength-study/)

Gammel tekst:
```text
- Annoncestyrke og elementvurderinger (Lav/God/Bedst) er Microsofts egne signaler. Brug dem som vejledning, men jag ikke annoncestyrke: i store undersøgelser (Optmyzr, Google-konti) fulgte den ikke resultaterne.
```
Ny tekst:
```text
- Annoncestyrke (Dårlig/Gennemsnitlig/God/Fremragende; i den nye model 0–100 %) og elementvurderinger (Lav/God/Bedst/Ikke vurderet/Lærer) er Microsofts egne signaler. Brug dem som vejledning, men jag ikke annoncestyrke: Microsoft skriver selv, at scoren ikke garanterer resultater, og i store undersøgelser (Optmyzr, Google-konti) fulgte den ikke resultaterne.
```

### P12 – RSA: to annoncer pr. gruppe – primærkilden siger det selv
Begrundelse: Optmyzrs egen side skriver, at grupper med én eller tre RSA'er ikke får samme løft; det er ikke kun sekundære kilder.
Kilde: [Optmyzr RSA study, 7. apr. 2023](https://www.optmyzr.com/blog/optmyzr-study-responsive-search-ad-performance/)

Gammel tekst:
```text
Optmyzrs undersøgelse fra 2022 (13.671 konti) pegede på to som det bedste for konverteringsraten; at en tredje giver mindre, har vi kun set i sekundære kilder.
```
Ny tekst:
```text
Optmyzrs undersøgelse fra 2022 (13.671 Google-konti) pegede på to som det bedste for konverteringsraten – grupper med én eller tre RSA'er fik ikke samme løft.
```

### P13 – RSA: Microsofts eget testminimum
Begrundelse: Microsoft anbefaler mindst 1.000 visninger og en uge pr. annonce; teamets regel er strengere og kan blive.
Kilde: [About Responsive Search ads](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_responsivesearchads)

Gammel tekst:
```text
Mindst 100 klik pr. annonce og 2–4 uger før en vinder udpeges, og skift ét tema ad gangen.
```
Ny tekst:
```text
Mindst 100 klik pr. annonce og 2–4 uger før en vinder udpeges (strengere end Microsofts eget minimum på 1.000 visninger og en uge), og skift ét tema ad gangen.
```

### P14 – Ny annonce: moms, én pris og førpris
Begrundelse: Microsofts EU-prisregler kræver moms og afgifter i prisen og oplysning om fragt; kun én pris/procent pr. annonce; danske regler kræver 30-dages laveste førpris ved prisnedsættelse.
Kilde: [Pricing policy](https://help.ads.microsoft.com/#apex/ads/en/60381/-1); [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1); [DI Handel, 12. okt. 2026 (snippet)](https://www.danskindustri.dk/brancher/di-handel/nyhedsarkiv/nyheder/2026/10/black-friday-kan-fa-betydning-for-julehandlen-pas-pa-30-dagesreglen/)

Gammel tekst:
```text
Prisen med ekskl. eller inkl. moms.
```
Ny tekst:
```text
Priser til private skrives inkl. moms (Microsofts EU-prisregler: moms og afgifter skal være med, og fragt skal oplyses); ekskl. moms kun i tydelige B2B-tilbud, og så skal det stå der. Højst én pris eller én procentsats pr. annonce. Ved prisnedsættelse ("Black Friday", "spar", "udsalg", før/nu) skal førprisen være den laveste pris de seneste 30 dage og kunne dokumenteres – kan du ikke se det, så spørg brugeren.
```

### P15 – Shopping og Performance Max: ny underafsnit før "Rapporter"
Begrundelse: Playbooken har ingen regler om prioritet mod PMax, feed-udløb, låste indstillinger og PMax-begrænsninger; alle er dokumenteret.
Kilde: [Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview); [Microsoft blog, juni 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june); [About Performance Max](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax); [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices); [Performance Max API guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max); [Creating and organizing feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog); ["Product offers not found"](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_error); [Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices); [Managing your Products](https://learn.microsoft.com/en-us/advertising/shopping-content/manage-products); [Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)

Gammel tekst:
```text
Rapporter via run_report/microsoft_ads_api
```
Ny tekst:
```text
Shopping og Performance Max – sådan vælger Microsoft
- Standard Shopping mod Standard Shopping på samme butik: højeste prioritet vinder uanset bud – medmindre produktet filtreres fra (fx lokation eller minimumsbud); så går det videre til den lavere prioritet.
- Performance Max mod Standard Shopping på samme produkter: siden maj 2025 vinder den højeste annoncerangering, ikke prioriteten. Styr fordelingen med budget og mål, eller udeluk produkterne i den ene kampagne. Søgekampagner med eksakt match går forud for Performance Max.
- Performance Max: kun Maksimér konverteringer/-værdi (uden konverteringsmål kører den på Maksimér klik), intet delt budget, ingen budjusteringer, budget op til 2–3 gange de kampagner, den erstatter, mål-ROAS først efter 30 konverteringer på 30 dage, start med et løst mål og vent 2 uger mellem målændringer.
- Låst efter oprettelse: butikken i Shopping og Performance Max, og salgslandet i Shopping. Forkert butik = ny kampagne.
- Merchant Center: feeds og Google-importer udløber efter 30 dage, og så stopper produkterne. Nye eller ændrede feeds kan tage op til ca. 72 timer. "Product offers not found": tjek butik → feed (publicering slået til, land) → produktstatus → filtre. Pris og lagerstatus i feedet skal matche landingssiden.
- Varenumre kopieres præcist som i Merchant Center – forskellige store/små bogstaver kan give dubletter.
- Sponsored Products (Shopping for brands) findes kun i USA og UK – ikke relevant her.

Rapporter via run_report/microsoft_ads_api
```

### P16 – Rapporter: visningsandel er et estimat
Begrundelse: Visningsandel er et estimat, kun for søgetrafik, tom ved for lidt data, og kan ikke kombineres med timedata (fejl 2053).
Kilde: [Share of voice report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_imprsharereports); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)

Gammel tekst:
```text
- Visningsandel: kolonnerne ImpressionSharePercent, ImpressionLostToBudgetPercent, ImpressionLostToRankAggPercent (tag KeywordId med på søgeordsniveau, ellers bliver tallet upræcist).
```
Ny tekst:
```text
- Visningsandel: kolonnerne ImpressionSharePercent, ImpressionLostToBudgetPercent, ImpressionLostToRankAggPercent (tag KeywordId med på søgeordsniveau, ellers bliver tallet upræcist). Visningsandel er Microsofts estimat, kun for søgetrafik, og er tom for søgeord med for lidt data (tom er ikke 0 %). Den kan ikke kombineres med time-for-time-data (fejl 2053).
```

### P17 – Rapporter: kvalitetsresultat bruges ikke i auktionen
Begrundelse: Microsoft skriver, at tallet ikke bruges i auktionen og ikke påvirker pris; det bygger på eksakt match; QualityScore over flere dage viser seneste værdi.
Kilde: [Quality score in depth](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore); [KeywordPerformanceReportColumn](https://learn.microsoft.com/en-us/advertising/reporting-service/keywordperformancereportcolumn?view=bingads-13)

Gammel tekst:
```text
Det er en diagnose, ikke et mål, og påvirker ikke prisen direkte.
```
Ny tekst:
```text
Det er en diagnose, ikke et mål: Microsoft bruger ikke tallet i auktionen, og det påvirker ikke pris eller forbrug. Det bygger på eksakt match-søgninger de sidste 30 dage, så tomt betyder for lidt data (især frase/bred på danske søgeord), ikke dårligt. Over flere dage viser QualityScore den seneste værdi – brug HistoricalQualityScore til udvikling.
```

### P18 – Rapporter: Performance Max-søgetermer
Begrundelse: Rapportnavnet SearchInsightPerformanceReport kunne ikke bekræftes; PMax-søgetermer står siden aug. 2026 også i den almindelige søgetermrapport.
Kilde: [Microsoft blog, 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [Microsoft blog, maj 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/providing-more-transparency-for-your-performance-max-campaigns)

Gammel tekst:
```text
- Performance Max-søgetemaer: SearchInsightPerformanceReport.
```
Ny tekst:
```text
- Performance Max-søgetemaer: SearchInsightPerformanceReport (rapportnavnet er ikke bekræftet i researchen). Siden aug. 2026 står Performance Max-søgetermer også i den almindelige søgetermrapport, og der findes landingsside- og website-rapporter for Performance Max.
```

### P19 – Rapporter: tidszone
Begrundelse: Pacific-standarden gælder API'et; i brugerfladen følger rapporter kontoens tidszone. (8 timer i sommertidsugerne er almen viden, ikke fra Microsoft.)
Kilde: [Reports guide](https://learn.microsoft.com/en-us/advertising/guides/reports?view=bingads-13); [How does the account time zone impact data?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_timezone)

Gammel tekst:
```text
- Rapporternes tidszone skal være København (ellers bruger Microsoft Pacific-tid, 9 timer forskudt).
```
Ny tekst:
```text
- API-rapporternes tidszone skal sættes til København (ellers bestemmer Pacific-tid, hvad "i dag" og "i går" er – normalt 9 timer forskudt, 8 timer i de uger, hvor USA og EU skifter sommertid på forskellige datoer). I brugerfladen følger rapporter kontoens tidszone.
```

### P20 – Sporing: samtykke og modellerede konverteringer
Begrundelse: Uden noget signal stopper sporingen for al EØS/UK/CH-trafik; aldrig både Consent Mode og TCF; modellering kræver mindst 700 klik/uge.
Kilde: [Microsoft blog, 31. mar. 2025](https://about.ads.microsoft.com/en/blog/post/march-2025/providing-user-consent-signals-on-your-microsoft-campaigns-by-may-5-2025); [FAQ – UET and user consent](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_consentfaq); [Setting up UET for consent mode](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_consent); [FAQ – Modeled conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_modeledconversionsfaq)

Gammel tekst:
```text
- Microsoft Consent Mode er påkrævet i EØS siden 5. maj 2025 (ad_storage skal sendes; IAB TCF 2.0 accepteres). Uden samtykke mistes konverteringer og remarketing for de brugere – tjek før lancering.
```
Ny tekst:
```text
- Samtykkesignal er påkrævet for besøg fra EØS, UK og Schweiz siden 5. maj 2025: UET Consent Mode (ad_storage) eller IAB TCF 2.0 – aldrig begge. Uden noget signal stopper Microsoft UET-konverteringer og remarketing for al trafik derfra; med signal mistes kun dem, der siger nej. Microsoft anbefaler Advanced Consent Mode. Modellerede konverteringer (brøktal i Konverteringer) kræver mindst 700 annonceklik om ugen i markedet – gå ikke ud fra, at de er aktive. Falder konverteringerne til 0 lige efter en ændring af cookiebanneret, så tjek samtykkeopsætningen først.
```

### P21 – Sporing: offline-konverteringer og ny regel om at læse konverteringstal
Begrundelse: "UTC-tid" er for strengt (tidszone pr. række); dertil mangler reglerne om Medtag i Konverteringer, attribution, Google-importerede mål og manglende dubletfilter.
Kilde: [Tracking offline conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uetv2offlineconversion); [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [Auto-tagging of Microsoft Click ID](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_microsoftclickid); [Conversions versus All conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_convsvsallconvs); [AttributionModelType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/attributionmodeltype?view=bingads-13); [Microsoft blog, 19. maj 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026); [How does conversion tracking work?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uetv2howctworks); [Search Engine Roundtable, 6. jun. 2024](https://www.seroundtable.com/microsoft-advertising-import-google-ads-conversion-data-37520.html)

Gammel tekst:
```text
- Forbedrede konverteringer slås til pr. mål. Offline-konverteringer (tilbud/faktura): UTC-tid, inden for 90 dage, kræver MSCLKID (auto-tagging) eller hashet e-mail/telefon.
```
Ny tekst:
```text
- Forbedrede konverteringer slås til pr. mål. Offline-konverteringer (tilbud/faktura): tidszone angives pr. række eller én gang i skabelonen (ikke nødvendigvis UTC), upload inden for 90 dage efter sidste klik, kræver MSCLKID (auto-tagging – slået til som standard; slå den aldrig fra) eller hashet e-mail/telefon. Vent 2 timer efter oprettelse af målet; data kan tage op til 6 timer. Bruges de af en automatisk budstrategi: upload dagligt, helst inden for 2 dage.
- Læs konverteringstal rigtigt: Konverteringer, omsætning, CPA og ROAS tæller kun mål med "Medtag i Konverteringer" (det er også dem, budstrategien bruger); Alle konverteringer tæller alt, også view-through. Standard er sidste klik pr. mål; datadrevet attribution findes for alle siden maj 2026 og flytter kredit mellem kampagner. Ændringer i vindue, tælling eller attribution gælder kun fremad – sammenlign ikke hen over skiftet. Google-import tager som standard Googles konverteringsmål med (siden 2024) – tjek for dobbelttælling. Microsoft frasorterer ikke test- eller dobbeltordrer.
```

### P22 – Sporing: tjeklisten
Begrundelse: Google-import tager konverteringsmål med, og AI Max og autogenererede elementer er slået til som standard.
Kilde: [Search Engine Roundtable, 6. jun. 2024](https://www.seroundtable.com/microsoft-advertising-import-google-ads-conversion-data-37520.html); [AI Max blog, 27. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [Microsoft blog, 16. apr. 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)

Gammel tekst:
```text
Google-import er gennemgået.
```
Ny tekst:
```text
Google-import er gennemgået (også importerede konverteringsmål), og AI Max samt automatisk genererede annonceelementer er bevidst slået til eller fra.
```

### P23 – API-fejl: præcise råd og flere koder
Begrundelse: 207 gælder rapporter (vent på de kørende); flere koder forklarer typiske afvisninger.
Kilde: [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes); [Handle service errors](https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions); [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13)

Gammel tekst:
```text
117: for mange kald – vent 60 sek. 207: for mange samtidige rapporter.
```
Ny tekst:
```text
117: for mange kald – vent 60 sek. 207 (rapporter): for mange samtidige rapporter – vent til de kørende er færdige. 611274: maks. CPC kan ikke tilføjes på en kampagne uden porteføljestrategi. 1215/1231: annoncegruppen er udløbet – kun slutdatoen kan forlænges. 1216: startdatoen er nået og kan ikke ændres. 1545: matchtypen kan ikke ændres – tilføj et nyt søgeord. 4128: produktgruppen mangler "alt andet". 0: midlertidig fejl hos Microsoft – prøv igen én gang senere.
```

### P24 – Grænser: dagsbudget er en husregel
Begrundelse: Microsoft giver ingen tal for budgetskridt, kun at budgetændringer i læringsperioden forlænger den.
Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

Gammel tekst:
```text
- Dagsbudget: højst ±20 % pr. ændring og højst én ændring pr. 7 dage på kampagner med automatisk budstrategi. Større hop: forklar risikoen og del op.
```
Ny tekst:
```text
- Dagsbudget: højst ±20 % pr. ændring og højst én ændring pr. 7 dage på kampagner med automatisk budstrategi (husregel – Microsoft giver ingen tal, men siger, at budgetændringer i læringsperioden forlænger den). Større hop: forklar risikoen og del op.
```

### P25 – Grænser: mål-CPA/-ROAS og ventetid
Begrundelse: Størrelsen er bekræftet; ventetiden er hos Microsoft "én konverteringscyklus" for Søgning/Shopping og 2 uger for PMax. Retter også uoverensstemmelsen med prompten.
Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising); [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)

Gammel tekst:
```text
- Mål-CPA/-ROAS: ±10–15 % pr. skridt, mindst 2 uger mellem ændringer.
```
Ny tekst:
```text
- Mål-CPA/-ROAS: ±10–15 % pr. skridt (Microsoft anbefaler 10–15 %). Søgning/Shopping: vurder efter 1–2 konverteringscyklusser, dog tidligst efter 7 dage (husregel). Performance Max: mindst 2 uger mellem ændringer (Microsoft).
```

### P26 – Grænser: CPC-bud er Forbedret CPC
Begrundelse: Manuel CPC findes ikke i Søgning og Shopping; reglen er en husregel.
Kilde: [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13)

Gammel tekst:
```text
- Manuelle CPC-bud: ±20 % pr. søgeord pr. uge.
```
Ny tekst:
```text
- CPC-bud (Forbedret CPC – manuel CPC findes ikke i Søgning og Shopping): ±20 % pr. søgeord eller produktgruppe pr. uge (husregel).
```

### P27 – Grænser: hvordan budjusteringer virker
Begrundelse: Microsofts API-guide viser, at forskellige typer ganges (1,20 × 1,30); overlappende lokationer lægges ikke sammen; under automatiske strategier er de signaler; intervaller.
Kilde: [Show Ads to Your Target Audience](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13); [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding); [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13)

Gammel tekst:
```text
De ganges sammen (+10 % og +20 % = +32 %) – regn det ud for brugeren.
```
Ny tekst:
```text
Forskellige typer ganges sammen (+10 % og +20 % = +32 %) – regn det ud for brugeren. Overlappende lokationer lægges ikke sammen: den mest specifikke gælder. Under automatiske budstrategier er justeringer kun signaler, ikke faste faktorer, og Microsoft justerer selv enhedsbud løbende. Interval -90 til +900 %; kun enheder kan sættes til -100 % (= udelukket).
```

### P28 – Datagrundlag: annoncevinder og eksperimenter
Begrundelse: 95 % er ikke Microsofts tærskel (den oplyses ikke); Microsoft anbefaler mindst 4 uger og 50/50.
Kilde: [Examples and tips for experiments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_bestpractices); [Discover the possibilities with experiments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_about)

Gammel tekst:
```text
- Annonce-/eksperimentvinder: mindst 95 % sikkerhed, mindst 100 klik og 2 uger pr. variant.
```
Ny tekst:
```text
- Annoncevinder: mindst 100 klik og 2 uger pr. variant. Eksperimenter: 50/50-split, 2 uger ens og derefter mindst 2 uger A/B (mindst 4 uger i alt), og brug Microsofts egen signifikansfarve (grøn/rød/grå) – Microsoft oplyser ikke sit sikkerhedsniveau, så skriv ikke "95 %".
```

### P29 – Ekstra omtanke: AI Max og førpriser
Begrundelse: AI Max er slået til som standard i nye søgekampagner; førpriser er et selvstændigt juridisk punkt.
Kilde: [AI Max blog, 27. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [DI Handel, 12. okt. 2026 (snippet)](https://www.danskindustri.dk/brancher/di-handel/nyhedsarkiv/nyheder/2026/10/black-friday-kan-fa-betydning-for-julehandlen-pas-pa-30-dagesreglen/)

Gammel tekst:
```text
nye kampagner/Performance Max, ændring af konverteringsmål, Google-importplaner og alt i annoncetekster med priser, moms (ekskl./inkl.) eller løfter.
```
Ny tekst:
```text
nye kampagner/Performance Max (nye søgekampagner får AI Max slået til som standard siden aug. 2026 – sig på kortet, om det er til eller fra), ændring af konverteringsmål, Google-importplaner og alt i annoncetekster med priser, førpriser, moms (ekskl./inkl.) eller løfter.
```

### P30 – Ekstra omtanke: læringsfase
Begrundelse: Samme kilde som P4: mål må justeres i små skridt; strategi, mål og store budgetændringer forstyrrer.
Kilde: [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising); [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

Gammel tekst:
```text
- Ingen ændringer i budget, mål eller strategi på kampagner i læringsfase.
```
Ny tekst:
```text
- Ingen skift af strategi eller konverteringsmål og ingen store budgetændringer på kampagner i læringsfase. Mål kun i små skridt (ca. 15 %).
```

### P31 – Ekstra omtanke: sæsonjustering og dataudelukkelse
Begrundelse: Sæsonjustering gælder kun mål-CPA/-ROAS og er en forventet ændring i konverteringsrate; dataudelukkelse må være op til 14 dage (≤7 anbefales) og ikke i de første 30 dage.
Kilde: [Seasonality adjustments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments); [Data exclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions)

Gammel tekst:
```text
- Brug sæsonjustering (≤14 dage) eller dataudelukkelse (≤7 dage) i stedet for at flytte mål ved Black Friday, udsalg eller sporingsfejl.
```
Ny tekst:
```text
- Brug sæsonjustering ved Black Friday og udsalg (højst 14 dage; kun på kampagner med mål-CPA/-ROAS; procenten er den forventede ændring i konverteringsrate, fx sidste års løft) og dataudelukkelse ved sporingsfejl (højst 14 dage, Microsoft anbefaler 7 eller færre; kun når strategien har kørt mindst 30 dage; læg dage til for konverteringsforsinkelse) – i stedet for at flytte mål.
```

### P32 – Ekstra omtanke: maks. CPC-loft
Begrundelse: Siden 1. okt. 2026 kan nye kampagner uden portefølje ikke få et loft (611274), og Microsoft fraråder lofter.
Kilde: [Microsoft blog, 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13); [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising); [Search Engine Land (snippet)](https://searchengineland.com/microsoft-advertising-removes-max-cpc-from-new-standalone-bidding-campaigns-485598)

Gammel tekst:
```text
- Foreslå aldrig at slå auto-anvendte anbefalinger til – de ville omgå godkendelsen.
```
Ny tekst:
```text
- Foreslå aldrig at slå auto-anvendte anbefalinger til – de ville omgå godkendelsen.
- Maks. CPC-loft: siden 1. okt. 2026 kan nye kampagner uden porteføljestrategi på Maksimér klik/konverteringer/konverteringsværdi ikke få et loft (fejl 611274), og Microsoft fraråder lofter. Et eksisterende loft kan kun ændres eller fjernes – og fjernes det, kan det ikke sættes igen (sig det på kortet). Skal der være et hårdt loft, så via en porteføljestrategi.
```

### P33 – Formater: stinavne, ASCII-URL'er og fastgørelse som teamets valg
Begrundelse: Stinavne må ikke indeholde "/", domæne + stier højst 67 tegn, URL'er kun ASCII; Microsoft anbefaler at fastgøre mindst muligt.
Kilde: [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad?view=bingads-13); [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1); [Best practices for RSAs](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_rsa_bestpractices)

Gammel tekst:
```text
stinavne maks. 15 tegn. Søgeordet står altid alene som overskrift 1, fastgjort (pinned) til position 1.
```
Ny tekst:
```text
stinavne maks. 15 tegn uden "/", og domæne + stinavne højst 67 tegn. Endelige URL'er og stinavne kun med ASCII-tegn (ingen æ, ø, å eller accenter). Søgeordet står altid alene som overskrift 1, fastgjort (pinned) til position 1 – det er teamets valg; Microsoft anbefaler generelt at fastgøre så lidt som muligt.
```

### P34 – Navigation: brugerfladen findes ikke på dansk
Begrundelse: Dansk er ikke et visningssprog i Microsoft Advertising; brugerfladen blev fornyet i 2026.
Kilde: [About language options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutlanguageoptions); [Microsoft blog, 21. apr. 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era)

Gammel tekst:
```text
Menunavne ændres ofte: sig "typisk under …", og bed brugeren sige til, hvis det ser anderledes ud.
```
Ny tekst:
```text
Menunavne ændres ofte (ny brugerflade i 2026): sig "typisk under …", og bed brugeren sige til, hvis det ser anderledes ud. Microsoft Advertising findes ikke på dansk – brugeren ser engelske menunavne, så skriv det engelske navn først (se listen nederst) og den danske forklaring efter.
```

### P35 – Navigation: delte budgetter og website-udelukkelser
Begrundelse: "Delt bibliotek" er forældet; de aktuelle stier er Bids & budgets og Content suitability.
Kilde: [Shared budgets](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets); [About website control lists](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_webexclusionstargetedwebsites)

Gammel tekst:
```text
Delt bibliotek (website-udelukkelser, delte budgetter): Værktøjer → Delt bibliotek.
```
Ny tekst:
```text
Delte budgetter: Tools → Bids & budgets → Shared budgets. Website-udelukkelser: Tools → Content suitability → Website control lists.
```

### P36 – Navigation: LinkedIn
Begrundelse: "Kun budjustering" er standarden, ikke den eneste mulighed; Danmark er ikke bekræftet.
Kilde: [AdGroup.Settings](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13); [LinkedIn profile targeting](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_linkedintargeting); [help 56905 (snippet)](https://help.ads.microsoft.com/apex/index/3/en/56905)

Gammel tekst:
```text
Kun budjustering – det indsnævrer ikke rækkevidden.
```
Ny tekst:
```text
Som standard kun budjustering – det indsnævrer ikke rækkevidden (via API kan det sættes til "målret og byd"). Ikke bekræftet tilgængelig for kampagner rettet mod Danmark.
```

### P37 – Navigation: Google-import
Begrundelse: Stien er bekræftet; Import Center kom i maj 2026; planer oprettet via API vises kun på kontoniveau.
Kilde: [Edit your scheduled imports](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importschedulehistory); [Microsoft blog, 19. maj 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026); [Google Ads Import guide](https://learn.microsoft.com/en-us/advertising/guides/google-ads-import?view=bingads-13)

Gammel tekst:
```text
- Google-import: Import → Importplan og -historik. Tjek både konto- og managerkonto-niveau.
```
Ny tekst:
```text
- Google-import: Import → Import schedule & history (siden maj 2026 samlet i Import Center). Tjek både konto- og managerkonto-niveau; planer oprettet via API vises kun på kontoniveau.
```

### P38 – Navigation: engelske navne
Begrundelse: Samme kilde som P35.
Kilde: [Shared budgets](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets); [About website control lists](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_webexclusionstargetedwebsites)

Gammel tekst:
```text
Tools → Negative keyword lists / Shared library / Audiences
```
Ny tekst:
```text
Tools → Negative keyword lists / Bids & budgets → Shared budgets / Content suitability → Website control lists / Audiences
```

### P39 – Google-import: hvad importen ellers overskriver
Begrundelse: Standardindstillingerne opdaterer langt mere end status/bud/budget, og importer kan ikke fortrydes.
Kilde: [GoogleImportOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13); [Change history](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changehistorygraph); [AI Max blog, 27. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [Microsoft blog, 16. apr. 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026); [Search Engine Roundtable, 6. jun. 2024](https://www.seroundtable.com/microsoft-advertising-import-google-ads-conversion-data-37520.html)

Gammel tekst:
```text
Anbefal "kun nye elementer" uden status/bud/budgetter – og nævn importen, hvis ændringshistorikken viser den.
```
Ny tekst:
```text
Som standard opdaterer planlagte importer også lokationer, enheder, annonceplan, sprog, netværk og website-udelukkelser, hæver bud og budgetter til minimum og tager AI Max-indstillinger, automatisk genererede elementer og Googles konverteringsmål med. Importer kan ikke fortrydes i ændringshistorikken. Anbefal "kun nye elementer" uden status/bud/budgetter – og nævn importen, hvis ændringshistorikken viser den.
```

---

## Del 2 – src/ai/prompt.ts

### Q1 – Reasoning rule 3: recent days and change history
Begrundelse: Konverteringer bogføres på klikdatoen (konverteringsforsinkelse); målændringer, attribution, importerede mål og samtykke forklarer også fald.
Kilde: [Understanding conversion delay](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_conversiondelay); [Reports guide](https://learn.microsoft.com/en-us/advertising/guides/reports?view=bingads-13); [Microsoft Q&A, 9. jan. 2026](https://learn.microsoft.com/en-us/answers/questions/5700812/microsoft-ad-tracking-consent-mode)

Gammel tekst:
```text
the newest 1–3 days are incomplete, a paused/expired/budget-paused/disapproved entity (diagnose_delivery), a change someone made (get_change_history),
```
Ny tekst:
```text
recent click dates are incomplete (Microsoft books conversions to the click date, so the newest days keep gaining conversions until the campaign's conversion delay – days to 90 % of conversions – has passed; cost and clicks are complete after about 3 hours), a paused/expired/budget-paused/disapproved entity (diagnose_delivery), a change someone made (get_change_history – including conversion goal edits, attribution model switches, imported Google goals and consent/CMP changes),
```

### Q2 – Reasoning rule 4: when a change can be judged
Begrundelse: Automatiske strategier vurderes på kampagne-/porteføljeniveau efter 1–2 konverteringscyklusser, ikke på søgeords-CPC.
Kilde: [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising); [Understanding conversion delay](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_conversiondelay)

Gammel tekst:
```text
a bid, target or budget change is judged after at least 7 full days and 30 clicks (14 days when the strategy is learning).
```
Ny tekst:
```text
a bid, target or budget change is judged after at least 7 full days and 30 clicks (14 days when the strategy is learning), on click dates older than the conversion delay; an automated strategy is judged at campaign or portfolio level on conversions and CPA/ROAS after 1–2 conversion cycles (Microsoft wants about 30 conversions in 30 days), not on keyword CPCs.
```

### Q3 – Reasoning rule 7: step sizes aligned with the playbook
Begrundelse: Prompten sagde 10–20 % og 20–30 %, playbooken 10–15 % og 20 %; Microsoft siger 10–15 % for mål.
Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)

Gammel tekst:
```text
bids and targets in steps of 10–20 %, budgets up to about 20–30 % – not several levers on the same campaign at once, and not again until the last change has had its 7 days.
```
Ny tekst:
```text
targets (CPA/ROAS) in steps of 10–15 % (Microsoft's advice), bids in steps of 10–20 % and budgets up to about 20 % (the playbook's house rules) – not several levers on the same campaign at once, and not again until the last change has had its 7 days (Performance Max targets: 2 weeks).
```

### Q4 – Standard diagnosis "Skal buddet/målet ændres?"
Begrundelse: Samme som Q3.
Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

Gammel tekst:
```text
Automated → the target, in steps of 10–20 %, and only when
```
Ny tekst:
```text
Automated → the target, in steps of 10–15 %, and only when
```

### Q5 – Standard diagnosis "Kampagnen får ingen/få visninger"
Begrundelse: "Low search volume" og udløbne Merchant Center-tilbud er dokumenterede årsager til ingen visninger.
Kilde: [Delivery status](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialstatus); [Creating and organizing feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog); ["Product offers not found"](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_error)

Gammel tekst:
```text
diagnose_delivery first (status, budget, editorial, paused ad groups, dates) – then impression share lost to rank
```
Ny tekst:
```text
diagnose_delivery first (status, budget, editorial, paused ad groups, dates; keywords in "Low search volume" status don't serve and are rechecked weekly; Shopping/Performance Max: Merchant Center offers expire after 30 days without a feed or import refresh) – then impression share lost to rank
```

### Q6 – Standard diagnosis "Skal budgettet op?"
Begrundelse: En enkelt dag kan overforbruge; Microsoft lader budgetbegrænsede kampagner slå deres mål.
Kilde: [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [Microsoft blog, 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)

Gammel tekst:
```text
and the campaign spends ≥ 90 % of its budget.
```
Ny tekst:
```text
and the campaign spends ≥ 90 % of its budget over a week or more (a single day can overspend). Under automated bidding Microsoft lets a budget-limited campaign beat its target, so one that is limited by budget and above target ROAS is a candidate.
```

### Q7 – Honesty: silent no-ops
Begrundelse: Flere dokumenterede tavse no-ops; manuel CPC gælder kun Audience display/video.
Kilde: [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13); [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme?view=bingads-13); [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13); [IntentOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/intentoption?view=bingads-13)

Gammel tekst:
```text
(keyword/ad group bids under automated bidding, Manual CPC outside Audience campaigns, activating a keyword in a paused campaign …)
```
Ny tekst:
```text
(keyword/ad group bids under automated bidding, Manual CPC outside Audience display/video campaigns, a standalone Target CPA/ROAS that is converted to a Maximize strategy with a target, bid adjustments on location intent, the deprecated "searching for" location intent, activating a keyword in a paused campaign …)
```

### Q8 – Check before proposing: levers under automated bidding
Begrundelse: Maks. CPC kan ikke tilføjes på kampagner uden portefølje (611274) og frarådes; Microsoft nævner sæsonjustering og konverteringsværdiregler i stedet.
Kilde: [Microsoft blog, 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13); [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)

Gammel tekst:
```text
the levers are the campaign target (CPA/ROAS), the budget, the max CPC cap, search terms/negatives, ads and landing pages.
```
Ny tekst:
```text
the levers are the campaign target (CPA/ROAS), the budget, seasonality adjustments, conversion value rules, search terms/negatives, ads and landing pages. A max CPC cap is no longer a lever: on non-portfolio campaigns a new one is refused (error 611274) and Microsoft advises against caps – an existing one can only be edited or removed, and a removed one can't be added back.
```

### Q9 – Check before proposing: shared budgets
Begrundelse: PMax kan ikke bruge delt budget eller portefølje; mål-ROAS kun med delt budget via portefølje.
Kilde: [Shared budgets](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

Gammel tekst:
```text
- Shared budgets, portfolio bid strategies and experiment campaigns can't be changed per campaign – the tools say so; explain where it is changed instead.
```
Ny tekst:
```text
- Shared budgets, portfolio bid strategies and experiment campaigns can't be changed per campaign – the tools say so; explain where it is changed instead. Performance Max can't use a shared budget or a portfolio strategy, and Target ROAS can't use a shared budget except through a portfolio.
```

### Q10 – Making changes: not every Shopping campaign uses bids
Begrundelse: Shopping kan køre Maksimér klik/konverteringsværdi, hvor produktgruppebud ignoreres; det modsagde også prompten selv ("no bid is needed").
Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)

Gammel tekst:
```text
When the campaign uses bids (Enhanced/Manual CPC, and every Shopping campaign) and the user hasn't given a CPC bid
```
Ny tekst:
```text
When the campaign uses bids (Enhanced CPC – Search or Shopping; Shopping campaigns on Maximize clicks or Maximize conversion value ignore product group bids) and the user hasn't given a CPC bid
```

### Q11 – Making changes: the root "Alle produkter" can't be excluded
Begrundelse: Roden i et Shopping-produkttræ skal være en BiddableAdGroupCriterion; for at stoppe alt pauses annoncegruppen. (Tjek at edit_product_groups opfører sig sådan.)
Kilde: [ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)

Gammel tekst:
```text
and excluding "Alle produkter" / "alt andet" (everythingElse: exclude) → edit_product_groups
```
Ny tekst:
```text
and excluding "alt andet" (everythingElse: exclude) → edit_product_groups (the root "Alle produkter" must stay biddable in Microsoft – to stop every product in a Shopping ad group, pause the ad group)
```

### Q12 – Build plan: priority only decides between Standard Shopping campaigns
Begrundelse: Siden maj 2025 afgør annoncerangering, om PMax eller Standard Shopping viser produktet.
Kilde: [Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview); [Microsoft blog, juni 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june)

Gammel tekst:
```text
a higher-priority Shopping campaign takes the item's traffic)
```
Ny tekst:
```text
a higher-priority Standard Shopping campaign takes the item's traffic regardless of bid, but against Performance Max the higher ad rank wins since May 2025)
```

### Q13 – Build plan: why account-level sitelinks show
Begrundelse: Udvidelser fra højere niveauer kan vises sammen med lavere niveauers; de "arves" ikke.
Kilde: [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions?view=bingads-13)

Gammel tekst:
```text
and report account-level ones that also show (never change account-level ones)
```
Ny tekst:
```text
and report account-level ones, because higher-level sitelinks can serve alongside the campaign's own (never change account-level ones)
```

### Q14 – Making changes: what set_campaign_targeting can and can't do
Begrundelse: Annoncegruppens målretning erstatter kampagnens; lokationshensigt standard; intervaller; justeringer er signaler under automatiske strategier.
Kilde: [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13); [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13); [LocationIntentCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationintentcriterion?view=bingads-13); [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13); [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)

Gammel tekst:
```text
device bid adjustments (computer/mobile/tablet), the ad schedule (days, hours, bid adjustments) and locations → set_campaign_targeting – the whole wish in one call
```
Ny tekst:
```text
device bid adjustments (computer/mobile/tablet), the ad schedule (days, hours, bid adjustments) and locations → set_campaign_targeting – the whole wish in one call. Know before you propose: ad group locations, devices or schedule replace the campaign's for that ad group (no union); location intent defaults to people in or searching for the location, so presence only (set_location_intent) is a choice to name; device adjustments go from -100 % (= excluded) to +900 %, schedule and other adjustments only down to -90 % (leave hours out to stop serving); under automated bidding adjustments are signals, not fixed multipliers
```

### Q15 – Know-how: match types and where negatives can live
Begrundelse: Bred er standard, gamle BMM-søgeord kører som bred siden 2023; negativer findes også på konto-niveau, i lister og (siden marts 2026) i PMax.
Kilde: [About broad match](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_broadmatch); [Search Engine Roundtable, 2023](https://www.seroundtable.com/microsoft-advertising-broad-match-modifier-bing-35063.html); [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords); [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13); [Microsoft blog, marts 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026)

Gammel tekst:
```text
- Match types (Exact, Phrase, Broad), negative keywords (Exact/Phrase) at campaign or ad group level, quality score, impression share and budget-limited campaigns.
```
Ny tekst:
```text
- Match types (Exact, Phrase, Broad; broad is Microsoft's default, and legacy "+word" BMM keywords serve as broad since 2023), negative keywords (Exact/Phrase) at account level (one list, applies to Search, Shopping and Performance Max), at campaign or ad group level, in shared lists (campaigns or account, never ad groups) and, since March 2026, in Performance Max (Search and Shopping inventory only); quality score, impression share and budget-limited campaigns.
```

### Q16 – Know-how: bid strategies, conversion thresholds and Max CPC
Begrundelse: "15 konverteringer" har ingen kilde (API-guiden siger 30); Microsoft anbefaler nu start ved ≥5 konto-konverteringer; manuel CPC kun Audience display/video; maks. CPC-ændringen; nye budmodeller.
Kilde: [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising); [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13); [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [Bid strategy report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategyreport); [Microsoft blog, 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13)

Gammel tekst:
```text
- Bid strategies: Enhanced CPC, Maximize clicks, Maximize conversions (optional target CPA), Maximize conversion value (optional target ROAS); Manual CPC only for Audience campaigns (Microsoft silently turns it into Enhanced CPC elsewhere). Since August 2025 campaigns can't be moved to standalone Target CPA/Target ROAS – use the Maximize strategies with a target instead. Microsoft stops optimising below 15 conversions in 30 days; the playbook wants at least 30.
```
Ny tekst:
```text
- Bid strategies: Enhanced CPC, Maximize clicks, Maximize conversions (optional target CPA), Maximize conversion value (optional target ROAS), Target impression share (Search), Cost per sale (Shopping); Manual CPC only for Audience display/video and hotel campaigns (Microsoft silently turns it into Enhanced CPC elsewhere, Search and Shopping included). Since August 2025 campaigns can't be moved to standalone Target CPA/Target ROAS – use the Maximize strategies with a target instead (the API converts silently). Microsoft's guidance (Nov 2026): start new campaigns on a conversion-based strategy when the account has at least 5 conversions (below 5: Enhanced CPC), and evaluate after about 30 conversions in 30 days at campaign or portfolio level; the API guide says the strategy stops optimising below 30 conversions in 30 days ("Limited: low data volume"). There is no documented 15-conversion floor. If most conversions come more than 7 days after the click, or offline conversions aren't uploaded daily, Microsoft advises against Maximize conversions/target CPA. Since 1 Oct 2026 new non-portfolio Maximize clicks/conversions/conversion value campaigns can't get a max CPC (error 611274); existing caps can only be edited or removed. Microsoft rolls out new bidding models from 18 Nov 2026 – expect some volatility before blaming account changes.
```

### Q17 – Know-how: the search term report hides low-click terms
Begrundelse: Rapporten viser kun termer med "a significant number of clicks"; spild fundet er en nedre grænse.
Kilde: [Run a search term report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchqueryreport); [SearchQueryPerformanceReportRequest](https://learn.microsoft.com/en-us/advertising/reporting-service/searchqueryperformancereportrequest?view=bingads-13)

Gammel tekst:
```text
- Search term reports are the main source of negative keywords: look for terms
```
Ny tekst:
```text
- Search term reports are the main source of negative keywords, but Microsoft lists only terms with a significant number of clicks – the rest is hidden, so wasted spend found there is a lower bound: look for terms
```

### Q18 – Know-how: negatives don't match variants
Begrundelse: Negativer filtrerer ikke flertal, stavefejl og varianter; symboler er ikke tilladt.
Kilde: [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)

Gammel tekst:
```text
Prefer one Phrase negative on the unwanted word when it covers several terms.
```
Ny tekst:
```text
Prefer one Phrase negative on the unwanted word when it covers several terms – but negatives don't match close variants, so every inflection, plural or compound seen in the terms needs its own (brugt/brugte, gratis/gratisfragt), and negatives can't contain symbols such as hyphens or punctuation.
```

### Q19 – Know-how: Microsoft specifics, Denmark and automation by default
Begrundelse: CPC-/alders-påstanden er ikke dokumenteret; LinkedIn er ikke bekræftet for Danmark; AI Max, autogenererede elementer og automatiske udvidelser er slået til som standard.
Kilde: [SearchLab (snippet)](https://searchlab.nl/en/statistics/microsoft-ads-statistics-2026); [StatCounter DK (snippet)](https://gs.statcounter.com/search-engine-market-share/all/denmark); [help 56905 (snippet)](https://help.ads.microsoft.com/apex/index/3/en/56905); [AI Max blog, 27. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [Microsoft blog, 15. jan. 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026); [Microsoft blog, 16. apr. 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026); [Opting out of Automated Extensions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_automatedextensionsoptout)

Gammel tekst:
```text
- Microsoft specifics: LinkedIn profile targeting, Microsoft Audience Network, import from Google Ads, UET tag and conversion goals, typically lower CPCs and older/desktop-heavy audience than Google.
```
Ny tekst:
```text
- Microsoft specifics: LinkedIn profile targeting (officially listed only for campaigns targeting the US, CA, UK, AU, FR and DE – don't assume it works for Denmark), Microsoft Audience Network, import from Google Ads, UET tag and conversion goals. Bing has roughly 8–10 % of Danish searches and 13–14 % on desktop; lower CPCs than Google are often claimed but not proven, and there are no reliable Microsoft or Danish benchmarks – judge the account against its own history, break-even ROAS and impression share.
- Automation that runs unless you switch it off: new Search campaigns get AI Max on by default since Aug 2026 (query expansion shown as the "AI optimized" match type, generated text, final URL expansion – it respects negatives); RSAs without 15 headlines and 4 descriptions get autogenerated text from the landing page by default (new RSAs since Jan 2026, existing ones since Apr 2026); automated extensions are on and can only be opted out at account level. None of that text passes review_ad_copy or the claim check – say on the card whether it is on, and recommend switching it off unless the user wants it.
```

### Q20 – Documented rules: RSA paths, URLs and policy
Begrundelse: Stinavne uden "/", domæne + stier ≤ 67 tegn, ASCII-URL'er, 3 aktive RSA'er, én pris/procent, ét !/?, intet hastesprog, sætningsstil.
Kilde: [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad?view=bingads-13); [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits); [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1)

Gammel tekst:
```text
Path1/Path2 max 15 characters each and Path2 only with Path1. The display URL comes from the final URL's domain.
```
Ny tekst:
```text
Path1/Path2 max 15 characters each, no "/", and Path2 only with Path1; domain + paths max 67 characters. Final URLs and paths in ASCII only (no æ/ø/å or accents). The display URL comes from the final URL's domain. Max 3 active RSAs per ad group. Policy: at most one price or percentage per ad, at most one ! or ? per sentence, no urgency phrases, descriptions in sentence case (don't Title Case Danish).
```

### Q21 – Documented rules: duplicate keywords
Begrundelse: Microsoft tillader dubletter efter normalisering (de giver ingen dækning); accenter fjernes ikke; ental/flertal og mellemrum er forskellige søgeord.
Kilde: [About duplicate keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_normalization); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)

Gammel tekst:
```text
Duplicates that only differ in case, accents or punctuation are rejected.
```
Ny tekst:
```text
Duplicates that only differ in case or punctuation add no coverage (Microsoft may accept or reject them); accents, æ/ø/å, singular/plural and spacing (kontorstol / kontor stol) make separate keywords.
```

### Q22 – Documented rules: shared negative lists
Begrundelse: Grænser og niveauer for lister er dokumenteret; kontolistens størrelse er uafklaret (1.000 vs 5.000).
Kilde: [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13); [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13); [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords); [Microsoft blog, marts 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026)

Gammel tekst:
```text
Negative keyword lists (shared) are a separate feature.
```
Ny tekst:
```text
Shared negative keyword lists: up to 20 per account with 5,000 negatives each, attached to campaigns or the account – never to ad groups. The account-level list holds up to 1,000 (one Microsoft page says 5,000).
```

### Q23 – Documented rules: time zone is an account setting
Begrundelse: Siden marts 2022 er tidszonen på kontoniveau, og kampagnefeltet er markeret forældet; valutaen kan aldrig ændres.
Kilde: [Changing your account time zone](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [Choosing your account currency](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_currency)

Gammel tekst:
```text
A campaign's time zone cannot be changed once it has (or has had) active or paused ad groups.
```
Ny tekst:
```text
Time zone is an account setting (since March 2022; the campaign field is deprecated) – changing it shifts ad group dates, reporting and that day's spend. Currency can never be changed.
```

### Q24 – Documented rules: budget overspend
Begrundelse: Én API-side siger 20 %; overforbrug over månedsloftet refunderes.
Kilde: [BudgetLimitType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/budgetlimittype?view=bingads-13); [Discover your budget options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)

Gammel tekst:
```text
A single day can overspend – Microsoft usually keeps it under 2× the daily budget – but the monthly cap is enforced.
```
Ny tekst:
```text
A single day can overspend – Microsoft usually keeps it under 2× the daily budget (one API page says 20 %) – but the monthly cap is enforced, and spend above it is refunded.
```

### Q25 – Documented rules: statuses and dates
Begrundelse: BudgetAndManualPaused mangler; nye annoncer i review kan læses som Disapproved via API; udløbne annoncegrupper og datoregler.
Kilde: [CampaignStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaignstatus?view=bingads-13); [Editorial Review and Appeals](https://learn.microsoft.com/en-us/advertising/guides/editorial-review-appeals?view=bingads-13); [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)

Gammel tekst:
```text
Campaigns can be BudgetPaused (budget used up) or Suspended (by Microsoft).
```
Ny tekst:
```text
Campaigns can be BudgetPaused (budget used up), BudgetAndManualPaused (paused by the user while budget-paused) or Suspended (by Microsoft); only Active and Paused can be set. A new ad still in offline review can read as Disapproved through the API while the UI shows pending review – check the editorial reasons before calling it rejected; an updated ad is effectively paused until re-approved. Expired ad groups come back only by extending the end date; a start date can't be changed once it has arrived; an end date is removed by setting 2 Jan 2050 or later.
```

### Q26 – Documented rules: reports
Begrundelse: 14–18 timer er dokumenteret for kvalitetsresultat; visningsandel kan være op til ca. 16 timer forsinket; konverteringer bogføres på klikdato; Konverteringer vs Alle konverteringer; opbevaring af timedata.
Kilde: [KeywordPerformanceReportColumn](https://learn.microsoft.com/en-us/advertising/reporting-service/keywordperformancereportcolumn?view=bingads-13); [Is my data updated in real time?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_datafreshness); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes); [Understanding conversion delay](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_conversiondelay); [Conversions versus All conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_convsvsallconvs); [Reporting Data Retention](https://learn.microsoft.com/en-us/advertising/guides/report-data-retention-time-periods)

Gammel tekst:
```text
- Reports: impression share data arrives 14–18 hours after the UTC day ends and can't be combined with hourly data; quality score updates once a day; the newest 1–3 days are incomplete (conversions are late).
```
Ny tekst:
```text
- Reports: quality score updates once a day, 14–18 hours after the UTC day ends; impression share can lag up to about 16 hours and can't be combined with hourly data (error 2053); auction insights lag about 2.5 days. Cost and clicks are complete after about 3 hours, but conversions are booked to the click date, so the newest days keep gaining conversions until the conversion delay has passed. "Conversions", revenue, CPA and ROAS count only goals with Include in Conversions; "All conversions" counts everything incl. view-through – name the column. Hourly data is kept 6 months (search terms 1 month).
```

### Q27 – Documented rules: keyword planner covers Denmark
Begrundelse: Microsoft siger nu, at alle understøttede markeder er med (Danmark siden dec. 2022); 6-lande-listen er fra en gammel side.
Kilde: [Microsoft Advertising Keyword planner](https://about.ads.microsoft.com/en/tools/planning/keyword-planner); [Microsoft blog, jan. 2023 (snippet)](https://about.ads.microsoft.com/en/blog/post/january-2023/access-a-world-of-opportunity-scaling-campaigns-to-164-markets); [Keyword planner statistics](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_keywordplanner_statisticstrafficestimates)

Gammel tekst:
```text
- Keyword planner (get_keyword_ideas): Microsoft documents keyword ideas only for the US, UK, Canada, Australia, France and Germany. For Denmark expect an empty or refused answer – then say so and use search terms and shop data instead; never invent search volumes.
```
Ny tekst:
```text
- Keyword planner (get_keyword_ideas): Microsoft now says all supported markets are available, Denmark included, but Danish data is thin: a dash means "not enough data" (not zero), volumes are rounded 12-month averages that ignore match type, and the suggested bid is a minimum. When the answer is empty, say so and use search terms and shop data instead; never invent search volumes.
```

### Q28 – Documented rules: API errors
Begrundelse: 117 = vent 60 sekunder; 207 = rapporter (vent på de kørende); flere koder er dokumenteret.
Kilde: [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes); [Handle service errors](https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions)

Gammel tekst:
```text
117 CallRateExceeded and 207 ConcurrentRequestOverLimit = too many requests, wait and try again;
```
Ny tekst:
```text
117 CallRateExceeded = too many calls, wait 60 seconds; 207 ConcurrentRequestOverLimit (Reporting) = too many reports at once, wait for the running ones; 0 InternalError = temporary, try once later; 611274 = a max CPC can't be added to a non-portfolio campaign; 1545 = a keyword's match type can't be changed (add a new keyword); 1215/1231 = the ad group has expired (only the end date can be extended); 1216 = the start date has arrived and can't be changed; 4128 = a product group subdivision lacks its "everything else" node;
```

### Q29 – Research before you propose (ads): price claims
Begrundelse: Danske regler kræver 30-dages laveste førpris ved prisnedsættelse; Microsofts EU-prisregler kræver moms i prisen.
Kilde: [DI Handel, 12. okt. 2026 (snippet)](https://www.danskindustri.dk/brancher/di-handel/nyhedsarkiv/nyheder/2026/10/black-friday-kan-fa-betydning-for-julehandlen-pas-pa-30-dagesreglen/); [Tænk, nye regler (snippet)](https://taenk.dk/raadgivning/markedsfoering/nye-regler-tilbudspriser); [Pricing policy](https://help.ads.microsoft.com/#apex/ads/en/60381/-1)

Gammel tekst:
```text
you pass those as the evidence parameter.
```
Ny tekst:
```text
you pass those as the evidence parameter. A price reduction ("Black Friday", "Black Week", "spar", "udsalg", før/nu) also needs the før-pris to be the lowest price of the last 30 days (Danish rules) – if you can't verify it, ask the user before you write it. Prices to consumers include moms.
```

---

## Ikke foreslået (bevidst)

- "A keyword's match type cannot be changed" (prompt.ts) bliver stående: Keyword-objektet siger "Update: Optional", men fejlkoden 1545 `KeywordMatchTypeChangeNotAllowedInUpdate` findes. Det bør testes én gang mod en rigtig konto før reglen ændres ([Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)).
- "Broad only under automated bidding with ≥30 conversions in 30 days" bliver stående som husregel. Den er strengere end Microsoft, der anbefaler bred match sammen med automatisk budgivning ([match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)).
- Negativ-tærsklen "1,5–2× mål-CPA eller 30 klik" bliver stående. Microsoft har ingen tærskel; praktikere bruger 2× eller 3× over 90 dage.
- "An ad group without a CPC bid gets the currency's minimum bid" bliver stående. AdGroup-siden bekræfter det ifølge api_v13- og structure_settings-noterne, mens bidding-noten ikke kunne bekræfte det.
- Kodeændringer (checks.ts, live.ts, client.ts, adCopy.ts) hører ikke hjemme her. De står i RAPPORT.md, afsnit 4.
