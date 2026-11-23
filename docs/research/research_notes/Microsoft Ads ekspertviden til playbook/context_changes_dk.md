# Microsoft Advertising context for a Danish account (Inventarland): benchmarks, audience, product changes 2024–2026, AI/Copilot, EU/DK rules, as of November 2026

How to read the tags:
- **[MS]** means an official Microsoft source. Most were fetched in full with curl from about.ads.microsoft.com or learn.microsoft.com.
- **[3P]** means a third-party source.
- **(snippet)** means only the WebSearch result text was seen, because the host was not fetchable (ppc.land sits behind Cloudflare; searchengineland, statcounter, Danish sites, curia and others were outside the allowed hosts). Treat snippet-only facts as less certain.
- Microsoft performance claims ("+X %") are Microsoft's own internal data. None of them is independently verified.

## 1. Benchmarks: CPC, CTR, CVR, CPA, ROAS overall and by industry, vs Google, Europe/DK

### Takeaway
I found no trustworthy Microsoft-only benchmark, and nothing for Denmark or Europe. The Microsoft-only figures that circulate everywhere ($1.54 CPC, 2.83 % CTR, 2.94 % CVR, $41.44 CPA) cannot be traced to a primary study; one aggregator removed its Microsoft-only industry table for exactly that reason. The only industry tables with a known publisher (LocaliQ/WordStream) are US, Google-heavy or blended Google+Microsoft. The assistant should therefore judge Inventarland against its own history, its margin-based break-even ROAS and Microsoft's in-platform tools, not against external "averages".

### Cited Findings
- **Widely cited Microsoft-only medians [3P, snippet]:** CTR 2.83 %, CPC $1.54, CVR 2.94 %, CPA $41.44, "across 18 verticals". The CPC is described as about 35–43 % lower than Google ($2.69 cited for Google). The same secondary report gives industry examples:
  - Apparel 3.33 % CTR, $0.91 CPC, 2.88 % CVR.
  - B2B Services 3.01 % CTR, $1.16 CPC, 2.64 % CVR.
  - Automotive 2.34 % CTR, $2.52 CPC, 1.62 % CVR.
  - The search result text did not say who collected the data, or the sample or method.
  - Sources: [SearchLab, Microsoft Ads statistics 2026, updated 6 Nov 2026](https://searchlab.nl/en/statistics/microsoft-ads-statistics-2026) (snippet); [Stackmatix comparison](https://www.stackmatix.com/blog/microsoft-ads-vs-google-ads-comparison) (snippet).
- **Provenance warning [3P, snippet]:** SearchLab says industry benchmarks for Microsoft Ads alone "could not be traced to a source and have been removed". It also notes that the Microsoft audience figures in circulation are Microsoft's own vendor data. Source: [SearchLab](https://searchlab.nl/en/statistics/microsoft-ads-statistics-2026).
- **Conflicting Microsoft-only figures [3P, snippet]:** Benchmarketing lists 2.83 % CTR, **$3.32** CPC, 4.12 % CVR and $41.44 CPA. Same CTR and CPA as above, but a different CPC and CVR, which suggests recycled or mixed sources. Another aggregator says 3.10 % CTR, $1.45–1.54 CPC and 3.50 % CVR. Sources: [Benchmarketing](https://www.benchmarketing.org/benchmarks/microsoft-ads); [Whatagraph](https://whatagraph.com/blog/articles/ppc-benchmarks) (snippets).
- **LocaliQ/WordStream 2026 search benchmarks [3P, snippet]:** CPC $5.42, CTR 6.64 %, CVR 8.18 %, cost per lead $66.69. The platform scope is unclear: SearchLab calls it "Google + Microsoft combined", while LocaliQ's own page attributes the 8.18 % to Google Ads. The same set gives Home & Home Improvement at CPC $8.33, CTR 6.47 %, CVR 8.05 % and CPL $90.92. The data is US, lead-gen-heavy, and the sample size did not appear in the search result text. Sources: [WordStream 2026 Google Ads benchmarks](https://www.wordstream.com/blog/2026-google-ads-benchmarks); [LocaliQ search advertising benchmarks](https://localiq.com/blog/search-advertising-benchmarks/) (snippets).
- **Furniture (Google Ads, US) [3P, snippet]:**
  - 2026: CTR 6.57 %, CPC $3.97 ([WordStream 2026](https://www.wordstream.com/blog/2026-google-ads-benchmarks)).
  - 2024: search CVR 2.53 %, well below the all-industry average ([WordStream 2024](https://www.wordstream.com/blog/2024-google-ads-benchmarks)).
  - I found no Microsoft-specific furniture, office-equipment or warehouse-equipment benchmark.
- **Google-only 2025 [3P, snippet]:** CTR 6.66 %, CVR 7.52 % ([WordStream 2025](https://www.wordstream.com/blog/2025-google-ads-benchmarks)).
- **Cheap-CPC narrative contested [3P, snippet]:** A Cambridge MBA/Adzooma study found Microsoft had the *highest* median CPM and CPC of the platforms it compared, while recommending Microsoft for affluent audiences. Another commentator warns that thin Microsoft volume can give an equal or higher CPL despite a lower CPC ([Adzooma](https://adzooma.com/?p=22567); [Databox](https://databox.com/microsoft-ads-vs-google-ads)).
- **Microsoft's own performance claims [MS]** (useful as context, not as benchmarks):
  - Upgraded bidding models: +10 % conversion value per click at similar ROAS for Maximize Conversion Value/Target ROAS users (global Search + Audience Network, Aug 2026).
  - Switching Search from Target CPA to Target ROAS: +8 % conversion value at similar ROAS (Aug–Sep 2026).
  - Switching from eCPC to Maximize Conversions with a target CPA: +18 % conversions at similar CPA (Jun–Jul 2026).
  - Source: [MS blog, 18 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
- **AI Max claim [MS]:** at least +8 % conversions vs control. Method: 44 advertiser-run A/B experiments, Jun–Aug 2026; spend-weighted uplift about 13.6 %; only 10 of 44 were statistically significant, with a lower confidence bound of 8.2 %. The uplift was higher for campaigns relying on Exact/Phrase match. Source: [MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max).
- **Performance Max claim [MS]:** about +8 % incremental conversions on average (global, Sep 2024–Sep 2025) ([MS blog, 21 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era)). Upgrading DSA to PMax: +24 % conversions on average at similar CPA/ROAS ([MS blog, 4 Feb 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february)).
- **AI-optimized RSA text [MS]:** +5 % CTR in a randomized experiment (global, Feb 2026) ([MS blog, 21 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era)).

### Inferences
- Any "Microsoft average" quoted to the user must carry the caveat "US, origin unclear, not Danish". A Danish B2B/B2C furniture shop in DKK cannot be benchmarked against these numbers.
- Better yardsticks for the assistant:
  - break-even ROAS from gross margin (already in the business profile);
  - the account's own trend;
  - impression share;
  - Microsoft's in-account tools (auction insights, bid landscape, bid strategy report with average target metrics).
- The repeated "Microsoft CPC is about 30–45 % lower than Google" is plausible as a direction but not proven. In Denmark, low Microsoft volume can push CPA up even when CPC is lower.

### Gaps
- I found no Denmark, Nordic or EU benchmark for Microsoft Advertising, and no ROAS benchmark for Microsoft at all.
- I found no Microsoft-specific furniture, office or warehouse-equipment data.
- The LocaliQ/WordStream sample sizes and method were not visible in the search result text, and the pages were not fetched in full.

## 2. Audience: Microsoft network reach and share in DK/Nordics/EU, demographics, devices, LinkedIn availability

### Takeaway
In Denmark, Bing has roughly 8–10 % of all-device search and roughly 13–14 % on desktop (StatCounter, mid/late 2026). Google has about 85 %. Yahoo, DuckDuckGo and Ecosia add about 5 % more in total. Microsoft publishes no Danish reach or demographic data. For a Danish account, LinkedIn profile targeting is **not confirmed available**: Microsoft's own pages list six markets that do not include Denmark, and expansion reports do not name Denmark.

### Cited Findings
- **StatCounter, Denmark [3P, snippet only; statcounter not fetchable].** The figures differ by month and view:

  | Period and view | Google | Bing | Yahoo | DuckDuckGo | Ecosia | Yandex |
  |---|---|---|---|---|---|---|
  | June 2026, all platforms | — | 8.94 % | 2.66 % | 1.73 % | 0.54 % | — |
  | July 2026, all platforms | about 86.6 % | 7.67 % | 2.75 % | 1.61 % | 0.58 % | 0.44 % |
  | September 2026 | — | 9.65 % | — | — | — | — |
  | October 2026 | about 84.9 % | 9.68 % | — | — | — | — |
  | August 2026, desktop only | 78.53 % | 14.06 % | — | — | — | — |

  Other desktop and tablet views show Bing at about 12.5–13.9 %. Sources: [StatCounter DK](https://gs.statcounter.com/search-engine-market-share/all/denmark); [StatCounter DK desktop](https://gs.statcounter.com/search-engine-market-share/desktop/denmark); [StatCounter DK monthly](https://gs.statcounter.com/search-engine-market-share/monthly/denmark).
- **Microsoft's planning page [MS]:** It shows comScore desktop-only data (qSearch, June 2026) only for Global, US, UK, CA, AU and IN. Denmark is not offered, and the numbers render client-side, so they were not readable. Source: [MS Search data planning page](https://about.ads.microsoft.com/en/tools/planning/search-data) (fetched).
- **Europe expansion [3P, snippet]:** In 2022 Microsoft added 29 markets across Europe and Africa, claiming reach of 41 million consumers and 400 million searches a month across those markets ([SE Roundtable](https://www.seroundtable.com/microsoft-advertising-expands-32923.html); [SEL](https://searchengineland.com/microsoft-advertising-nearly-doubles-available-markets-with-29-more-countries-380325)).
- **Demographics [MS, old]:** The US infographic (2019, desktop only) gives a 50/50 gender split, 47 % aged 18–44 and 38 % with household income ≥ $100K ([MS infographic PDF](https://about.ads.microsoft.com/en-us/microsoft-advertising-and-infographic-en.pdf), snippet). The UK Bing network audience page says 36 % have household income in the top 25 % (undated) ([MS UK page](https://advertise.bingads.microsoft.com/en-gb/insights/planning-tools/bing-network-audience), snippet).
- **Demographics [3P, snippet]:** One agency says, without a date, that 54 % of US users are under 45, 41 % are in the top income quartile, and the audience is "desktop-heavy" because Bing is the default on many work machines ([Embryo](https://embryo.com/blog/top-facts-microsoft-advertising/)).
- **Microsoft surfaces in 2026 [MS]:**
  - Ads run across "Copilot, Bing Search, Outlook, and more" ([MS blog, 28 Oct 2026](https://about.ads.microsoft.com/en/blog/post/october-2026/build-steer-and-measure-your-campaigns-with-ai-whats-new-in-microsoft-advertising-this-october)).
  - PMax inventory covers "Bing, Edge, MSN, Outlook and more" ([MS blog, 17 Jun 2026](https://about.ads.microsoft.com/en/blog/post/june-2026/building-a-new-ai-economy-that-creates-value-for-everyone)).
  - The new Discover feed (Edge new tab page and Windows) is live only in the US, CA, UK, AU and IN ([MS blog, 19 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november)).
- **LinkedIn profile targeting, what it covers [MS]:**
  - Targets by company, industry and job function.
  - Available in Search, DSA, Shopping, Audience and Performance Max campaigns; PMax not for everyone yet.
  - At most 1,000 companies per ad group or campaign.
  - Company lists must be added manually in the platform; no import.
  - Setup is "select Target … set a bid adjustment for each target".
  - Source: [learn.microsoft.com help, LinkedIn profile targeting](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_linkedintargeting) (fetched). Its link to the country availability page returns 404.
- **LinkedIn markets [MS]:**
  - The help page and the product page say "only available for campaigns that target the US, CA, UK, AU, FR, and DE markets" ([help 56905](https://help.ads.microsoft.com/apex/index/3/en/56905); [product page](https://Advertising.Microsoft.com/en-us/solutions/Audience-targeting/LinkedIn-Profile-Targeting), snippets).
  - The Feb 2025 PMax LinkedIn pilot covered the same six markets ([MS blog, 4 Feb 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february), fetched).
  - Job Seniority and Company Lists were in pilot for Search in the US and Canada in April 2026 ([MS blog, 21 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era)).
- **LinkedIn markets [3P, snippet]:**
  - PPC Land says LinkedIn targeting expanded to 27 markets in August 2024, but the result text listed no countries.
  - The later seniority rollout covered 29 markets. EMEA in that rollout was only Egypt, Nigeria, Saudi Arabia and South Africa, and Western Europe (UK, DE, FR, NL) was absent.
  - Sources: [PPC Land](https://ppc.land/microsoft-advertising-adds-job-seniority-to-linkedin-profile-targeting/); [SEL](https://searchengineland.com/microsoft-ads-expands-linkedin-targeting-with-job-seniority-filters-480296).
- **Job Seniority GA [MS]:** generally available for Audience ads and Search campaigns from 31 Aug 2026, with 10 levels: CXO, VP, Director, Manager, Senior, Entry, Owner, Partner, Training, Volunteer. The article does not name markets ([MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)).
- **LinkedIn API changes [MS]:** CustomLinkedInCriterion and GetLinkedInSegments (Aug 2026); JobTitle as a CampaignCriterionType and company-list APIs (Sep 2026) ([API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13)).
- **Bid only for Search [3P, snippet]:** A report quotes the help page as saying LinkedIn targeting is "always Bid only" for Search, DSA and Shopping campaigns ([search result summary of help 56905](https://help.ads.microsoft.com/apex/index/3/en/56905)). Audience ads, by contrast, gained an option to show only to chosen LinkedIn job roles ([PPC Land](https://ppc.land/microsoft-audience-ads-gain-option-to-show-only-to-chosen-linkedin-job-roles/), snippet).

### Inferences
- With Bing near 10 % of Danish search overall but 13–14 % on desktop, Microsoft is relatively more relevant for office-hours B2B buyers. This supports the playbook's "computer dominates B2B" instinct, but it is not proof of Inventarland's own device mix; check the device report.
- The assistant must not assume LinkedIn dimensions exist for a Denmark-targeted campaign. If the LinkedIn demographics report (ProfessionalDemographicsAudienceReport) returns nothing, the likely reason is market availability, not a data error.

### Gaps
- I found no Microsoft or comScore data for Denmark or the Nordics: no reach, no unique searchers, no demographics, no device mix.
- I found no source on which syndication partners (Yahoo, DuckDuckGo, Ecosia, AOL) serve Microsoft ads in Denmark in 2026, or on how the new Ecosia/Qwant index affects ads there.
- I found no Copilot or Edge usage share for Denmark.
- I found no complete official list of LinkedIn targeting markets; whether Denmark is included is unconfirmed.

## 3. Product changes 2024–2026 with dates

### Takeaway
2025–2026 moved Microsoft hard toward automation:
- standalone tCPA/tROAS gone for new campaigns (4 Aug 2025);
- Max CPC removed from new non-portfolio automated campaigns (1 Oct 2026);
- AI Max general availability, **on by default for new Search campaigns** (27 Aug 2026);
- autogenerated RSA assets pushed into existing RSAs (Apr 2026);
- data-driven attribution for all (May 2026);
- Conversions API GA (28 Oct 2026);
- rebuilt bid models (18 Nov 2026).

Several of these directly affect what the app's change tools do.

### Cited Findings
Retired or restricted:
- **Expanded text ads [3P, snippet]:** RSAs only for creation and editing in standard search campaigns from 30 Jun 2022. Existing ETAs keep serving but cannot be edited ([SEL](https://searchengineland.com/microsoft-advertising-eta-deprecation-auto-generated-remarketing-lists-and-audience-network-updates-374937)).
- **Broad match modifier [3P, snippet]:** no new BMM keywords from August 2021, with phrase match absorbing BMM traffic. From 15 Mar 2023, existing BMM keywords serve as broad match ([SEL](https://searchengineland.com/microsoft-ads-broad-match-modifier-keywords-now-serving-ad-broad-match-394340); [SER](https://www.seroundtable.com/microsoft-advertising-broad-match-modifier-bing-35063.html)).
- **Manual CPC [MS]:**
  - Only for Audience display/video and lodging (hotel) campaigns. From May 2024 it is gone for Audience native, where existing campaigns were converted to eCPC.
  - "If you attempt to set manual CPC for any other campaign type, the request will be ignored without error and the bid strategy will be set to enhanced CPC."
  - Search, Shopping and DSA campaigns were migrated from Manual CPC to eCPC back in 2021 ([SEL](https://searchengineland.com/microsoft-ads-to-replace-manual-cpc-with-enhanced-cpc-by-end-of-april-345917), snippet).
  - Source: [learn.microsoft.com, Budget and bid strategies, dated 2025-06-26](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13) (fetched).
- **Smart Shopping → Performance Max [MS]:**
  - Upgrade announced in June 2024; automatic conversion from August 2024.
  - "As of the end of January [2025] … all remaining smart shopping campaigns have been converted to Performance Max."
  - Eligible Search DSA campaigns can be upgraded to PMax.
  - Source: [MS blog, 4 Feb 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february) (fetched). Creating a new Smart Shopping campaign now returns the error SmartShoppingCampaignCreationNotSupported ([learn.microsoft.com Smart Shopping](https://learn.microsoft.com/en-us/advertising/guides/smart-shopping-campaigns?view=bingads-13), snippet).
- **Standalone Target CPA/Target ROAS [3P quoting MS help]:**
  - From **4 Aug 2025** they are not available for newly created campaigns, and are removed as options from campaigns that don't use them.
  - Existing campaigns and portfolio strategies are not affected.
  - In the API, Editor and bulk, setting TargetCpa is converted to MaxConversions and TargetRoas to MaxConversionValue, and the target value carries over.
  - Maximize Conversions with a target CPA arrived for Search after 4 Aug 2025.
  - Source: [SER, 2 Jul 2025](https://www.seroundtable.com/microsoft-ads-target-cpa-and-target-roas-retire-39688.html) (fetched, quotes the MS help text and Navah Hopkins).
- **Max CPC [MS]:**
  - From **1 Oct 2026** the setting is no longer available when creating new non-portfolio campaigns using Maximize Conversions (with target CPA), Maximize Conversion Value (with target ROAS) or Maximize Clicks.
  - Existing campaigns keep it, and portfolio strategies keep it.
  - Microsoft's reason: Max CPC "overrides advertisers' own CPA/ROAS targets … even when the cap is above average CPC".
  - Source: [MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026) (fetched).
  - SEJ adds: Target Impression Share and Enhanced CPC are not affected; removal was UI first, with Editor and API to follow ([SEJ](https://www.searchenginejournal.com/microsoft-ads-is-removing-max-cpc-from-new-campaigns/586527/), fetched).
- **Predictive Matching [3P, snippet]:** folded into AI Max search term matching. The documentation change was spotted on 29 Jul 2026; no effective date given and "no action required" ([PPC Land](https://ppc.land/microsoft-kills-predictive-matching-shifts-search-ads-to-ai-max/); [SER](https://seroundtable.com/microsoft-predictive-matching-search-term-41783.html)).
- **Dynamic Search Ads [MS]:** DSA "will continue to be supported in Microsoft Advertising until further notice". Google-imported, AI Max-upgraded DSA campaigns are converted back to DSA ([MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)).

New or changed, all [MS] unless marked:
- **Performance Max:**
  - Global general availability on 5 Mar 2024, after an open beta (blog dated 4 Mar 2024). This includes the EU; there was no separate EU launch ([MS blog](https://dev-about.ads.microsoft.com/en/blog/post/march-2024/microsofts-performance-max-now-available-globally), snippet).
  - Feed Labels launched mid-March 2024 for multi-country feeds ([MediaPost](https://www.mediapost.com/publications/article/394203/microsoft-performance-max-expands-globally-featur.html), 3P snippet).
- **Feb 2025:**
  - PMax pilots: LinkedIn as an audience signal (six markets only) and new customer acquisition (NCA) goals.
  - Conversion value rules for all campaign types.
  - Impression-based remarketing available globally.
  - Multi-format Audience campaigns became the default.
  - Source: [MS blog, 4 Feb 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february).
- **Consent Mode enforcement on 5 May 2025** (see section 5): [MS blog, 31 Mar 2025](https://about.ads.microsoft.com/en/blog/post/march-2025/providing-user-consent-signals-on-your-microsoft-campaigns-by-may-5-2025).
- **Sep 2025:** IsPolitical declaration on campaigns in the API and bulk (see section 5) ([API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13)).
- **Dec 2025 (API):**
  - TopicCriterion (content targeting).
  - Bid strategy report, with a ConversionDelay column.
  - DataDriven attribution model.
  - IsPolitical and BidStrategyScope fields on Campaign.
  - Google login for the API.
  - Source: [API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13).
- **Jan 2026:** NCA goals for PMax generally available "since the start of the year" ([MS blog, 16 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)).
- **Feb 2026:** AutoGeneratedAssetsEnabled added to ResponsiveSearchAdsSetting in the API ([API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13)). An "Advanced Consent Mode" blog post was published on 19 Feb 2026 (title seen in the related-posts list of the [MS consent blog](https://about.ads.microsoft.com/en/blog/post/march-2025/providing-user-consent-signals-on-your-microsoft-campaigns-by-may-5-2025); the post itself was not read).
- **16 Apr 2026** ([MS blog](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)):
  - Google PMax campaigns with NCA goals can be imported.
  - "Unknown" customers are treated as existing customers in NCA.
  - PMax landing page (Final URL) report.
  - Seasonality adjustments for portfolio strategies. They are only for short events and "work only with tROAS and tCPA campaigns".
  - Campaign names can be up to 400 characters (was 128).
  - **Autogenerated assets are being added to existing RSAs that lack the maximum number of text assets.** Opt-out is in campaign settings or via the notification; sensitive industries are excluded; the setting is honored in recurring Google imports.
  - Store name and domain can be changed in Merchant Center.
- **21 Apr 2026 Spring Summit** ([MS blog](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era); [MS blog](https://about.ads.microsoft.com/en/blog/post/april-2026/win-across-all-three-eras-of-the-web)):
  - Refreshed web interface.
  - Copilot root-cause analysis and conversion-tracking diagnostics.
  - AI Max pilot (global except China).
  - Term exclusions and messaging constraints; Brand kit.
  - LinkedIn Job Seniority and Company Lists (pilot US/CA).
  - Audience generation (pilot US/CA).
  - Data-driven attribution.
  - Offer Highlights in Copilot (retail, English-speaking markets).
  - UCP-ready feeds in Merchant Center (US).
  - Copilot Checkout (US).
- **19 May 2026** ([MS blog](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)):
  - New **Import Center** for Google, Meta and Pinterest imports, with post-import tips, error fixes, search and filters.
  - Cross-account portfolio bidding (Search and Shopping).
  - Bid strategy report with Avg. Target ROAS, Avg. Target CPA and Avg. Target impression share.
  - Seasonality adjustments for portfolios and shared budgets fully available.
  - **Data-driven attribution rolling out to all advertisers by end of May 2026**, for Maximize Conversions, Maximize Conversion Value and eCPC.
  - Custom columns support all conversion metrics.
- **May 2026 (API):** AISearchSetting (AI Max), MSClickIdPerformanceReport, GetUetTagAuthKey, and an ImageAdExtension V2 model ([API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13)).
- **July 2026:** Microsoft Advertising MCP server in open pilot, read-only. It connects Copilot, ChatGPT and Claude to account data ([MS blog, 19 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november); [MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)).
- **27 Aug 2026 – AI Max for Search generally available, global** ([MS blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)):
  - Three features: search term matching, text customization and final URL expansion.
  - An "AI optimized" match-type label in the search term and keyword reports.
  - A search term landing page report.
  - Brand inclusions/exclusions and term exclusions.
  - It respects negatives, bidding, budgets, goals and targeting.
  - **"AI Max will also be enabled by default for any new Search campaigns you create in Microsoft Advertising, though it can still be turned off."**
  - Scheduled Google imports inherit AI Max settings.
  - Existing RSA auto-generated assets now show up as "text customization", without opting the campaign into the full suite.
  - A rollout to all accounts from 19 Aug 2026 is reported by [PPC Land](https://ppc.land/microsoft-advertising-gains-ai-max-across-all-accounts-globally/) (3P, snippet). PPC Land also says AI Max search term matching requires conversion-based bidding (3P, snippet, not confirmed by MS text I read).
- **31 Aug 2026** ([MS blog](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)):
  - Dual-ID account linking. The API had to comply by 26 Aug; enforcement ran 26 Aug–22 Sep 2026.
  - Ad Preview Hub for PMax.
  - PMax uplift experiments.
  - PMax search terms visible in the "search term" report as well as "search term insights".
  - PMax age and gender exclusions, generally available by 8 Sep 2026.
  - Asset policy status shown in the Assets tab, with bulk appeal.
  - LinkedIn Job Seniority generally available.
  - Average target metrics in the grid.
  - Max CPC change announced.
  - "Bidding continues to allow campaigns to over-achieve on target CPA or target ROAS … regardless of budget limited status."
- **28 Oct 2026** ([MS blog](https://about.ads.microsoft.com/en/blog/post/october-2026/build-steer-and-measure-your-campaigns-with-ai-whats-new-in-microsoft-advertising-this-october)):
  - AI-powered PMax campaign creation from website and brand materials.
  - PMax age and gender targeting generally available.
  - **PMax device targeting rolling out to all "in the coming weeks"**.
  - PMax audience exclusions in open pilot.
  - Brand exclusions being refined so they can apply to text ads only.
  - PMax search term and auction insights reports available.
  - Search term landing page report from mid-November.
  - **Messaging guidelines** in open pilot for PMax and AI Max: up to 40 plain-language rules.
  - **Conversions API (CAPI) generally available**: server-to-server, alongside UET, direct or through Google Tag Manager and partners such as Stape and Tealium.
  - Rollups say CAPI is also offered through Commanders Act; I did not see that in the MS text.
- **Nov 2026, third-party report [3P, snippet]:** PPC Land reports that Microsoft's 9 Nov 2026 newsletter describes an interface overhaul. It also says the newsletter moves device targeting and brand exclusions to "pilot" status, which conflicts with the 28 Oct "rolling out to all" wording, and says "Age and gender exclusions are now generally available" ([PPC Land](https://ppc.land/microsoft-advertising-overhauls-interface-after-advertiser-complaints/)).
- **10–12 Nov 2026 [MS]:** Prisma (MediaOcean) integration and Xbox Video for Brands ([MS blog index](https://about.ads.microsoft.com/en/blog)).
- **18 Nov 2026 – bid model rebuild [MS]** ([MS blog](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)):
  - "Biggest upgrade to bidding models in a decade": bids adjust nearly 2× faster after target changes; more even pacing within the day.
  - **Recommends conversion-based bidding for new campaigns once the account has ≥5 conversions**, with eCPC only below 5.
  - Change targets in **15 % increments** and review after one conversion cycle.
  - **Do not keep a Max CPC.**
  - Evaluate after about 30 conversions in 30 days, at campaign or portfolio level rather than ad group or keyword level, and 1–2 conversion cycles after a change.
  - Big changes cause volatility: a new campaign, a strategy switch, adding or removing goals.
  - "More to come in 2027", rolled out automatically.
- **19 Nov 2026** ([MS blog](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november)):
  - **Ads in AI Overviews on Bing**, all markets except China, served through existing campaigns including PMax and AI Max, with no separate setup.
  - AI Max URL inclusions rolling out now.
  - AI content transparency controls generally available: declare AI-generated images and video and use visible watermarks across Product, Multimedia, Audience, Display, Video ads and PMax. "You're still responsible for … local laws and disclosure rules."
  - MCP server expanded.
  - Discover feed in the US, CA, UK, AU and IN only.

### Inferences
- Newly created Search campaigns now come with AI Max on by default, with no Max CPC on non-portfolio automated strategies, and RSAs may receive AI-generated text. The app's create, update and review tools must set or report these explicitly, or the approval card does not describe what Microsoft will actually run.
- Data-driven attribution (May 2026) and CAPI (Oct 2026) change conversion counts and credit. The mismatch between Microsoft-attributed revenue and webshop sales (get_shop_sales) can therefore move without any real change in sales.
- Interface paths changed in 2026 (refreshed UI in April, Import Center in May, overhaul in November). Navigation hints need the existing hedge, and "Import → Importplan og -historik" is probably now "Import Center".

### Gaps
- I found no official Microsoft text giving the ETA cutoff, the BMM dates, or the retirement date of Predictive Matching; these rely on 3P snippets.
- I could not read the 9 Nov 2026 newsletter (PPC Land), so the status of PMax device targeting and brand exclusions (rolling out vs pilot) is unresolved.
- I found no Denmark-specific availability statement for AI Max (described as "global"), Offer Highlights (English-speaking markets only, so likely not Denmark), Discover (not Denmark) or ads in AI Overviews (all markets except China, so including Denmark).

## 4. AI/Copilot: how ads show in Copilot answers, what advertisers can control, reporting

### Takeaway
Ads in Copilot, and since 19 Nov 2026 in Bing AI Overviews, are served from normal Search, Shopping and PMax campaigns. There is no separate campaign type. AI Max and PMax are Microsoft's preferred route into these placements. The control levers are indirect:
- negatives;
- brand inclusions/exclusions;
- term exclusions;
- messaging guidelines;
- URL inclusions;
- turning AI Max off.

I found no official evidence of a Copilot-only opt-out or a Copilot-only report segment.

### Cited Findings
- **Format [3P quoting MS, fetched]:** Ads appear "in a new, streamlined experience below Copilot's organic response … with fewer ad annotations and extensions". They are "triggered considering the whole conversation within a single session and not just the last prompt", and an "ad voice" summary introduces the ad block ([SER, 3 Oct 2024](https://www.seroundtable.com/microsoft-advertising-new-experience-38177.html)).
- **AI Overviews on Bing [MS]:** Ads in AI Overviews run "through the campaigns you already use, including Performance Max and AI Max … available in all markets except China". Microsoft cites a 21 % increase in purchases after a Copilot interaction (global Edge users, 21–31 Dec 2024) ([MS blog, 19 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november)).
- **Copilot performance claims [MS]:** Ads within Copilot experiences drive "101 % higher engagement relative to traditional Search ads" (Jun–Aug 2025, global first-party data). Paths with Copilot saw "a 53 % increase in purchases within 30 minutes" (Dec 2024). AI Max and PMax are named as "the most effective way to show up in AI experiences" ([MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)).
- **Offer Highlights [MS]:** Copilot highlights offer dimensions such as free shipping or in-store pickup. The differentiators are supplied in Microsoft Merchant Center. Retail only, in English-speaking markets, on product detail pages in Copilot, Edge and Bing ([MS blog, 21 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/win-across-all-three-eras-of-the-web)).
- **Showroom ads [3P, snippet]:** an immersive Copilot format available only to select pilot advertisers ([Neowin](https://www.neowin.net/news/microsoft-launches-new-ad-formats-exclusively-designed-for-copilot-users/); [SEL](https://searchengineland.com/microsoft-copilot-showroom-ads-dynamic-filters-453019)).
- **Controls [MS]:**
  - AI Max "respects all existing Search campaign controls—including negative keywords, bidding strategies, budgets, conversion goals, and targeting settings".
  - Brand inclusions/exclusions shape brand traffic.
  - Term exclusions keep given words out of generated assets.
  - Messaging guidelines (pilot, up to 40) steer generated copy.
  - URL inclusions (Nov 2026) limit final URL expansion and text sourcing.
  - Brand kit (voice, logos, business name).
  - Sources: [MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [MS blog, 28 Oct 2026](https://about.ads.microsoft.com/en/blog/post/october-2026/build-steer-and-measure-your-campaigns-with-ai-whats-new-in-microsoft-advertising-this-october); [MS blog, 19 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november); [MS blog, 21 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era).
- **Opt-out [3P, snippet, conflicting]:**
  - One guide quotes Microsoft documentation as saying eligible campaigns are automatically opted into Copilot and "advertisers cannot opt out of Copilot delivery separately"; a German blog reports the same.
  - Another blog claims there is a Search-campaign setting to opt out of Copilot placements.
  - I did not verify either claim on a Microsoft page.
  - Sources: [Branded Agency](https://brandedagency.com/blog/advertise-microsoft-copilot-guide); [yagemi.de](https://www.yagemi.de/blog/online-marketing/microsoft-advertising-bing-copilot/); [Stackmatix](https://stackmatix.com/blog/microsoft-copilot-ads-guide).
- **Reporting [MS]:**
  - The "AI optimized" match-type label in the search term and keyword reports.
  - AI-generated assets in the asset report.
  - The search term landing page report (API: SearchTermLandingPageReportRequest, Aug 2026).
  - Search term and asset reporting were available from AI Max launch.
  - Sources: [MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13).
  - A "Microsoft Copilot" network segment in reporting is claimed by 3P blogs only (unverified) ([search result summary](https://stackmatix.com/blog/microsoft-copilot-ads-guide)).
- **Copilot inside the ad platform [MS]:** "Copilot in the Microsoft Advertising Platform" (blog of 13 Jun 2024) now does performance-shift root-cause analysis and conversion-tracking diagnostics (Apr 2026). Diagnostics and performance snapshot went to pilot in Oct 2024 ([SER, 3 Oct 2024](https://www.seroundtable.com/microsoft-advertising-new-experience-38177.html); [MS blog, 21 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era)).

### Inferences
- For Inventarland, Copilot and AI Overview exposure comes mainly through Shopping/PMax and any Search campaign with AI Max (or broad match). The assistant should explain that Copilot traffic is not separately controllable or reportable as far as documented, and that AI Max's "AI optimized" terms are where it shows up.
- Danish-language Copilot ad serving is not documented. Assume the same eligibility as Bing search, but do not promise volume.

### Gaps
- I found no official help page on Copilot ad eligibility, opt-out or reporting segment, and no Danish or EU-specific Copilot ads statement.

## 5. EU/Danish rules: DSA, political ads (Regulation 2024/900), GDPR consent, Danish price marketing (førpris), trademarks

### Takeaway
- **Political ads:** Microsoft does not allow political ads anywhere. Since September 2025 every new or imported campaign must be declared political or not (the IsPolitical field), and "political" campaigns are blocked. Issue-based ads in the EU need a separate approval.
- **DSA:** every ad served on Bing in the EU appears in the public Ad Library.
- **Consent:** Consent Mode or TCF signals have been mandatory for EEA traffic since 5 May 2025.
- **Danish price claims:** for Black Friday (27 Nov 2026) and Christmas, the 30-day lowest-price rule applies, and Black Friday itself counts as a price-reduction claim.
- **Trademarks:** under EU case law, bidding on a competitor's trademark is allowed if the ad does not blur the origin of the goods.

### Cited Findings
- **Political ads [MS]:** "The European Union (EU) Regulation 2024/900 … will take effect on October 10, 2025 … you are required to declare whether campaigns are intended for political advertising before campaign creation and import. If it is, any political advertising must be removed to proceed. Microsoft Advertising doesn't allow political advertising on its platform." The API added a new IsPolitical element on Campaign and BulkCampaign in Sep 2025, and IsPolitical again in Dec 2025 ([API release notes, Sep 2025](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13), fetched).
- **Political ads, history [MS, snippet]:** Microsoft has disallowed ads about elections, parties, candidates and ballot measures globally since its 2018 policy change ([MS blog, Oct 2018](https://advertise.bingads.microsoft.com/en-us/blog/post/october-2018/changes-to-our-political-ads-policy)). Microsoft's ad tech business (Xandr) banned them from 1 Oct 2023 ([Axios](https://www.axios.com/2023/07/27/microsoft-xandr-political-ads-ban), 3P).
- **Political ads, editorial codes [MS, snippet]:** code 151 ("must comply with all … election laws and not exploit political agendas for commercial gain") and code 8216 ("political content which is not allowed") ([Editorial reason codes](https://learn.microsoft.com/en-us/advertising/guides/editorial-failure-reason-codes?view=bingads-13)).
- **Issue-based ads in the EU [MS]:** "All issue-based advertisers must be approved in order to serve on the Microsoft Advertising Network in the European Union." Approval is by form, and applicants need a payment method and active ads ([MS form page](https://about.ads.microsoft.com/en/forms/policies/issue-based-advertising-program-enablement-european-union), fetched).
- **Context [3P, snippet]:** Google, Meta and Microsoft all stopped political ads in the EU rather than comply with Regulation 2024/900. The Commission says the regulation "does not ban political advertising". The Commission guidelines are published as C/2025/5514 ([caliber.az](https://caliber.az/en/post/eu-political-ad-rules-spark-backlash-as-tech-giants-pull-plug); [EUR-Lex C/2025/5514](https://eur-lex.europa.eu/eli/C/2025/5514/oj/eng)).
- **DSA Ad Library [MS, snippet]:**
  - "Pursuant to the EU Digital Services Act, all ads served on Bing in the EU must be publicly available in the Ad Library"; all ad types are eligible.
  - The library is searchable by advertiser name or by words in the ad.
  - Advertisers that completed Advertiser Identity Verification show their advertiser ID; others show their account ID.
  - There is an Ad Library API.
  - Sources: [help 60180](https://help.ads.microsoft.com/apex/index/3/en/60180); [Ad Library API](https://learn.microsoft.com/en-us/advertising/guides/ad-library-api).
  - The DSA has applied to Bing as a very large online search engine since 25 Aug 2023 ([MS EU policy blog](https://blogs.microsoft.com/eupolicy/2023/08/25/microsoft-digital-services-act-online-safety/), snippet).
- **Advertiser Identity Verification [MS, snippet]:** introduced in a June 2023 blog post. New advertisers had to be verified before serving, and Microsoft would show ads only from verified advertisers from 1 Aug 2023 ([MS blog](https://about.ads.microsoft.com/en/blog/post/june-2023/making-microsoft-advertising-safer-with-advertiser-identity-verification); [SEL](https://searchengineland.com/microsoft-advertising-show-ads-only-from-verified-advertisers-427936)). One search result text put the announcement in June 2022, which conflicts with the blog URL.
- **Consent [MS]:**
  - Explicit consent signals have been enforced since 5 May 2025 for visitors from the EEA, UK and Switzerland.
  - The mechanism is the ad_storage parameter (granted or denied).
  - There are three ways, and only one should be used: UET Consent Mode, IAB TCF 2.0 (directly or through a consent management platform), or Google Tag Manager.
  - Without them, Microsoft says it "will impact your advertising performance for site visits originating from the EEA, UK, and Switzerland".
  - Source: [MS blog, 31 Mar 2025](https://about.ads.microsoft.com/en/blog/post/march-2025/providing-user-consent-signals-on-your-microsoft-campaigns-by-may-5-2025) (fetched).
  - Some vendors claim UET conversion tracking and remarketing stop entirely without consent signals ([Cookie Information](https://cookieinformation.com/blog/implement-microsoft-uet-consent-mode/), 3P snippet). Google Consent Mode does not cover Microsoft ([Usercentrics](https://usercentrics.com/knowledge-hub/microsoft-uet-consent-mode/), 3P snippet).
- **AI content labels [MS]:** advertisers decide on and are "responsible for making sure your ads follow local laws and disclosure rules, including deciding whether your content needs an AI label". The controls are generally available as of 19 Nov 2026 ([MS blog](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november)).
- **Danish 30-day rule (førpris) [3P industry bodies, snippet; the Forbrugerombudsmanden text itself was not reached]:**
  - When a reduction is announced, the før-pris must be the lowest price in the last 30 days (prismærkningsbekendtgørelsen § 9 a).
  - It covers explicit før/nu prices and also claims that signal a reduction: "Black Friday", "Black Week", "Cyber Monday", "udsalg", "spar". Forbrugerombudsmanden considers Black Friday/Black Week a price-reduction signal.
  - The Black Friday price can become the reference: a December reduction must use the Black Friday price as the før-pris (for at least 30 days after Black Friday, per one source).
  - Businesses must be able to document their før-priser.
  - Sources: [DI Handel, 12 Oct 2026](https://www.danskindustri.dk/brancher/di-handel/nyhedsarkiv/nyheder/2026/10/black-friday-kan-fa-betydning-for-julehandlen-pas-pa-30-dagesreglen/); [DI prismarkedsføring](https://www.danskindustri.dk/brancher/di-handel/radgivning/viden-om/prismarkedsforing/); [Tænk, new rules](https://taenk.dk/raadgivning/markedsfoering/nye-regler-tilbudspriser).
  - The rules took effect in 2022 ([Dansk Erhverv, May 2022](https://www.danskerhverv.dk/presse-og-nyheder/nyheder/2022/maj/nye-regler-for-prismarkedsforing-trader-nu-i-kraft/), headline only).
- **Campaign length [3P, snippet]:** a savings campaign may run up to 10 days. Older material says 14 days, which no longer applies. This comes from older Dansk Erhverv/DI articles, so verify it ([Dansk Erhverv 2019](https://www.danskerhverv.dk/presse-og-nyheder/nyheder/2019/november/black-friday-black-weekend-black-week-cyber-monday-fa-styr-pa-prismarkedsforingen/)).
- **Enforcement [3P, snippet]:**
  - Black Friday 2026 is 27 Nov ([Dansk Erhverv, Sep 2026](https://www.danskerhverv.dk/presse-og-nyheder/nyheder/2026/september/se-de-gode-rad-sadan-far-du-black-friday-succes-i-ai-araen/)).
  - A Danish company was fined DKK 4.25 million for misleading offer marketing (headline, [Dansk Erhverv, Sep 2026](https://www.danskerhverv.dk/presse-og-nyheder/nyheder/2026/september/virksomhed-far-bode-pa-425-millioner-kroner-for-vildledende-tilbudsmarkedsforing--sadan-er-reglerne/)).
  - An EU-coordinated sweep (press release 26 Mar 2026) found about 1 in 3 traders displayed Black Friday discounts incorrectly; one summary says 314 online shops were checked ([European Commission](https://commission.europa.eu/news-and-media/news/eu-check-reveals-misleading-sales-practices-online-2026-03-26_en); [CCPC](https://www.ccpc.ie/news-and-media/news/article/2026/03/26/investigation-by-ec--ccpc-and-european-consumer-authorities-finds-1-in-3-traders-incorrectly-display-discounts-online-during-black-friday-sales)).
- **Trademarks, EU case law [3P law-firm summaries, snippet]:**
  - Google France (CJEU, 2010): buying a competitor's mark as a keyword is not in itself infringement. It harms the origin function where the ad does not let "a reasonably well-informed and observant internet user" easily tell whether the goods come from the mark owner or an economically linked company.
  - Interflora (C-323/09, 2011): adds the reputation-mark tests (unfair advantage, dilution), and use can infringe even if the mark is not in the ad text.
  - Sources: [Search Engine Land on Interflora](https://searchengineland.com/in-interflora-case-eu-oks-bidding-on-trademarks-with-some-restrictions-94114); [Mintz](https://www.mintz.com/insights-center/viewpoints/2251/2011-09-google-adwords-decision-europe-trademark-owners-may-prevent); [Fieldfisher](https://fieldfisher.com/en/insights/interflora-v-marks-and-spencer).
- **Microsoft IP policy [MS, snippet]:**
  - Advertisers are responsible for keywords and ad content not infringing intellectual property.
  - Microsoft investigates complaints about trademarks in ad text and may act or suspend accounts. Keyword complaints are handled only in listed markets, which I could not see.
  - Fair use of trademarks in ad text is allowed in some cases.
  - ™/® symbols are allowed only if the mark is registered or applied for.
  - Sources: [MS IP policies](https://about.ads.microsoft.com/en-us/policies/intellectual-property-policies); [ad style policies](https://advertise.bingads.microsoft.com/en-us/ad-style-policies).

### Inferences
- **For the app:** create_campaign and any import plan must handle the IsPolitical declaration. Inventarland is never political, so it should be declared false. Verify in find_api_operation whether the API rejects new campaigns without it.
- **Black Friday and Christmas 2026 ad copy:**
  - "Black Friday", "Black Week", "spar X %" or "før/nu" in RSAs, promotion assets or price assets is a price-reduction claim under Danish rules. The før-pris must be the 30-day low and documented.
  - The playbook's rule that every claim must be citable from the landing page should be extended: a før-pris must also be verifiable as the 30-day lowest price (the app's get_shop_products price history, if it exists).
  - Urgency wording needs a real end date, which is already in the playbook.
- **Competitor brand keywords:** these are legally possible in the EU, but the ad must not suggest it is the brand owner. Never put a competitor's trademark in ad text without a reason; Microsoft acts on ad-text complaints.
- **Consent rejections:** Danish consent rates are often low, so Microsoft conversion counts for Danish traffic are partly modelled or missing. That is a further reason the webshop comparison differs.

### Gaps
- I did not reach Forbrugerombudsmanden's own guidance, the text of prismærkningsbekendtgørelsen § 9 a on retsinformation.dk, or the fine decision itself.
- I found no source for the B2B rule that prices may be shown ex moms when clearly aimed at businesses, nor for the B2C rule that prices must include moms. This needs a Danish legal source before it goes into the playbook.
- I could not render Microsoft's current political-content and trademark policy pages (help.ads and the policy pages are JavaScript-rendered).
- I found no Microsoft-specific DSA rules on targeting minors or sensitive-data profiling.

## 6. Practitioner consensus: what works in Microsoft Ads specifically (vs copying Google)

### Takeaway
Microsoft's own 2026 guidance and the third-party practitioners I found agree on these points:
- Do not run a pure Google import on autopilot.
- Rely on conversion-based bidding sooner than older rules said, because the threshold is now ≥5 account conversions.
- Drop Max CPC caps.
- Steer through targets, value rules and seasonality.
- Watch import overwrites and AI Max inheritance.
- Use Microsoft-only levers: LinkedIn (where available), impression-based remarketing, value rules.

Independent, data-backed practitioner studies specific to Microsoft are scarce.

### Cited Findings
- **Import pitfalls [MS]:** scheduled Google imports carry AI Max settings into Microsoft campaigns during future syncs ([MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)). Imports honor the autogenerated asset setting ([MS blog, 16 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)). The Import Center (May 2026) shows post-import tips and errors ([MS blog](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)). For NCA imports, Google "website visitors" segments become rule-based remarketing lists, and Customer Match lists are not supported ([MS blog, 16 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)).
- **"What to check after importing" [MS, snippet]:** Microsoft has a help page with this title ([help 60071](https://help.ads.microsoft.com/apex/index/3/en/60071)), but I could not read its content.
- **Third-party practitioners [3P, snippet]:**
  - Imported structures "rarely align with what works best"; build Microsoft-native campaigns where possible ([Adzooma](https://adzooma.com/blog/the-top-5-microsoft-advertising-mistakes-wasting-small-budgets-and-how-to-fix-them/)).
  - No import selects Microsoft's strongest features automatically, and conversion measurement comes first ([SEO-Day, Jul 2026](https://www.seo-day.de/news/article/how-to-get-the-most-from-microsoft-advertising-campaigns?lang=en)).
  - Check geo targeting and the geo report in week one after import, because location bid adjustments can shift ([Stackmatix](https://stackmatix.com/blog/microsoft-ads-import-from-google)).
- **Bidding [MS]:**
  - Start conversion-based bidding at ≥5 account conversions; below that, use eCPC.
  - Move targets in 15 % steps and review after one conversion cycle.
  - Do not keep Max CPC.
  - Judge at campaign or portfolio level after about 30 conversions in 30 days.
  - Targets are "directional levers", and campaigns may over-achieve them.
  - Source: [MS blog, 18 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
- **Low-volume nuance [3P quoting MS, fetched]:** Navah Hopkins (Microsoft) says: "every account is different so a blanket recommendation still needs to be put to the test … so long as the account has at least 5 conversions total, the system is smart enough … While we still recommend the 30-day evaluation period." SEJ advises checking that reported conversion values match real order totals before moving to Target ROAS ([SEJ, 18 Nov 2026](https://www.searchenginejournal.com/microsoft-rolls-out-its-biggest-bidding-upgrade-in-a-decade/597963/)).
- **Seasonality adjustments [MS]:** only for short, significant events; tROAS/tCPA only; one consistent adjustment across a portfolio unless the patterns clearly differ ([MS blog, 16 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)).
- **Conversion value rules [MS]:** adjust value by location, device or audience, in all campaign types (Feb 2025). Microsoft recommends them in place of Max CPC ([MS blog, 4 Feb 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february); [MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)).

### Inferences
- For Inventarland, mixed B2B and B2C with likely low Danish volume, the realistic path is:
  1. pool conversions through portfolio strategies, including cross-account if relevant;
  2. use value rules rather than bid caps;
  3. use seasonality adjustments for Black Friday;
  4. keep AI Max off, or limited with URL inclusions and brand controls, until search-term quality is proven.

### Gaps
- I found no Optmyzr, Adalysis, JumpFly or PPC Hero study with sample sizes specific to Microsoft in 2025–2026. The searches returned only vendor blogs.
- I found no quantified test of the effect of LinkedIn bid adjustments.

## 7. Against the current rules (playbook microsoftAds.ts and the "Microsoft Advertising know-how" section of prompt.ts)

### Takeaway
Most structural rules still hold. Several are out of date or missing after the 2025–2026 changes. The most important are:
- the minimum conversions for automated bidding (prompt says "15", API docs say 30, Microsoft's Nov 2026 guidance says start at ≥5 and evaluate at 30);
- AI Max on by default for new Search campaigns;
- the Max CPC removal;
- autogenerated RSA assets;
- data-driven attribution and CAPI;
- the IsPolitical declaration;
- LinkedIn not confirmed for Denmark;
- Danish før-pris rules for price claims.

### Cited Findings
Confirmed:
- **prompt.ts: "Manual CPC only for Audience campaigns (Microsoft silently turns it into Enhanced CPC elsewhere)".** Confirmed, with nuance: Manual CPC is available for Audience display/video and hotel; native has been eCPC since May 2024. "The request will be ignored without error" ([learn.microsoft.com bid strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)).
- **prompt.ts: "Since August 2025 campaigns can't be moved to standalone Target CPA/Target ROAS – use the Maximize strategies with a target".** Confirmed: from 4 Aug 2025, existing campaigns and portfolios are unaffected, and API sets are auto-converted ([SER quoting MS help](https://www.seroundtable.com/microsoft-ads-target-cpa-and-target-roas-retire-39688.html)).
- **Playbook: "Microsoft Consent Mode required in the EEA since 5 May 2025 (ad_storage; IAB TCF 2.0 accepted)".** Confirmed. Add that it also covers the UK and Switzerland, that GTM is a third route, and that only one method should be used ([MS blog, 31 Mar 2025](https://about.ads.microsoft.com/en/blog/post/march-2025/providing-user-consent-signals-on-your-microsoft-campaigns-by-may-5-2025)).
- **Playbook: "Target CPA/ROAS ±10–15 % per step".** Confirmed: Microsoft says 15 % increments. The "at least 2 weeks between changes" part should become "review after one conversion cycle, then evaluate after 1–2 cycles" ([MS blog, 18 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)).
- **Playbook: evaluate automated strategies on about 30 conversions in 30 days.** Confirmed as Microsoft's evaluation guidance, at campaign or portfolio level, not ad group or keyword ([MS blog, 18 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)).
- **Playbook: "Use seasonality adjustment … instead of moving targets at Black Friday".** Confirmed in spirit: seasonality adjustments are for short events and apply to tCPA/tROAS campaigns, now including portfolios and shared budgets ([MS blog, 16 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026); [MS blog, 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)). I did not verify the ≤14 days and ≤7 days limits.
- **Playbook: "Menu names change often: say 'typically under …'".** Confirmed as necessary: refreshed UI (Apr 2026), Import Center (May 2026), interface overhaul (Nov 2026) ([MS blog, 21 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/an-ads-ecosystem-built-for-the-ai-era); [MS blog, 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026); [PPC Land](https://ppc.land/microsoft-advertising-overhauls-interface-after-advertiser-complaints/), snippet).
- **Playbook: Google import can overwrite Microsoft-specific changes.** Confirmed and extended: scheduled imports now also carry AI Max settings and the autogenerated-asset setting ([MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [MS blog, 16 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)).
- **Playbook: "Performance Max search themes: SearchInsightPerformanceReport".** Still valid, but PMax search terms are now also in the standard search term report (Aug 2026). There is also a landing page report (Apr 2026), auction insights (Oct 2026) and a search term landing page report (mid-Nov 2026) ([MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [MS blog, 28 Oct 2026](https://about.ads.microsoft.com/en/blog/post/october-2026/build-steer-and-measure-your-campaigns-with-ai-whats-new-in-microsoft-advertising-this-october)).
- **Playbook: "LinkedIn profile targeting … bid adjustment only – it does not narrow reach".** Confirmed for Search, Shopping and DSA, where setup is target plus a bid adjustment ([learn.microsoft.com LinkedIn](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_linkedintargeting); "always Bid only" per a 3P quote of [help 56905](https://help.ads.microsoft.com/apex/index/3/en/56905)). Audience ads can now show only to chosen job roles ([PPC Land](https://ppc.land/microsoft-audience-ads-gain-option-to-show-only-to-chosen-linkedin-job-roles/), snippet).
- **prompt.ts: "typically lower CPCs and older/desktop-heavy audience than Google".** Only partly supported:
  - The CPC claim rests on untraceable or vendor data and is contested by one study ([SearchLab](https://searchlab.nl/en/statistics/microsoft-ads-statistics-2026); [Adzooma](https://adzooma.com/?p=22567), snippets).
  - "Desktop-heavy" fits Denmark: Bing has 13–14 % desktop share against about 8–10 % overall ([StatCounter](https://gs.statcounter.com/search-engine-market-share/desktop/denmark), snippet).
  - "Older" is not backed by current data; the only official figures are US desktop data from 2019, 47 % aged 18–44 ([MS infographic](https://about.ads.microsoft.com/en-us/microsoft-advertising-and-infographic-en.pdf), snippet).
  - Rephrase as "often lower CPC, desktop-heavy in DK; verify with the account's own device report".

Contradicted or outdated:
- **prompt.ts: "Microsoft stops optimising below 15 conversions in 30 days".** Contradicted by Microsoft's API guide (dated 2025-06-26): "If your campaign falls below **30** conversions over any 30-day period, Maximize Conversions [/Target CPA/Target ROAS] will stop optimizing your bids" ([learn.microsoft.com bid strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)). Microsoft's newest guidance (18 Nov 2026) instead says start conversion-based bidding at ≥5 account-level conversions and evaluate at about 30 in 30 days ([MS blog](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)). The "15" figure has no source in this research; replace it.
- **Playbook: "Automated strategies require at least 30 conversions in 30 days. Below that: recommend manual/Enhanced CPC or consolidating campaigns".** Outdated in two ways:
  - Manual CPC does not exist for Search or Shopping.
  - Microsoft now recommends conversion-based bidding from ≥5 account conversions. It reports +18 % conversions at similar CPA when moving from eCPC to Maximize Conversions with a target CPA (internal data, Jun–Jul 2026).
  - Suggested rule: under 5 account conversions → eCPC; 5 or more → Maximize Conversions or Conversion Value (portfolio or consolidated where volume is low), evaluated after about 30 conversions or 1–2 conversion cycles.
  - Source: [MS blog, 18 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
- **Playbook navigation: "Google import: Import → Import schedule and history".** Probably outdated: the new **Import Center** arrived on 19 May 2026 ([MS blog](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)).
- **Playbook: "LinkedIn: ProfessionalDemographicsAudienceReport (CompanyName, IndustryName, JobFunctionName)" and the Company/Industry/Job function dimensions.** Incomplete: Job Seniority is generally available for Search and Audience since 31 Aug 2026; company lists and JobTitle criteria were added to the API in Aug–Sep 2026 ([MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13)). Availability for Denmark is not confirmed: the official six-market list excludes Denmark (see section 2).

Missing from the playbook:
- **AI Max is on by default for new Search campaigns (since 27 Aug 2026).** It expands matching ("AI optimized" label), generates text and swaps final URLs. Controls: negatives, brand inclusions/exclusions, term exclusions, messaging guidelines, URL inclusions. create_campaign should set AI Max explicitly (AISearchSetting in the API) and show it on the approval card ([MS blog, 27 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [API release notes, May 2026](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13)).
- **Max CPC is gone for new non-portfolio Maximize Clicks / Maximize Conversions / Maximize Conversion Value campaigns (1 Oct 2026), and Microsoft advises against Max CPC generally.** The app's "max CPC bid" spending rule cannot be enforced as a campaign setting on such new campaigns. Use a portfolio strategy if a cap is required ([MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [SEJ](https://www.searchenginejournal.com/microsoft-ads-is-removing-max-cpc-from-new-campaigns/586527/)).
- **Autogenerated assets added to existing RSAs that lack the maximum number of assets (Apr 2026), with opt-out.** API field AutoGeneratedAssetsEnabled (Feb 2026). This affects the "keyword pinned in headline 1" style rules and ad review, because Microsoft may serve text the team did not write ([MS blog, 16 Apr 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026); [API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13)).
- **Data-driven attribution for all advertisers (end of May 2026), and Conversions API generally available (28 Oct 2026).** Both should appear in the tracking checklist and explain shifts in Microsoft-attributed revenue vs the webshop ([MS blog, 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026); [MS blog, 28 Oct 2026](https://about.ads.microsoft.com/en/blog/post/october-2026/build-steer-and-measure-your-campaigns-with-ai-whats-new-in-microsoft-advertising-this-october)).
- **Bid-model upgrade rolling out from 18 Nov 2026.** Expect some volatility and faster reaction to target changes. Note it before attributing performance shifts to the team's changes ([MS blog](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)).
- **Political declaration (IsPolitical) required at campaign creation and import since Sep 2025.** Microsoft allows no political ads, and issue-based ads in the EU need approval ([API release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13); [MS EU form](https://about.ads.microsoft.com/en/forms/policies/issue-based-advertising-program-enablement-european-union)).
- **DSA Ad Library:** every Danish ad is public and searchable by competitors. This is useful for competitor research next to web_search ([help 60180](https://help.ads.microsoft.com/apex/index/3/en/60180), snippet).
- **Danish price marketing rules.** Any ad text, promotion asset or price asset with "Black Friday", "Black Week", "spar", "udsalg" or før/nu must respect the 30-day lowest-price rule, and the Black Friday price can become the før-pris for December. The rule should be added to the guardrail "everything in ad copy with prices … needs a clear warning" and to review_ad_copy ([DI Handel, 12 Oct 2026](https://www.danskindustri.dk/brancher/di-handel/nyhedsarkiv/nyheder/2026/10/black-friday-kan-fa-betydning-for-julehandlen-pas-pa-30-dagesreglen/), snippet).
- **Competitor trademarks:** EU case law allows keyword bidding if the ad clearly does not come from the brand owner. Avoid competitor marks in ad text; Microsoft acts on ad-text complaints ([Search Engine Land on Interflora](https://searchengineland.com/in-interflora-case-eu-oks-bidding-on-trademarks-with-some-restrictions-94114); [MS IP policies](https://about.ads.microsoft.com/en-us/policies/intellectual-property-policies), snippets).
- **Copilot / AI Overviews placements:** ads come from existing Search, Shopping and PMax (AI Overviews in all markets except China since 19 Nov 2026). There is no documented Copilot-only opt-out or report, and AI Max and PMax are the main routes ([MS blog, 19 Nov 2026](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november)).
- **PMax new controls:** age and gender targeting and exclusions are generally available; device targeting is rolling out (or in pilot per a 3P report); audience exclusions and refined brand exclusions are in pilot; uplift experiments; NCA goals (Jan 2026; "unknown" treated as existing). Since Smart Shopping was retired (Jan 2025), PMax is the only automated Shopping option ([MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [MS blog, 28 Oct 2026](https://about.ads.microsoft.com/en/blog/post/october-2026/build-steer-and-measure-your-campaigns-with-ai-whats-new-in-microsoft-advertising-this-october); [MS blog, 4 Feb 2025](https://about.ads.microsoft.com/en/blog/post/february-2025/new-performance-max-tools-and-other-product-updates-for-february)).
- **Conversion value rules** (by location, device or audience), named by Microsoft as the replacement for bid caps. They are relevant to weighting B2B vs B2C value ([MS blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)).
- **AI content labels (GA 19 Nov 2026):** the team must decide whether AI-generated images or video need a label under local law ([MS blog](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november)).

### Inferences
- Highest-impact edits for the app:
  1. Replace "15 conversions" and "under 30 → manual/eCPC" with Microsoft's ≥5 / evaluate-at-30 guidance.
  2. Make create_campaign set and show AI Max and IsPolitical explicitly.
  3. Teach that Max CPC cannot be set on new non-portfolio automated campaigns.
  4. Add Danish før-pris checks to ad review around Black Friday (27 Nov 2026) and Christmas.
  5. Make LinkedIn advice conditional on the dimensions actually existing for Danish campaigns.

### Gaps
I did not verify these statements in this scope; they belong to other researchers' areas:
- data "closed" after about 3 hours;
- quality score updated 14–18 hours after day end (the prompt attributes 14–18 h to impression share, the playbook to quality score — one of the two is likely mixed up);
- learning phase of about 2 weeks, up to 30 days, and PMax 2–4 weeks;
- at most 3 RSAs per ad group;
- the 8–10 headlines recommendation;
- offline conversions within 90 days with MSCLKID or hashed email/phone;
- change history covering 6 months with undo within 30 days;
- the 50/50 experiment split;
- audience lists taking 3–4 days;
- the API error codes;
- the keyword planner country list;
- the seasonality ≤14 days and data exclusion ≤7 days limits.
