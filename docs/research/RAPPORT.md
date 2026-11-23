# Microsoft Advertising: hvad assistenten skal vide – researchrapport

November 2026. Rapporten bygger på otte researchnoter i `docs/research/research_notes/Microsoft Ads ekspertviden til playbook/`: bidding_budgets, measurement_data, keywords_negatives, structure_settings, ads_assets, shopping_pmax, context_changes_dk og api_v13. Kilderne blev hentet 20.–23. nov. 2026. Rapporten holder dem op mod assistentens regler i `src/ai/playbooks/microsoftAds.ts` (playbook) og `src/ai/prompt.ts` (systemprompt).

De konkrete tekstrettelser står i `docs/research/playbook_forslag.md`: 39 til playbooken (P1–P39) og 29 til prompten (Q1–Q29). Hver af dem er tjekket mod filerne, så de kan anvendes ordret.

Sådan læses kilderne:
- Officielle Microsoft-kilder er API-dokumentationen og hjælpecentret (læst via spejlet på learn.microsoft.com/advertising/msa-help) samt Microsofts blog.
- "(snippet)" betyder, at kun søgeresultatets tekst blev set. Det er svagere.
- Microsofts egne præstationstal ("+X %") er leverandørdata og ikke uafhængigt efterprøvet.

---

## 1. Kort resumé

1. **"15 konverteringer" har ingen kilde.** Microsofts API-guide siger, at strategierne holder op med at optimere under 30 konverteringer på 30 dage. Siden 18. nov. 2026 anbefaler Microsoft desuden at starte nye kampagner på en konverteringsbaseret strategi, så snart kontoen har mindst 5 konverteringer. Under 5 anbefales Forbedret CPC. Manuel CPC findes ikke i Søgning og Shopping. Det betyder, at assistenten skal ændre sin strategirådgivning, og at kodens tærskel på 15 bør rettes.
2. **Maks. CPC-loft er ikke længere et håndtag.** Siden 1. okt. 2026 kan nye kampagner uden porteføljestrategi ikke få et loft (fejl 611274), og Microsoft fraråder lofter. Et eksisterende loft kan kun ændres eller fjernes, og fjernes det, kan det ikke sættes igen. Fra 12. jan. 2027 forsvinder API-feltet for kampagner, der ikke allerede bruger det. Både prompt og kode behandler i dag loftet som et almindeligt håndtag.
3. **Microsoft automatiserer uden om godkendelseskortet.** Følgende er slået til som standard:
   - AI Max i nye søgekampagner siden aug. 2026.
   - Autogenererede RSA-elementer for nye RSA'er siden jan. 2026 og for eksisterende siden apr. 2026.
   - Automatiske udvidelser.

   Dertil overskriver planlagte Google-importer langt mere end status og bud, og de tager Googles konverteringsmål og AI Max-indstillinger med. Assistenten skal sige på kortet, om disse ting er slået til, og foreslå at slå dem fra, hvor tekst og påstande skal styres.
4. **Konverteringer bogføres på klikdatoen.** De nyeste dage får derfor stadig konverteringer, indtil kampagnens konverteringsforsinkelse er gået. "Ekskluder de seneste 3 dage" er for kort til ROAS og CPA. Kolonnen Conversion delay viser, hvor længe man skal vente.
5. **Konverteringstal skal læses med forbehold:**
   - "Konverteringer" tæller kun mål med "Medtag i Konverteringer". "Alle konverteringer" tæller alt.
   - Datadrevet attribution (maj 2026) flytter kredit mellem kampagner.
   - Uden samtykkesignal stopper sporingen for al trafik fra EØS, UK og Schweiz.
   - Modellerede konverteringer kræver mindst 700 klik om ugen og er næppe aktive på en dansk konto.
   - Microsoft frasorterer ikke dobbelt- eller testordrer.
6. **Målændringer: Microsoft er blevet mere tilladende.** Mål kan ændres løbende i skridt på ca. 15 %, og effekten vurderes efter 1–2 konverteringscyklusser. Prompt og playbook er i dag indbyrdes uenige: 10–20 % og 7 dage mod 10–15 % og 2 uger. Begge skal harmoniseres. Det strenge "ingen målændringer i læring" holder ikke længere. Strategiskift, nye konverteringsmål og store budgetændringer forstyrrer stadig.
7. **Budjusteringer er signaler, ikke garantier.** Under automatiske strategier "informerer" de kun budet. Microsoft justerer også selv enhedsbud løbende, så −90 % mobil er ikke et hårdt loft; kun −100 % udelukker en enhed. Annoncegruppens lokationer, enheder og tidsplan erstatter kampagnens. Lokationshensigten er som standard "personer i eller som søger efter" området.
8. **Shopping og PMax:**
   - Siden maj 2025 afgør annoncerangering, ikke prioritet, om Performance Max eller Standard Shopping viser et produkt.
   - Det passer ikke, at "hver Shopping-kampagne bruger bud".
   - Roden "Alle produkter" kan efter dokumentationen ikke udelukkes.
   - Feeds og Google-importer udløber efter 30 dage, og så stopper produkterne.
9. **Dansk sprog og danske regler giver egne fælder:**
   - Negative søgeord rammer ikke bøjninger (brugt/brugte).
   - æ, ø og å må ikke stå i URL'er og stinavne.
   - Keyword Planner har nu danske data; reglen om "kun 6 lande" er forældet.
   - Brugerfladen findes ikke på dansk.
   - Ved Black Friday (27. nov. 2026) gælder 30-dages-reglen for førpriser.
   - Højst én pris eller procentsats pr. annonce, og intet hastesprog.
   - LinkedIn-målretning er ikke bekræftet for Danmark.
10. **Fem fejl i appens API-kald** rettes i koden i samme ændring: PMax-listegrupper, lokationshensigt, sitelinks med tom Description2, MaxCpc (611274) og ventetiden ved fejl 117. Flere mindre risici står tilbage (afsnit 4).

---

## 2. Område for område

### 2.1 Bud og budgetter

**Strategier og konvertering**
- Strategier pr. kampagnetype:
  - Søgning: Forbedret CPC, Maksimér klik, Maksimér konverteringer (± mål-CPA), Maksimér konverteringsværdi (± mål-ROAS) og Mål for visningsandel.
  - Standard Shopping: Forbedret CPC, Maksimér klik, Maksimér konverteringsværdi (± mål-ROAS) og Cost per sale.
  - PMax: kun Maksimér konverteringer eller Maksimér konverteringsværdi.

  Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [Performance Max API guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max?view=bingads-13).
- Manuel CPC findes kun for Audience display/video og hotel. På andre kampagnetyper ignoreres den uden fejl og bliver Forbedret CPC. Kilde: [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13).
- Selvstændig mål-CPA og mål-ROAS kan ikke vælges siden 4. aug. 2025. API'et konverterer stille til Maksimér med mål, og eksisterende kampagner og porteføljer beholder dem. Kilde: [BiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddingscheme?view=bingads-13).
- Konverteringskrav:
  - API-guiden siger, at strategien holder op med at optimere under 30 konverteringer på 30 dage. Kilde: [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13).
  - Microsoft anbefaler fra 18. nov. 2026 konverteringsbaseret start ved ≥5 konto-konverteringer og vurdering efter ca. 30 på 30 dage, på kampagne- eller porteføljeniveau. Kilde: [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
  - Tallet 15 stammer fra en lanceringsregel fra 2018, som Microsoft siden droppede. Kilde: [Microsoft blog, juli 2018 (snippet)](https://advertise.bingads.microsoft.com/en-in/blog/post/july-2018/automated-bidding-strategies-target-cpa-and-maximize-conversions).
- Kommer de fleste konverteringer mere end 7 dage efter klikket, eller uploades offline-konverteringer ikke dagligt, fraråder Microsoft Maksimér konverteringer og mål-CPA. Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).

**Læring og målændringer**
- Budene begynder at ændre sig inden for 2 timer, og læringen tager op til 2 uger. Skift af strategi, budget eller konverteringsindstillinger forlænger den. Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).
- Nov. 2026: "Targets can be changed at any time". Ændr i skridt på ca. 15 %, og vurder efter én konverteringscyklus. Kilde: [Microsoft blog, 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
- PMax: læring 2–4 uger eller 2–3 konverteringscyklusser, og 2 uger mellem målændringer. Kilde: [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices).

**Budjusteringer og målretning**
- Under automatiske strategier "informerer" budjusteringer budet, men styrer det ikke.
  - Interval −90 til +900 %; enheder −100 til +900 %, hvor −100 % udelukker.
  - Budjusteringer på lokationshensigt ignoreres uden fejl.

  Kilde: [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13); [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding).
- Microsoft justerer enhedsbud "in real time", så det faktiske bud kan være højere eller lavere. Kilde: [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding).
- Sådan lægges justeringer sammen:
  - Microsofts API-guide viser, at forskellige typer ganges (1,20 × 1,30 = +56 %), mens overlappende lokationer ikke lægges sammen; den mest specifikke gælder. Kilde: [Show Ads to Your Target Audience](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13).
  - LinkedIn-segmenter ganges også. Kilde: [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding).
  - Googles SA360-hjælp viser enhed og lokation lagt sammen (3P). Kilde: [SA360 Help](https://support.google.com/sa360/answer/9310548?hl=en).
- Annoncegruppens enheder og tidsplan erstatter kampagnens; de kombineres ikke. Kilde: [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13); [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion?view=bingads-13).

**Maks. CPC, sæsonjustering og dataudelukkelse**
- Maks. CPC:
  - Fjernet fra nye kampagner uden portefølje siden 1. okt. 2026.
  - Kan ikke tilføjes (611274), kun ændres eller fjernes.
  - Porteføljer beholder det.
  - Microsoft: "Keeping a Maximum CPC set on your campaigns is not recommended."

  Kilde: [Microsoft blog, 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13); [BiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddingscheme?view=bingads-13).
- Sæsonjustering:
  - Højst 14 dage og kun på kampagner med mål-CPA/-ROAS.
  - Procenten er den forventede ændring i konverteringsrate.
  - Siden maj 2026 også for porteføljer og delte budgetter.

  Kilde: [Seasonality adjustments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments); [Microsoft blog, 19. maj 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026).
- Dataudelukkelse:
  - Højst 14 dage; Microsoft anbefaler 7 eller færre.
  - Ikke i strategiens første 30 dage, og kun på kampagneniveau.
  - Påvirker ikke rapporteringen.

  Kilde: [Data exclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions).

**Budget og visningsandel**
- Dagsbudgettet er et mål:
  - Overforbrug holdes "usually" under 100 % over dagsbudgettet, men én API-side siger 20 %.
  - Månedsloftet håndhæves, og overforbrug over det refunderes.
  - Ændres budgettet midt i måneden, bliver loftet forbrug hidtil + nyt dagsbudget × resterende dage.
  - Ændringer virker inden for ca. en time.

  Kilde: [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [Discover your budget options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype); [BudgetLimitType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/budgetlimittype?view=bingads-13).
- Visningsandel tabt pga. budget taler for mere budget. Tabt pga. rang løses med bud, mål, annoncer og relevans. Kilde: [Report attributes](https://learn.microsoft.com/en-us/advertising/guides/report-attributes-performance-statistics?view=bingads-13); [Share of voice report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_imprsharereports).
- Microsoft lader automatiske kampagner slå deres mål, også når de er budgetbegrænsede. Kilde: [Microsoft blog, 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026).
- Søgeords- og annoncegruppebud ignoreres under alle automatiske strategier og i PMax. Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).
- Minimumsbud i DKK er 0,06. Kilde: [Currencies](https://learn.microsoft.com/en-us/advertising/guides/currencies?view=bingads-13); [What gets imported from Google Ads](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo).

**Betyder for assistenten:**
- Erstat 15-reglen med ≥5 for at starte og ca. 30 på 30 dage for at vurdere (P5, Q16).
- Foreslå aldrig maks. CPC som nyt håndtag (P32, Q8).
- Brug 10–15 % til mål og vurder efter konverteringscyklusser (P4, P25, Q3).
- Sig, at −90 % mobil er et signal og ikke et loft (P8, P27).
- Brug sæsonjustering kun til mål-CPA/-ROAS (P31).

### 2.2 Måling og data

**Konverteringsmål og attribution**
- Kun mål med "Medtag i Konverteringer" indgår i Konverteringer, Omsætning, CPA og ROAS og bruges af budstrategien. Alle konverteringer tæller alt, også view-through. Kilde: [Conversions versus All conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_convsvsallconvs); [ConversionGoal](https://learn.microsoft.com/en-us/advertising/campaign-management-service/conversiongoal?view=bingads-13).
- Konverteringsvindue og tælling:
  - Vinduet er som standard 30 dage (fra 1 minut til 90 dage), og tælling er som standard "Alle".
  - Ændringer af vindue og tælling gælder kun fremad.
  - Microsoft frasorterer ikke test-, svindel- eller dobbeltkonverteringer.

  Kilde: [How does conversion tracking work?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uetv2howctworks).
- Konverteringer bogføres på klikdatoen. Kolonnen Conversion delay viser antal dage til 90 % af konverteringerne og findes for klik fra 1. juni 2025. Kilde: [Understanding conversion delay](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_conversiondelay).
- Attribution er som standard sidste klik pr. mål. Datadrevet attribution blev rullet ud til alle i maj 2026 og flytter kredit mellem kampagner. Kilde: [AttributionModelType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/attributionmodeltype?view=bingads-13); [Microsoft blog, 19. maj 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026).
- Microsofts egne grunde til afvigelser fra Google, GA4 og webshoppen:
  - Konverteringer bogføres på klikdato.
  - Konverteringer på tværs af enheder tælles med.
  - GA4 fordeler kredit på tværs af kanaler.
  - Folk, der køber via andre kanaler, tælles aldrig.

  Kilde: [Discrepancy article](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_baawdiscrepancy).
- Google-import har siden ca. juni 2024 som standard også importeret Googles konverteringsmål. Kilde: [Search Engine Roundtable, 6. jun. 2024](https://www.seroundtable.com/microsoft-advertising-import-google-ads-conversion-data-37520.html).

**Samtykke**
- Siden 5. maj 2025 kræves et samtykkesignal for EØS, UK og Schweiz: UET Consent Mode (ad_storage) eller TCF 2.0, aldrig begge.
  - Uden noget signal stopper UET-konverteringer og remarketing.
  - Microsoft anbefaler Advanced Consent Mode, og Cookie Information er blandt de understøttede CMP'er.

  Kilde: [Microsoft blog, 31. mar. 2025](https://about.ads.microsoft.com/en/blog/post/march-2025/providing-user-consent-signals-on-your-microsoft-campaigns-by-may-5-2025); [FAQ – UET and user consent](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_consentfaq); [Setting up UET for consent mode](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_consent).
- Modellerede konverteringer er brøktal i Konverteringer og kræver mindst 700 annonceklik om ugen i markedet. Kilde: [FAQ – Modeled conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_modeledconversionsfaq).

**Offline-konverteringer**
- De kræver MSCLKID eller hashet e-mail/telefon og skal uploades inden for 90 dage efter sidste klik. Vent 2 timer efter oprettelse af målet; data vises inden for op til 6 timer. Tidszonen angives pr. række eller i skabelonens Parameters-række. Kilde: [Tracking offline conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uetv2offlineconversion).

**Rapportering og forsinkelser**
- Forsinkelser:
  - Klik ca. 1 time.
  - UET-konverteringer 2 timer.
  - Offline-konverteringer 5 timer.
  - Søgetermer 3 timer.
  - Share-of-voice 16 timer.
  - Auktionsindsigt 2,5 dage.
  - PMax-søgetermindsigt 3 dage.

  Data gemmes i 36 måneder. Kilde: [Is my data updated in real time?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_datafreshness).
- Kvalitetsresultat opdateres 14–18 timer efter UTC-døgnets slutning. Kilde: [KeywordPerformanceReportColumn](https://learn.microsoft.com/en-us/advertising/reporting-service/keywordperformancereportcolumn?view=bingads-13).
- API-rapporter bruger Pacific-tid, medmindre ReportTimeZone sættes, og "books close" efter ca. 3 timer. Kilde: [Reports guide](https://learn.microsoft.com/en-us/advertising/guides/reports?view=bingads-13).
- Søgetermrapporten viser kun termer med "a significant number of clicks". Kilde: [Run a search term report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchqueryreport).

**Eksperimenter og diagnoser**
- Eksperimenter: 50/50, 2 uger ens og mindst 2 uger A/B. Signifikans vises med farver, og Microsoft oplyser ikke sit sikkerhedsniveau. Kilde: [Examples and tips for experiments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_bestpractices); [Experiments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_about).
- Microsofts diagnosefelt melder "No conversions in seven days—your tracking may need to be fixed". Kilde: [Campaign diagnostics tile](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_campaign_diagnostictiles).
- Magento/Adobe Commerce står ikke blandt Microsofts UET-opsætningsguider. Kilde: [msa-help toc](https://learn.microsoft.com/en-us/advertising/msa-help/toc.json).

**Betyder for assistenten:**
- Udeluk de nyeste klikdage efter konverteringsforsinkelsen, ikke bare 3 dage (P1, Q1, Q26).
- Nævn altid, hvilken konverteringskolonne et tal kommer fra (P21, Q26).
- Ved et fald til nul: tjek samtykke og ændrede mål før annoncerne (P20, Q1).
- Gå ikke ud fra, at modellering fylder hullet efter afviste cookies.
- Skriv ikke "95 % sikkerhed" om Microsofts eksperimenter (P28).

### 2.3 Søgeord, negativer og søgetermer

**Matchtyper og AI Max**
- Der er tre matchtyper, og bred er standard. Nære varianter (synonymer, samme hensigt) gælder for eksakt og frase. Gamle BMM-søgeord ("+ord") kører som bred siden 15. mar. 2023. Kilde: [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions); [About broad match](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_broadmatch); [SER, 2023](https://www.seroundtable.com/microsoft-advertising-broad-match-modifier-bing-35063.html).
- AI Max:
  - Officielt slået til som standard for nye søgekampagner siden aug. 2026.
  - Udvidede match vises som "AI optimized", og AI Max respekterer negativer.
  - Microsofts liaison sagde i SER, at det er opt-in; den officielle blog er nyere.

  Kilde: [AI Max blog, 27. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [MatchType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/matchtype?view=bingads-13); [SER, 20. aug. 2026](https://www.seroundtable.com/microsoft-advertising-ai-max-41909.html).

**Normalisering og dubletter**
- Store og små bogstaver samt tegnsætning ignoreres. Accenter fjernes ikke, og ental og flertal er forskellige søgeord. Det samme gælder mellemrum: "bikerepair" er ikke en dublet af "bike repair". Dubletter efter normalisering tillades, men giver ingen ekstra dækning. Kilde: [About duplicate keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_normalization).
- Ændring af matchtype: Keyword-objektet siger "Update: Optional", men fejlkoden 1545 `KeywordMatchTypeChangeNotAllowedInUpdate` findes. Kilderne er uenige. Kilde: [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes).

**Negative søgeord**
- Kun eksakt og frase. Varianter filtreres ikke, så flertal og stavefejl skal tilføjes hver for sig. Mange tegn er ikke tilladt (bl.a. - . , / &), og negativer på søgeordsniveau ignoreres. Kilde: [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords).
- Niveauer:
  - Konto: én liste, der gælder Søgning, Shopping og PMax.
  - Kampagne og annoncegruppe: lægges sammen.
  - Delte lister: til kampagner eller kontoen, aldrig annoncegrupper.

  Kilde: [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords); [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13).
- Grænser:
  - 20.000 pr. kampagne og pr. annoncegruppe.
  - 20 lister à 5.000.
  - Kontolisten: 1.000 ifølge hjælpen, 5.000 ifølge bloggen fra marts 2026.

  Kilde: [Entity limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13); [Microsoft blog, marts 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026).
- PMax har haft negativer siden marts 2026, men de gælder kun Søgning- og Shopping-inventaret. Kilde: [Microsoft blog, marts 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026).
- Kør konfliktrapporten en dag efter, at frasenegativer er tilføjet på kampagneniveau. Kilde: [Negative keyword conflicts](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_intentionalnkwconflicts).

**Søgetermer og research**
- Søgetermrapporten viser kun termer med betydelige klik. Resten samles i "Other search terms". Kilde: [Search terms → keywords/negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_searchterm).
- Keyword Planner:
  - "All Microsoft Ads supported markets are now available", og Danmark har været et marked siden dec. 2022.
  - En streg betyder for lidt data.
  - Tallene er afrundede og tager ikke højde for matchtype.
  - Det foreslåede bud er et minimum.

  Kilde: [Keyword planner](https://about.ads.microsoft.com/en/tools/planning/keyword-planner); [Keyword planner statistics](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_keywordplanner_statisticstrafficestimates).
- Status "Low search volume" holder søgeordet inaktivt og tjekkes igen ugentligt. Kilde: [Delivery status](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialstatus).

**Kvalitetsresultat og DSA**
- Kvalitetsresultatet bruges ikke i auktionen og påvirker ikke pris. Det bygger på eksakt match de sidste 30 dage, og dækningen for frase og bred er lavere på internationale markeder. Kilde: [Quality score in depth](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore).
- DSA findes i Danmark og understøttes "until further notice". Kilde: [About DSA](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dynamicsearchads); [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max).

**Betyder for assistenten:**
- Danske bøjninger og sammensætninger skal have hver sin negativ (P7, Q18).
- Spild fundet i søgetermrapporten er et minimum (Q17).
- Danske søgetal findes nu, men tomme felter er "ingen data" (Q27).
- Nye søgekampagner skal have AI Max eksplicit til eller fra (Q19).
- Et tomt kvalitetsresultat er ikke et dårligt kvalitetsresultat (P17).

### 2.4 Kontostruktur og indstillinger

**Konto og kampagne**
- Valuta vælges ved oprettelse og kan aldrig ændres. Kilde: [Choosing your account currency](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_currency).
- Tidszonen er en kontoindstilling siden marts 2022, og kampagnefeltet er markeret som forældet. En ændring flytter datoer, rapporter og dagens forbrug. Kilde: [Changing your account time zone](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13).
- Kampagnetypen kan ikke ændres, og nye kampagner og annoncegrupper starter som pauset. Politiske kampagner (IsPolitical=true) afvises. Kilde: [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13).

**Lokationer**
- Lokationshensigten er som standard PeopleInOrSearchingForOrViewingPages.
  - Valgmuligheden "kun søger efter" blev udfaset i april 2024.
  - Hensigten kan ikke slettes.

  Kilde: [LocationIntentCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationintentcriterion?view=bingads-13); [IntentOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/intentoption?view=bingads-13).
- En ny API-kampagne uden kriterier vises i hele verden. Kilde: [Show Ads to Your Target Audience](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13).
- Har annoncegruppen bare én lokation, udelukkelse eller radius, arves intet af kampagnens geo-opsætning. Radius kan ikke bruges til udelukkelse. Kilde: [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13); [How to prevent your ads from showing](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addexclusions).

**Netværk**
- Netværk vælges pr. annoncegruppe, og der er to muligheder. "Syndicated search only" blev udfaset i juli 2024. Søgeannoncer kan også vises som Audience-annoncer; Microsoft anbefaler website-udelukkelser for at undgå det. Kilde: [Network](https://learn.microsoft.com/en-us/advertising/campaign-management-service/network?view=bingads-13); [Ad distribution settings](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutaddistributionhidden); [What are Search ads?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_searchnetcontentnet).

**Tidsplan og datoer**
- Tidsplan:
  - Højst 7 perioder pr. dag og 49 i alt.
  - Perioder kan ikke redigeres, kun erstattes.
  - Budjusteringer går fra −90 til +900 %.
  - Kontoens tidszone bruges som standard; kilderne er uenige om den søgendes.

  Kilde: [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion?view=bingads-13); [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13).
- Datoer:
  - I Søgning og Shopping hører datoer til annoncegruppen.
  - En udløbet annoncegruppe genoplives ved at forlænge slutdatoen.
  - Startdatoen låses, når den er nået.
  - En slutdato fjernes ved at sætte 2. jan. 2050 eller senere.

  Kilde: [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13).

**Import, automatik og konto-indstillinger**
- Planlagte Google-importer opdaterer som standard:
  - status, bud, budstrategier og budgetter
  - lokationer, enheder og annonceplan
  - URL'er, website-udelukkelser, negative lister, sprog og netværk

  De hæver også bud og budgetter til minimum. Importer kan ikke fortrydes. Kilde: [GoogleImportOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13); [What gets imported](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo); [Change history](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changehistorygraph).
- Auto-anvendte anbefalinger anvendes efter 7 dages gennemsyn. Kilde: [Auto-apply recommendation settings](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_autoapplyrec).
- MSCLKID-auto-tagging er slået til som standard. For final URL suffix gælder det laveste niveau, og niveauer kombineres ikke. Kilde: [Auto-tagging of Microsoft Click ID](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_microsoftclickid); [Using a final URL suffix](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_upgradeurl_finalurlsuffix).
- Dansk er ikke et visningssprog i brugerfladen, men er et annoncesprog. Kilde: [About language options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutlanguageoptions); [Ad languages](https://learn.microsoft.com/en-us/advertising/guides/ad-languages?view=bingads-13).

**Betyder for assistenten:**
- Tjek annoncegruppens egen målretning, før den siger "kampagnen kører 08–22" (Q14).
- "Kun tilstedeværelse" er et forretningsvalg, der skal nævnes (P8).
- Brug engelske menunavne (P34, P35, P38).
- Tidszonereglen i prompten er forældet (Q23).
- Google-importen forklarer mange "ændringer af sig selv" (P39).

### 2.5 Annoncer og udvidelser

**RSA-grænser og fastgørelse**
- RSA:
  - 3–15 overskrifter à 30 tegn og 2–4 beskrivelser à 90 tegn.
  - Stinavne à 15 tegn, uden "/".
  - Domæne + stinavne højst 67 tegn.
  - Emojis tæller dobbelt.

  Kilde: [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad?view=bingads-13).
- Højst 3 aktive RSA'er pr. annoncegruppe. Kilde: [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13).
- Fastgørelse:
  - Mindst ét element skal kunne udfylde hver position.
  - Microsoft siger "avoid pinning".
  - Microsofts FAQ anbefaler samtidig at fastgøre position 1 og 2, så Microsoft modsiger sig selv.

  Kilde: [AssetLink](https://learn.microsoft.com/en-us/advertising/campaign-management-service/assetlink?view=bingads-13); [Best practices for RSAs](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_rsa_bestpractices); [About RSAs](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_responsivesearchads).

**Annoncestyrke og test**
- Annoncestyrken er Poor/Average/Good/Excellent, og den nye model scorer 0–100 %. Microsoft skriver, at scoren "doesn't guarantee performance results". Elementvurderinger er noget andet: Low/Good/Best/Unrated/Learning. Kilde: [About Ad strength](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_adstrength); [AssetLink](https://learn.microsoft.com/en-us/advertising/campaign-management-service/assetlink?view=bingads-13).
- Uafhængige studier (Google-data):
  - Annoncestyrke fulgte ikke resultaterne. Kilde: [Optmyzr 2024](https://www.optmyzr.com/blog/google-ad-strength-study/).
  - To RSA'er pr. gruppe gav det bedste løft i konverteringsrate. Kilde: [Optmyzr 2023](https://www.optmyzr.com/blog/optmyzr-study-responsive-search-ad-performance/).
- Microsofts testminimum er 1.000 visninger og en uge pr. annonce. Kilde: [About RSAs](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_responsivesearchads).

**Autogenererede elementer**
- Slået til som standard for nye RSA'er siden 15. jan. 2026 og for eksisterende uden 15+4 elementer fra april 2026. Teksten tages fra landingssiden. Kilde: [Microsoft blog, 15. jan. 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026); [Microsoft blog, 16. apr. 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026).

**Politikker**
- Stil:
  - Ét ! eller ? pr. sætning og ingen tegn i træk.
  - Højst ét ord med kun versaler, og beskrivelser i sætningsstil.
  - "Only one price or % allowed per ad".
  - Intet hastesprog ("supplies are running out").
  - URL'er kun med ASCII-tegn (ingen æ/ø/å).

  Kilde: [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1).
- I EU skal priser være inkl. moms og afgifter, og fragt skal oplyses. Påstande skal kunne dokumenteres i annoncen eller på landingssiden. Kilde: [Pricing policy](https://help.ads.microsoft.com/#apex/ads/en/60381/-1); [Misleading content](https://help.ads.microsoft.com/#apex/ads/en/60357/-1).
- Alle URL'er i en annoncegruppe skal have samme basisdomæne. Kilde: [Ad Relevance and Landing Page Quality](https://help.ads.microsoft.com/#apex/ads/en/60215/-1).

**Redaktionel gennemgang**
- De fleste gennemgange tager under 48 timer.
- En ny annonce i offline-gennemgang kan læses som Disapproved via API'et, mens brugerfladen viser "pending".
- En opdateret annonce er reelt pauset, indtil den er godkendt igen.

Kilde: [The editorial review](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editprocess); [Editorial Review and Appeals](https://learn.microsoft.com/en-us/advertising/guides/editorial-review-appeals?view=bingads-13).

**Udvidelser**
- Udvidelser ligger i et kontobibliotek og skal tilknyttes. Udvidelser fra højere niveauer kan vises sammen med lavere niveauers; en ældre note på samme side siger, at annoncegruppen overskriver. Kilde: [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions?view=bingads-13); [About ad extensions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadextensions).
- Grænser:
  - Sitelink: tekst højst 25 tegn med beskrivelser og 35 uden; begge beskrivelser er krævet.
  - Callouts: 2–20 pr. enhed.
  - Promotion: vare højst 20 tegn og kode højst 15; DKK og dansk understøttes, og PercentOff 10 betyder 10 %.

  Kilde: [SitelinkAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension?view=bingads-13); [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13); [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension?view=bingads-13).
- Opkaldsudvidelsen vises kun på smartphones i Danmark. Kilde: [Call extensions help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addcallextension).
- Automatiske udvidelser (bl.a. længere overskrifter og dynamiske beskrivelser) er slået til og kan kun slås fra på kontoniveau. Kilde: [Automated extensions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_automatedextensions); [Opting out](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_automatedextensionsoptout).

**Betyder for assistenten:**
- Tjek og nævn autogenererede elementer og automatiske udvidelser (P9, Q19).
- Tilføj reglerne om én pris, ASCII-URL'er og stinavne uden "/" (P10, P33, Q20).
- Kald ikke en ny annonce "afvist" alene ud fra API-status (Q25).
- Fastgørelse af søgeordet er teamets eget valg, ikke Microsofts regel (P33).

### 2.6 Shopping og Performance Max

**Merchant Center**
- Danmark er et fuldt understøttet marked for Shopping og produktannoncer. Kilde: [Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads).
- Feeds:
  - Feeds og Google-importer udløber efter 30 dage.
  - Nye feeds kan tage op til ca. 72 timer.
  - Kun automatisk download fra URL har indbygget planlægning.

  Kilde: [Creating and organizing feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog); ["Product offers not found"](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_error); [Import from GMC](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmc_gmcimportintro).
- Typiske afvisninger:
  - Pris eller lagerstatus i feedet matcher ikke landingssidens microdata.
  - robots.txt blokerer Bing eller adixbot.

  Kilde: [Troubleshoot Merchant Center errors](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcerrormessages).
- Feltregler:
  - excluded_destination ignoreres.
  - product_type matches som én samlet streng.

  Kilde: [What feed attributes can I use](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcgoogleattributes).
- Varenumre: Microsofts sider er uenige om store og små bogstaver, og forskellig skrivemåde kan give dubletter. Kilde: [Products Resource](https://learn.microsoft.com/en-us/advertising/shopping-content/products-resource); [Managing your Products](https://learn.microsoft.com/en-us/advertising/shopping-content/manage-products).

**Prioritet og konkurrence mellem kampagner**
- Standard Shopping mod Standard Shopping: højeste prioritet vinder "regardless of bid", medmindre produktet filtreres fra. Kilde: [Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview).
- PMax mod Standard Shopping på samme produkter: siden maj 2025 vinder den højeste annoncerangering. Kilde: [Microsoft blog, juni 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june).
- Søgning med eksakt match går forud for PMax. Kilde: [About Performance Max](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax).
- Butik og salgsland kan ikke ændres efter oprettelse; det gælder også butikken i PMax. Kilde: [Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices); [Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax).

**Produktgrupper**
- Produkttræet:
  - Roden skal være "All" og biddable.
  - Hver underopdeling skal have et "alt andet"-blad.
  - Hver biddable enhed skal have et bud.
  - Et kald gælder én annoncegruppe, og alt eller intet gennemføres.
  - En ændret betingelse kræver sletning og ny tilføjelse med nyt id.

  Kilde: [ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions).
- Bulk-feltet Bid "only applicable for eCPC", men er stadig krævet ved tilføjelse. Kilde: [Bulk Ad Group Product Partition](https://learn.microsoft.com/en-us/advertising/bulk-service/ad-group-product-partition).

**Budstrategier i Shopping**
- Shopping-strategier: se 2.1. Om Maksimér konverteringer kan vælges i Standard Shopping er uklart; Microsofts hjælpeside siger begge dele. Kilde: [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).

**Performance Max**
- Grundregler:
  - Uden konverteringsmål kører PMax på Maksimér klik.
  - Intet delt budget og ingen portefølje.
  - Op til 100 asset-grupper og 50 søgetemaer pr. gruppe.
  - Website-udelukkelser kun på kontoniveau.
  - Budget op til 2–3 gange de kampagner, PMax erstatter.
  - Mål-ROAS først efter 30 konverteringer på 30 dage.

  Kilde: [Performance Max guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max); [Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax); [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices).
- PMax-rapportering i 2026:
  - Søgetermer, landingsside og website-rapport.
  - Auktionsindsigt var "coming soon" i maj; oktober-bloggen siger, at den er tilgængelig.

  Kilde: [Microsoft blog, maj 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/providing-more-transparency-for-your-performance-max-campaigns); [Microsoft blog, 28. okt. 2026](https://about.ads.microsoft.com/en/blog/post/october-2026/build-steer-and-measure-your-campaigns-with-ai-whats-new-in-microsoft-advertising-this-october).
- Sponsored Products findes kun i USA og UK. Kilde: [Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads).

**Betyder for assistenten:**
- Prioritet afgør ikke længere konkurrencen med PMax (P15, Q12).
- Spørg ikke om bud til Shopping-grupper under Maksimér-strategier (Q10).
- Foreslå at pause annoncegruppen frem for at udelukke "Alle produkter" (Q11).
- Udløbne feeds er en standarddiagnose for "ingen visninger" (Q5).

### 2.7 Benchmarks og danske/EU-regler

**Benchmarks og publikum**
- Der findes ingen pålidelige Microsoft-benchmarks og intet for Danmark eller Europa. De udbredte tal (CPC 1,54 $, CTR 2,83 %) kan ikke spores til en kilde. LocaliQ/WordStream er amerikanske og Google-tunge. Kilde: [SearchLab (snippet)](https://searchlab.nl/en/statistics/microsoft-ads-statistics-2026); [WordStream 2026 (snippet)](https://www.wordstream.com/blog/2026-google-ads-benchmarks).
- Påstanden om "billigere CPC" er omstridt. Kilde: [Adzooma (snippet)](https://adzooma.com/?p=22567).
- Bing har ca. 8–10 % af danske søgninger og ca. 13–14 % på desktop. Kilde: [StatCounter DK (snippet)](https://gs.statcounter.com/search-engine-market-share/all/denmark); [StatCounter DK desktop (snippet)](https://gs.statcounter.com/search-engine-market-share/desktop/denmark).
- LinkedIn-profilmålretning nævnes kun for USA, CA, UK, AU, FR og DE. Kilde: [help 56905 (snippet)](https://help.ads.microsoft.com/apex/index/3/en/56905); [Microsoft blog, 4. feb. 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february).

**Politiske annoncer og gennemsigtighed**
- Microsoft tillader ingen politiske annoncer. Siden sep. 2025 skal kampagner erklæres politiske eller ej (IsPolitical), og emnebaserede annoncer i EU kræver godkendelse. Kilde: [API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13); [Issue-based advertising, EU](https://about.ads.microsoft.com/en/forms/policies/issue-based-advertising-program-enablement-european-union).
- Alle annoncer på Bing i EU ligger offentligt i Ad Library, som kan bruges til konkurrentresearch. Kilde: [help 60180 (snippet)](https://help.ads.microsoft.com/apex/index/3/en/60180).

**Danske prisregler og varemærker**
- Førpris:
  - Ved en nedsættelse skal førprisen være den laveste pris de seneste 30 dage, og den skal kunne dokumenteres.
  - "Black Friday", "Black Week", "spar" og "udsalg" tæller som prisnedsættelse.
  - Black Friday-prisen kan blive førprisen i december.
  - Black Friday 2026 er 27. nov.

  Kilde: [DI Handel, 12. okt. 2026 (snippet)](https://www.danskindustri.dk/brancher/di-handel/nyhedsarkiv/nyheder/2026/10/black-friday-kan-fa-betydning-for-julehandlen-pas-pa-30-dagesreglen/); [Tænk (snippet)](https://taenk.dk/raadgivning/markedsfoering/nye-regler-tilbudspriser); [Dansk Erhverv, sep. 2026 (snippet)](https://www.danskerhverv.dk/presse-og-nyheder/nyheder/2026/september/se-de-gode-rad-sadan-far-du-black-friday-succes-i-ai-araen/).
- En EU-kontrol fandt, at ca. hver tredje forhandler viste Black Friday-rabatter forkert. Kilde: [Europa-Kommissionen, 26. mar. 2026](https://commission.europa.eu/news-and-media/news/eu-check-reveals-misleading-sales-practices-online-2026-03-26_en).
- Varemærker (EU): det er lovligt at byde på en konkurrents varemærke, hvis annoncen ikke slører, hvem varen kommer fra. Kilde: [SEL om Interflora (snippet)](https://searchengineland.com/in-interflora-case-eu-oks-bidding-on-trademarks-with-some-restrictions-94114).

**AI-mærkning og Copilot**
- Annoncøren afgør selv, om AI-genereret indhold skal mærkes. Kilde: [Microsoft blog, 19. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november).
- Annoncer i Copilot og Bing AI Overviews kommer fra de eksisterende kampagner. Der findes ingen dokumenteret særskilt fravalg eller rapport for dem. Kilde: [Microsoft blog, 19. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november).

**Betyder for assistenten:**
- Sammenlign med kontoens egen historik og break-even-ROAS, ikke med "gennemsnit" (Q19).
- Kræv en dokumenteret 30-dages førpris ved prisnedsættelser (P14, Q29).
- Antag ikke LinkedIn-data for Danmark (P6, P36).
- Kampagner skal erklæres ikke-politiske ved oprettelse (se afsnit 4).

### 2.8 Microsoft Ads API v13

**Grænser pr. kald og pr. enhed**

| Operation | Pr. kald |
|---|---|
| AddKeywords | 1.000 |
| UpdateAdGroups | 1.000 (en guide siger 100) |
| Kampagnekriterier, udvidelser, tilknytninger | 100 |
| Produkttræ og listegrupper | 5.000 |

Kilde: [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits); [AddKeywords](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addkeywords); [UpdateAdGroups](https://learn.microsoft.com/en-us/advertising/campaign-management-service/updateadgroups); [AddCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions).

Grænser pr. enhed:
- 3 aktive RSA'er pr. annoncegruppe.
- 2–20 callouts.
- Præcis 3 enheder (alle eller ingen).
- 7 tidsperioder pr. dag.

**Status og datoer**
- Kun Active og Paused kan sættes; Expired er skrivebeskyttet. Kilde: [CampaignStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaignstatus); [AdGroupStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroupstatus).
- Dato-fejl:
  - 1215/1231: annoncegruppen er udløbet.
  - 1216: startdatoen er nået.
  - En slutdato fjernes med 2. jan. 2050.

  Kilde: [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes); [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup).

**Opdateringer, der gør noget andet end forventet**
- Normalt betyder et tomt felt "ingen ændring". Undtagelser:
  - En tom streng sletter (fx Path1/2, Sitelink Description2).
  - Udelades Sitelink Description1 ved opdatering, fjernes den.
  - Keyword-bud sat til null sletter buddet.
  - En tidsplan erstattes altid helt.
  - RSA-overskrifter, der sendes, erstatter alle eksisterende.

  Kilde: [SitelinkAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension); [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword); [Schedule](https://learn.microsoft.com/en-us/advertising/campaign-management-service/schedule); [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad).
- Målretningskriterier (alder, tid, enhed, køn, lokation, lokationshensigt, radius) skrives med `CriterionType: "Targets"` og læses én type ad gangen. Kilde: [AddCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions); [CampaignCriterionType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaigncriteriontype).

**Udvidelser og budstrategier**
- Udvidelser tilføjes alt-eller-intet; tilknytninger tillader delvis succes. PercentOff 10,0 betyder 10 %. Kilde: [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions); [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension).
- TargetRoas er et forhold: 3,0 betyder 300 %. Kilde: [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme).
- Budstrategien MaxConversionValue læses kun tilbage med ReturnAdditionalFields. Kilde: [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign).

**Rapporter**
- Rapporter er asynkrone: download-URL'en udløber efter 5 minutter, og Microsoft foreslår at polle hvert 2.–15. minut. Kilde: [Request and Download a Report](https://learn.microsoft.com/en-us/advertising/guides/request-download-report).
- Timedata gemmes i 6 måneder, søgetermer 1 måned og geografi 14 dage. Kilde: [Reporting Data Retention](https://learn.microsoft.com/en-us/advertising/guides/report-data-retention-time-periods).
- Visningsandel kan ikke kombineres med timedata (2053). Kilde: [Reports guide](https://learn.microsoft.com/en-us/advertising/guides/reports).

**Fejl og genforsøg**
- Fejlkoder og ventetid:
  - 117: vent 60 sekunder.
  - 207 i Reporting: vent på de kørende rapporter. I Customer Management betyder samme nummer en adressefejl.
  - 4204 (Bulk): vent op til 15 minutter.
  - 0: midlertidig fejl, prøv igen senere.

  Kilde: [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes); [Handle service errors](https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions).
- SOAP lukker 31. jan. 2027. Det rammer ikke appen, som kun bruger REST. Kilde: [Migrate to REST API](https://learn.microsoft.com/en-us/advertising/guides/migrate-to-rest).

**Betyder for assistenten:**
- Prompten skal nævne de præcise fejlkoder og ventetider (P23, Q28).
- Læs altid tilbage efter skrivning, så tavse konverteringer opdages; det gør appen allerede.
- Koden har konkrete fejl (afsnit 4).

---

## 3. Hvad playbooken og prompten siger i dag, som er forkert eller mangler

Fuld ordlyd til alle rettelser står i `playbook_forslag.md` under id'et i sidste kolonne.

| Nuværende udsagn (fil) | Hvad kilderne siger | Kilde | Forslag til ny formulering |
|---|---|---|---|
| "Microsoft stops optimising below 15 conversions in 30 days; the playbook wants at least 30." (prompt.ts) | Intet belæg for 15. API-guiden siger 30 på 30 dage. Siden nov. 2026: start konverteringsbaseret ved ≥5 konto-konverteringer. | [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [Blog 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising) | Q16: "start new campaigns on a conversion-based strategy when the account has at least 5 conversions … evaluate after about 30 conversions in 30 days … There is no documented 15-conversion floor." |
| "Under det: anbefal manuel/Forbedret CPC eller samling af kampagner." (microsoftAds.ts) | Manuel CPC findes ikke i Søgning/Shopping. Microsoft anbefaler konverteringsbaseret start ved ≥5. | [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13); [Blog 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising) | P5: "…når kontoen har mindst 5 konverteringer – under 5: Forbedret CPC … Manuel CPC findes ikke i Søgning og Shopping." |
| "the levers are … the max CPC cap" (prompt.ts) | Nyt loft afvises (611274) på kampagner uden portefølje, og Microsoft fraråder lofter. | [Blog 31. aug. 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13) | Q8: "A max CPC cap is no longer a lever …" + P32 i playbooken. |
| "Manual CPC only for Audience campaigns" (prompt.ts) | Kun Audience display/video og hotel; native mistede det i maj 2024. | [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13) | Q16/Q7: "Manual CPC only for Audience display/video and hotel campaigns". |
| "Så skal den have ro – foreslå ikke ændringer i budget, mål eller strategi." og "Ingen ændringer i budget, mål eller strategi på kampagner i læringsfase." (microsoftAds.ts) | "Targets can be changed at any time" i ca. 15 %-skridt. Strategiskift, mål og store ændringer forstyrrer. | [Blog 18. nov. 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising) | P4/P30: "…ingen skift af strategi eller konverteringsmål og ingen store budgetændringer … Mål kun i små skridt (ca. 15 %)." |
| "Mål-CPA/-ROAS: ±10–15 % pr. skridt, mindst 2 uger mellem ændringer." (microsoftAds.ts) mod "bids and targets in steps of 10–20 % … 7 days" (prompt.ts) | Microsoft: 10–15 %. Vent én konverteringscyklus (Søgning/Shopping) eller 2 uger (PMax). Filerne modsiger hinanden. | [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices) | P25 og Q3/Q4: mål 10–15 %, tidligst efter 7 dage og 1–2 cyklusser; PMax 2 uger. |
| "De ganges sammen (+10 % og +20 % = +32 %)" (microsoftAds.ts) | Bekræftet af API-guiden for forskellige typer. Mangler: overlappende lokationer lægges ikke sammen, og justeringer er kun signaler under automatiske strategier. | [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13); [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13) | P27: "Forskellige typer ganges sammen … Overlappende lokationer lægges ikke sammen … kun signaler …" |
| "standard: mobil og tablet -90 %" (microsoftAds.ts) | Gyldigt, men under automatiske strategier kun et signal. Microsoft justerer enhedsbud løbende, og kun −100 % udelukker. | [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding) | P8: "-90 % er ikke et hårdt loft … kun -100 % udelukker en enhed". |
| "ekskluder de seneste 3 dage" (microsoftAds.ts) / "the newest 1–3 days are incomplete" (prompt.ts) | Konverteringer bogføres på klikdato, og der findes en kolonne for konverteringsforsinkelse. | [Conversion delay](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_conversiondelay) | P1, Q1, Q26: "ekskluder de nyeste klikdage … Brug kampagnens konverteringsforsinkelse". |
| "impression share data arrives 14–18 hours after the UTC day ends" (prompt.ts) | 14–18 timer står ved kvalitetsresultat. Share-of-voice: op til 16 timer. (Én note læser report-attributes-guiden som 14–18 t. for visningsandel.) | [KeywordPerformanceReportColumn](https://learn.microsoft.com/en-us/advertising/reporting-service/keywordperformancereportcolumn?view=bingads-13); [Data freshness](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_datafreshness) | Q26: "quality score … 14–18 hours …; impression share can lag up to about 16 hours". |
| "Microsoft documents keyword ideas only for the US, UK, Canada, Australia, France and Germany." (prompt.ts) | Forældet: alle understøttede markeder er med, også Danmark. | [Keyword planner](https://about.ads.microsoft.com/en/tools/planning/keyword-planner) | Q27: "Microsoft now says all supported markets are available, Denmark included, but Danish data is thin …" |
| "Duplicates that only differ in case, accents or punctuation are rejected." (prompt.ts) | Dubletter efter normalisering tillades (ingen dækning). Accenter fjernes ikke. | [About duplicate keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_normalization) | Q21: "…add no coverage …; accents, æ/ø/å, singular/plural and spacing make separate keywords." |
| "negative keywords (Exact/Phrase) at campaign or ad group level" (prompt.ts) | Også kontoniveau, delte lister (aldrig annoncegrupper) og PMax (siden marts 2026). | [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords); [Blog marts 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026) | Q15 og Q22. |
| (mangler) Negativer matcher ikke varianter. | Flertal, stavefejl og varianter filtreres ikke. | [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords) | P7, Q18: "negatives don't match close variants … brugt/brugte, gratis/gratisfragt". |
| "A campaign's time zone cannot be changed once it has (or has had) active or paused ad groups." (prompt.ts) | Forældet: tidszonen er en kontoindstilling siden marts 2022. | [Changing your account time zone](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone) | Q23: "Time zone is an account setting …" |
| "When the campaign uses bids (Enhanced/Manual CPC, and every Shopping campaign)" (prompt.ts) | Shopping kan køre Maksimér-strategier, hvor produktgruppebud ignoreres. | [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy) | Q10: "(Enhanced CPC – Search or Shopping; Shopping campaigns on Maximize … ignore product group bids)". |
| "excluding "Alle produkter" / "alt andet"" (prompt.ts) | Roden skal være biddable; kun "alt andet" kan udelukkes. | [ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions) | Q11: "the root … must stay biddable … pause the ad group". |
| "a higher-priority Shopping campaign takes the item's traffic" (prompt.ts) | Gælder kun Standard mod Standard. Mod PMax afgør annoncerangering siden maj 2025. | [Blog juni 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june) | Q12 + P15. |
| "117 CallRateExceeded and 207 … wait and try again" (prompt.ts) | 117: vent 60 sekunder. 207 gælder rapporter: vent på de kørende. | [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol) | Q28 + P23. |
| "typically lower CPCs and older/desktop-heavy audience than Google" (prompt.ts) | CPC-påstanden er ikke bevist, og "ældre" er ikke belagt. Desktop-tung passer for Danmark. | [SearchLab (snippet)](https://searchlab.nl/en/statistics/microsoft-ads-statistics-2026); [StatCounter DK (snippet)](https://gs.statcounter.com/search-engine-market-share/desktop/denmark) | Q19: "…lower CPCs … often claimed but not proven … judge the account against its own history". |
| "Annoncestyrke og elementvurderinger (Lav/God/Bedst)" (microsoftAds.ts) | To forskellige ting: annoncestyrke er Poor–Excellent (0–100 %), elementer er Low/Good/Best. | [About Ad strength](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_adstrength) | P11. |
| "at en tredje giver mindre, har vi kun set i sekundære kilder" (microsoftAds.ts) | Primærkilden siger det selv. | [Optmyzr 2023](https://www.optmyzr.com/blog/optmyzr-study-responsive-search-ad-performance/) | P12. |
| "intet presserende sprog uden et rigtigt tilbud med slutdato" (microsoftAds.ts) | Politikken forbyder hastesprog uden undtagelse, og der må højst være én pris/procent pr. annonce. | [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1) | P10. |
| "Prisen med ekskl. eller inkl. moms." (microsoftAds.ts) | EU: priser inkl. moms og afgifter. Førpris efter 30-dages-reglen. | [Pricing policy](https://help.ads.microsoft.com/#apex/ads/en/60381/-1); [DI Handel (snippet)](https://www.danskindustri.dk/brancher/di-handel/nyhedsarkiv/nyheder/2026/10/black-friday-kan-fa-betydning-for-julehandlen-pas-pa-30-dagesreglen/) | P14, Q29. |
| "Annonce-/eksperimentvinder: mindst 95 % sikkerhed" (microsoftAds.ts) | Microsoft oplyser intet sikkerhedsniveau. Eksperimenter: mindst 4 uger. | [Experiments tips](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_bestpractices) | P28. |
| "sæsonjustering (≤14 dage) eller dataudelukkelse (≤7 dage)" (microsoftAds.ts) | Dataudelukkelse: max 14, anbefalet ≤7, ikke de første 30 dage. Sæsonjustering kun med mål-CPA/-ROAS. | [Data exclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions); [Seasonality](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments) | P31. |
| "Microsoft Consent Mode … Uden samtykke mistes konverteringer og remarketing for de brugere" (microsoftAds.ts) | Uden noget signal mistes al trafik fra EØS/UK/CH. Aldrig både Consent Mode og TCF. Modellering kræver ≥700 klik/uge. | [Consent FAQ](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_consentfaq); [Modeled conversions FAQ](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uet_modeledconversionsfaq) | P20. |
| "Offline-konverteringer (tilbud/faktura): UTC-tid" (microsoftAds.ts) | Tidszonen angives pr. række eller i skabelonen. | [Tracking offline conversions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_uetv2offlineconversion) | P21. |
| "Delt bibliotek … Værktøjer → Delt bibliotek" og danske menunavne (microsoftAds.ts) | Forældet sti, og brugerfladen findes ikke på dansk. | [Shared budgets](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets); [About language options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutlanguageoptions) | P34, P35, P38. |
| "LinkedIn-profilmålretning … Kun budjustering" (microsoftAds.ts) | Standard er kun bud, men via API kan det være "målret og byd". Danmark er ikke bekræftet. | [AdGroup.Settings](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13); [help 56905 (snippet)](https://help.ads.microsoft.com/apex/index/3/en/56905) | P6, P36, Q19. |
| (mangler) AI Max, autogenererede elementer og automatiske udvidelser er slået til som standard. | Officielt dokumenteret 2026. | [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [Blog 15. jan. 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026) | P9, P22, P29, Q19. |
| (mangler) Konverteringer vs Alle konverteringer, attribution og importerede mål. | Officielt dokumenteret. | [Conversions vs All](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_convsvsallconvs); [AttributionModelType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/attributionmodeltype?view=bingads-13) | P21, Q26. |
| (mangler) Annoncegruppens målretning erstatter kampagnens; lokationshensigtens standard. | Officielt dokumenteret. | [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13) | P8, Q14. |
| (mangler) ASCII-URL'er, stinavne uden "/", højst 67 tegn. | Officielt dokumenteret. | [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad?view=bingads-13); [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1) | P33, Q20. |
| (mangler) Shopping/PMax-regler: feed-udløb, låste indstillinger, PMax-begrænsninger. | Officielt dokumenteret. | Se 2.6 | P15. |

Bekræftet og uændret (udvalg):
- Bud ignoreres under automatiske strategier.
- Selvstændig mål-CPA/-ROAS er stoppet siden aug. 2025.
- PMax har kun to strategier.
- Budgetformlen midt i måneden.
- Logikken om visningsandel tabt pga. budget.
- RSA-grænserne og maks. 3 aktive.
- Mål-ROAS 300 % = 3,0.
- Annoncegrupper og kampagner starter som pauset.
- Delte budgetter ændres på budgettet.
- Ændringshistorik 6 måneder med fortryd inden for 30 dage.
- 50/50-split.
- Advarslerne om Google-importen.
- "Foreslå aldrig auto-anvendelse".

---

## 4. Fejl i appens kald til Microsoft

Kilde: api_v13.md, afsnit 10. Fejlene er fundet ved at sammenligne koden med dokumentationen og Microsofts officielle REST-SDK. De er ikke testet mod en rigtig konto.

**Rettet i commit 4609752 (de første fem, med tests i `src/test/apiFixes.test.ts`):**

1. **PMax-listegrupper bruger et forkert feltnavn** (`src/bing/live.ts`, `listingGroupActionJson` / `listAssetGroupListingGroups`).
   - Koden skriver `ListingGroupType` og læser `ListingGroupType ?? GroupNodeListingType`.
   - Feltet hedder `AssetGroupListingType` og er "Add: Required".
   - Konsekvens: tilføjelser fejler sandsynligvis, og læsninger giver `unit: null`.
   - Kilde: [AssetGroupListingGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/assetgrouplistinggroup); [ApplyAssetGroupListingGroupActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions); [BingAds-Python-SDK](https://github.com/BingAds/BingAds-Python-SDK/blob/main/openapi_client/models/campaign/asset_group_listing_group.py).
2. **Lokationshensigt skrives med forkert CriterionType** (`setLocationIntent`).
   - Koden sender `CriterionType: 'LocationIntent'`; ved skrivning skal det være `"Targets"`.
   - POST-grenen er normalt unødvendig, fordi hensigten oprettes automatisk og ikke kan slettes (2965). Der skal i stedet laves en opdatering (PUT).
   - Kilde: [AddCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions); [CampaignCriterionType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaigncriteriontype); [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion).
3. **Sitelinks sendes med `Description2: ''`**, når kun Description1 er givet (`addAdExtensions`).
   - Microsoft kræver begge beskrivelser, hvis den ene er sat.
   - AddAdExtensions er alt-eller-intet, så ét forkert sitelink vælter hele batchen.
   - Kilde: [SitelinkAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension); [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions).
4. **MaxCpc sendes, når `b.maxCpc` er sat** (`fromBidStrategy` i `createCampaign` og `updateCampaigns`).
   - På kampagner uden portefølje med MaxClicks/MaxConversions/MaxConversionValue giver et nyt MaxCpc fejl 611274. Kun et eksisterende loft kan ændres eller fjernes.
   - Kilde: [Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes); [MaxConversionValueBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionvaluebiddingscheme).
5. **Genforsøg ved 117 er for hurtigt** (`client.ts` / `msErrors.ts`).
   - Koden prøver igen efter 2 og 4 sekunder, men Microsoft siger: vent 60 sekunder.
   - Kilde: [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol).
   - Fundet under rettelsen: Microsofts fejlsvar har nummeret i `Code` og navnet (`CallRateExceeded`, `InvalidCredentials` …) i `ErrorCode`, og appen viser navnet. Tjekkene for "for mange kald" og "afvist login" så kun efter nummeret og ramte derfor aldrig rigtige svar. De genkender nu begge dele.

**Også rettet i commit 4609752 (fra listen nedenfor):**
- 207 behandles kun som "vent" i Reporting-kald; 4204 (Bulk) prøves ikke igen.
- `addAdExtensions` deler op i portioner af 100, og fejl-positionerne passer stadig.
- Sitelinks: tekst højst 25 tegn med beskrivelser (35 uden), begge beskrivelser eller ingen, højst 20 pr. sted – tjekkes i `add_ad_extensions`, før noget sendes.

**Øvrige risici (ikke rettet endnu – punkterne markeret ✔ er rettet, se ovenfor):**

- ✔ **207 og 4204 behandles som 117.**
  - 207 betyder i Reporting "vent på kørende rapporter", men i Customer Management "Address Line3 invalid". `isThrottled` skelner ikke.
  - 4204 er kun Bulk og kræver op til 15 minutters ventetid.
  - Kilde: [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes); [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol).
- **`updateAdGroups`.** Problemer:
  - Der er ingen måde at fjerne en slutdato på; det kræver en dato fra 2. jan. 2050.
  - En ny StartDate efter start giver 1216.
  - Opdateringer af udløbne grupper giver 1215.

  Kilde: [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup).
- **`applyCampaignTargets`:**
  - Enheder skal tilføjes alle tre i samme kald, ellers tilføjes ingen; det håndhæves ikke.
  - Intervallerne −90…900 (enheder −100…900) valideres ikke.
  - Kun hele timer, selvom 15/30/45 minutter er tilladt.
  - Negative lokationer kan ikke skrives.
  - Kampagneændringer rammer ikke annoncegrupper med egen målretning.

  Kilde: [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion); [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier); [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion).
- **`applyProductPartitionActions`:**
  - `Amount: a.bid ?? null` på en biddable enhed fejler, for "every Unit must have a bid" gælder også under automatiske strategier.
  - Ændringer, der kun gælder bud, kunne bruge Action "Update", som bevarer node-id'er.

  Kilde: [ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions); [AdGroupCriterionAction](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroupcriterionaction).
- **Manglende opdeling i portioner.**
  - `addKeywords` deler ikke op ved 1.000 pr. kald.
  - ✔ `addAdExtensions` deler ikke op ved 100.
  - ✔ Sitelinkens DisplayText skal være højst 25 tegn, når der er beskrivelser.

  Kilde: [AddKeywords](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addkeywords); [AddAdExtensions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addadextensions).
- **`updateKeywords`:** `bid === null` sletter søgeordets bud (falder tilbage til gruppens) og betyder ikke "ingen ændring". Kilde: [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword).
- **Promotion:**
  - PercentOff skal være i procent (10 = 10 %); tjek at værktøjet ikke sender 0,10.
  - CurrencyCode sendes altid, hvilket formentlig er ufarligt.

  Kilde: [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension).
- **Rapport-polling hvert 2. sekund** er hurtigere end Microsofts forslag (2–15 minutter). Det er o.k. for små rapporter, men kan give 207. Kilde: [Request and Download a Report](https://learn.microsoft.com/en-us/advertising/guides/request-download-report).

Fra de andre noter:
- **`checks.ts`:**
  - `MIN_CONVERSIONS_30D = 15` og dens kommentar har ingen kilde (Microsoft siger 30, og ≥5 for at starte). Ikke ændret: det er en adfærdsændring, teamet skal beslutte. Playbook og prompt siger nu, at 15 er en husregel.
  - `LEVER`-teksterne for MaxClicks/MaxConversions nævner "maks. CPC-loft" og "skift til Mål-CPA", men begge dele er forældede.
  - Kilde: bidding_budgets.md afsnit 7; [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [Bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).
- **`adCopy.ts`:**
  - Regex'en i `plain()` læser `{COUNTDOWN(2026-11-27 23:59:59,5)}` forkert, fordi den tager teksten efter første kolon som standardtekst.
  - `exclamation` advarer om ethvert "!", men politikken tillader ét pr. sætning.
  - `vat` bør have inkl. moms som standard for B2C.
  - Der mangler tjek for én pris pr. annonce og ASCII-URL'er.
  - Kilde: ads_assets.md "Against the current rules"; [Countdown](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_countdown); [General Ad Requirements](https://help.ads.microsoft.com/#apex/ads/en/60209/-1).
- **`create_campaign`:**
  - Bør sætte AI Max eksplicit (AISearchSetting).
  - Bør erklære IsPolitical = false. Det skal tjekkes, om API'et afviser kampagner uden.
  - Bør altid tilføje lokationer, fordi en kampagne uden kriterier vises i hele verden.
  - Kilde: [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13); [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13).

Bekræftet i koden:
- `CAMPAIGN_FIELDS` (ReturnAdditionalFields).
- Datoformatet og København som tidszone ved oprettelse.
- `ReportTimeZone`.
- Håndtering af PartialErrors.
- REST-endpointet.
- 100-portioner i `applyCampaignTargets`.

---

## 5. Huller

Det kunne noterne ikke bekræfte. Her skal assistenten være forsigtig, og nogle punkter kræver en test.

**Bud og budget**
- Om Maksimér konverteringsværdi faktisk tilbydes for Standard Shopping i Danmark ("where available").
- Om Maksimér konverteringer kan vælges i Standard Shopping.
- Om 1. okt.-reglen for maks. CPC også gælder kampagner oprettet via API/Editor/import.
- Om API-fjernelsen 12. jan. 2027 også rammer Mål for visningsandel og Forbedret CPC.
- Om budjusteringer af typerne enhed + lokation + tid + målgruppe ganges eller lægges sammen. API-guiden viser gange, SA360 viser plus, og der er ingen nyere Microsoft-side.
- Om sæsonjustering virker på Maksimér uden mål.
- Hvilket bud en annoncegruppe får uden CPC-bud. Noterne er uenige.
- Forklaringen på 20 % mod 2× dagligt overforbrug, og på 30,4 mod dage i måneden.
- Om visningsandel + tabt til budget + tabt til rang giver 100 %.
- Der findes ingen uafhængige test af Microsofts automatiske budgivning (Microsofts +8–18 % er egne tal).

**Måling**
- Om visningsandel har 14–18 timers forsinkelse. Noterne er uenige: measurement og api_v13 finder det kun ved kvalitetsresultat, mens bidding_budgets læser report-attributes-guiden som gældende for visningsandel.
- Standardattribution for nye mål efter udrulningen af datadrevet attribution.
- Hvordan datadrevet attribution fungerer.
- Hvor meget samtykke koster i konverteringer i Danmark.
- Microsofts signifikansmetode i eksperimenter.
- Påstanden om, at KeywordId er nødvendig for præcis visningsandel på søgeordsniveau.
- Ingen Magento-specifik UET-vejledning.

**Søgeord**
- Om matchtypen kan ændres via API. Feltet siger Optional, men fejl 1545 findes. Skal testes.
- Hvilke markeder og sprog der har nære varianter (er dansk med?).
- Kontolistens størrelse for negativer: 1.000 eller 5.000.
- Om PMax-negativer er tilgængelige for alle.
- Hvor stor en del af søgetermerne der er skjult, og den præcise tærskel.
- Hvordan DSA og AI Max spiller sammen.
- Om AI Max styres på kampagne- eller annoncegruppeniveau.
- Det præcise API-felt til at slå AI Max fra blev ikke fundet i structure_settings. context_changes nævner AISearchSetting.

**Struktur**
- Microsofts side om markedstilgængelighed kunne ikke læses, så der er ingen liste over, hvilke funktioner der findes i Danmark: LinkedIn, Multimedia ads, Copilot og promotion-udvidelser. API-guide og hjælp er uenige om promotion-udvidelser.
- Om −100 % for Audience-annoncer stadig accepteres.
- Om tidsplanen følger kontoens eller den søgendes tidszone. Kilderne er uenige, så læs flaget.
- Hvilke danske lokationstyper (kommuner, postnumre) der kan målrettes.
- Om eksperimenter kun gælder Søgning (hjælpen) eller flere typer (API'et).
- Standardindstillingen for auto-anvendte anbefalinger på nye konti.

**Annoncer**
- Om "one price or %" gælder pr. element eller pr. vist kombination.
- Den nuværende regel om telefonnumre i annoncetekst.
- Danske overskrifter til structured snippets.
- Om Multimedia ads vises i Danmark.
- Der findes ingen Microsoft-specifikke A/B-studier; al uafhængig evidens er fra Google-konti.

**Shopping/PMax**
- Om roden i Shopping eller PMax kan udelukkes via API. Skal testes.
- Minimumsbud i DKK for Shopping. structure_settings angiver 0,06 DKK ud fra import-siden; shopping_pmax fandt ingen DKK-række.
- Om produktgruppe-matching på Id skelner mellem store og små bogstaver.
- Om PMax' auktionsindsigt er live: "coming soon" i maj, "available" i oktober.
- Om navnet SearchInsightPerformanceReport er korrekt.
- Om Cost per sale findes i Danmark.
- Om mål-ROAS indtastes som procent eller forhold i brugerfladen.

**Danske regler og marked**
- Forbrugerombudsmandens egen vejledning og § 9 a blev ikke nået. Førpris-reglerne bygger på branchekilder (snippets).
- B2B-undtagelsen for priser ekskl. moms er ikke kildebelagt.
- Der er ingen dansk eller europæisk benchmark og ingen Microsoft-data for Danmark om rækkevidde eller demografi.
- Om der kan fravælges Copilot-placeringer (3P-kilder er uenige).

**API**
- Ingen af kodefejlene er testet mod en rigtig konto. Det er uvist, om REST tavst ignorerer `ListingGroupType` og `CriterionType: "LocationIntent"` eller afviser dem.
- Om throttling giver HTTP 429 eller 400 med 117, og om der er en Retry-After-header.
- Per-kald-grænser for UpdateKeywords, AddAds og UpdateCampaigns.
- Hvad "This column is deprecated" på Campaign.TimeZone betyder i praksis.
