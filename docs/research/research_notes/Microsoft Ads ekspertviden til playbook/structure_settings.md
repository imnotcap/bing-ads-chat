# Microsoft Advertising: account structure, campaign types and campaign/ad group settings (status November 2026, for a Danish advertiser)

How to read the tags:
- **[OFF-API]**: official Microsoft Advertising API documentation (learn.microsoft.com/advertising, Campaign Management / Ad Insight service, Bing Ads API v13).
- **[OFF-HELP]**: official Microsoft Advertising Help. I read it as Microsoft's mirror on learn.microsoft.com/advertising/msa-help/…, because help.ads.microsoft.com only returns a JavaScript shell to curl. Same content, same article IDs.
- **[OFF-BLOG]**: official Microsoft Advertising blog (about.ads.microsoft.com).
- **[FORUM]**: Microsoft Q&A answers by Microsoft Advertising Support staff. These are semi-official and anecdotal.
- **[3P]**: third-party trade press.
- **[SEARCH-ONLY]**: known only from WebSearch result text. The page could not be fetched because its host is not allowed.

The date after each source is the page's own "last updated" or publication date. All pages were fetched 20–23 Nov 2026.

---

## 1. Account structure, campaign types, what each requires, and availability in Denmark/EU

### Takeaway
The hierarchy is manager account → ad account → campaign → ad group. Currency and time zone belong to the ad account, and the currency can never be changed. The current campaign types are Search (which can also hold Dynamic Search Ads ad groups and the AI Max setting), Shopping, Performance Max, Audience (Display/Native/Video), Hotel/Lodging and App. Campaign type is fixed at creation. Search, Audience and Performance Max are documented as available "in all Microsoft Advertising markets". I could not retrieve the per-feature market list itself, so I have no line that names Denmark explicitly.

### Cited Findings
**Structure and limits**
- Four levels: manager account, accounts, campaigns, ad groups. An account holds the currency, time zone, prepay/postpay setting, payment method and users. Campaigns contain ad groups that share the campaign budget. Separate accounts are suggested for separate businesses, countries/languages or currencies. [OFF-HELP] — [How should I organize my accounts and campaigns? (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutaccts)
- Standard limits:
  - Ad account: 10,000 campaigns; 4,000,000 ads; 5,000,000 keywords+product targets; 5 million negative keywords; 20 negative keyword lists of max 5,000 keywords each.
  - Campaign: 20,000 ad groups; 20,000 negative keywords; 10,000 location targets; 2,500 website exclusions; 100 IP exclusions; 20 sitelinks.
  - Ad group: 100 ads (active+paused); 3 active RSAs; 20,000 keywords; 20,000 negatives.
  - The page also lists "Manager account: 15 users, 6 ad accounts". That looks like a default rather than a hard cap, and it is not verified elsewhere.
  — [OFF-HELP] [aboutaccts (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutaccts)
- Currency is chosen at account creation and "cannot be changed". The fix is a new account plus export/import. DKK is one of the currencies available in all markets. [OFF-HELP] — [Choosing your account currency (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_currency)
- Minimums in DKK (from the Google-import page): Search min bid 0.06, Shopping min bid 0.06, Search/Shopping min daily budget 0.06. [OFF-HELP] — [What gets imported from Google Ads (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)
- Campaign names must be unique among active/paused campaigns in the account (case-insensitive) and can be up to 128 characters. Ad group names must be unique among active ad groups in the campaign and can be up to 256 characters. [OFF-API] — [Campaign (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [AdGroup (2026-09-07)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)

**Campaign types (API value set)**
- CampaignType values: App, Audience, DynamicSearchAds, Hotel (= Lodging), ObjectiveBased, PerformanceMax, Search, Shopping.
  - The standalone "DynamicSearchAds" campaign type "is no longer supported". DSA is now created in "SearchDynamic" ad groups inside a Search campaign.
  - Audience + SubType AudienceVideoAds = video audience campaign.
  - Shopping SubTypes: ShoppingSmartAds (Smart Shopping) and ShoppingSponsoredProductAd (Shopping for brands).
  — [OFF-API] [CampaignType (2026-09-07)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaigntype?view=bingads-13)
- CampaignType "Update: Not allowed". The default on add is Search. SubType is read-only after add. A new campaign's Status defaults to **Paused**. [OFF-API] — [Campaign (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Required settings per type:
  - Shopping must include a ShoppingSetting (Merchant Center store).
  - PerformanceMax must include a PerformanceMaxSetting, plus a ShoppingSetting if it uses a store.
  - Audience campaigns must set Languages = All.
  - Political campaigns are not supported (IsPolitical=true fails).
  — [OFF-API] [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Ad group type cannot be updated. A Search campaign with a DynamicSearchAdsSetting (a "mixed" campaign) can hold SearchStandard and SearchDynamic ad groups. [OFF-API] — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
- Bid strategies per campaign type:
  - Manual CPC: Audience and Hotel only.
  - Enhanced CPC: Search and Shopping.
  - Max Conversions: Audience, Search, Shopping (smart) and Performance Max.
  — [OFF-API] [Budget and Bid Strategies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)
- From 4 Aug 2025 the API no longer supports TargetCpa/TargetRoas bidding schemes. New ones are silently converted to Maximize Conversions/Conversion Value with the target, and existing campaigns are unaffected. [OFF-API] — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- **New (bidding, adjacent area):** from 1 Oct 2026, Max CPC is no longer available when creating new non-portfolio campaigns on Maximize Conversions (with tCPA), Maximize Conversion Value (with tROAS) or Maximize Clicks. Existing campaigns keep it, and portfolio strategies keep it. [OFF-BLOG] — [AI Max for Search and other product news for August 2026 (2026-08-31)](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)

**Search / AI Max / DSA**
- Search ads "available in all Microsoft Advertising markets". They appear on Bing, AOL, Yahoo, DuckDuckGo, Ecosia and other partners, and "Search campaigns may also be extended to audience placements" (MSN, Edge, Outlook.com, publisher partners). [OFF-HELP] — [What are Search ads? (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_searchnetcontentnet)
- **AI Max for Search** (a Search campaign setting, not a campaign type) rolled out globally on 19–20 Aug 2026. It bundles:
  - search term matching (beyond the keyword list; Predictive Matching was folded into it),
  - text customization (auto-generated assets folded into it),
  - final URL expansion,
  - brand inclusions/exclusions.
  — [3P] [ppc.land (2026-08-19)](https://ppc.land/microsoft-advertising-gains-ai-max-across-all-accounts-globally/); [3P] [Search Engine Roundtable (2026-08-20)](https://www.seroundtable.com/microsoft-advertising-ai-max-41909.html)
- AI Max default (conflicting sources):
  - Microsoft: "AI Max will also be enabled by default for any new Search campaigns you create in Microsoft Advertising, though it can still be turned off". Scheduled Google imports carry AI Max settings over. DSA campaigns remain supported "until further notice", and Google DSA campaigns upgraded to AI Max are converted back to DSA on import. — [OFF-BLOG] [Reimagining search campaigns… with AI Max (2026-08-27)](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)
  - Contradicted by the Microsoft Ads Liaison as quoted by SER: "AI Max remains an opt-in setting for new and existing campaigns". — [3P] [SER (2026-08-20)](https://www.seroundtable.com/microsoft-advertising-ai-max-41909.html)
  - The later official blog (27 Aug) is the newer statement.
- Up to 20 brand lists per campaign can be attached under AI Max brand controls (seen in the UI screenshot). [3P] — [ppc.land (2026-08-19)](https://ppc.land/microsoft-advertising-gains-ai-max-across-all-accounts-globally/)
- Later AI Max controls:
  - Messaging guidelines added in October 2026.
  - URL inclusions for final URL expansion are rolling out from November 2026.
  - Ads in AI Overviews on Bing run through existing campaigns (incl. PMax and AI Max) "in all markets except China".
  — [OFF-BLOG] [What's new this November (2026-11-19)](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november)
- API counterparts on Campaign:
  - MessagingRestrictions: up to 40 × 300 characters.
  - TermExclusions: up to 25 terms × 30 characters, Get since revision 2026-09-28.
  - [OFF-API] [Campaign (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Microsoft confirmed (18 Dec 2025) that exact match keywords hold absolute auction priority over all other campaign types. [3P] — [ppc.land (2026-08-19)](https://ppc.land/microsoft-advertising-gains-ai-max-across-all-accounts-globally/). This is consistent with the PMax help: "Ad delivery for Search campaigns with exact match keywords is prioritized over Performance Max campaigns." [OFF-HELP] — [About Performance Max (2026-06-11)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- DSA → PMax upgrade is offered as a recommendation.
  - Eligibility: ≤100 active DSA ad groups, no shared budget, standard daily budget.
  - Kept settings: budget, bid target, geo, language, URL rules, page-feed exclusions, account negatives, extensions.
  - If the preconfigured assets fail the minimum, the DSA campaign stays active.
  — [OFF-HELP] [About upgrading DSA to PMax (2026-07-27)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dsa_pmax_upgrade)
- Text ad formats:
  - Expanded/Standard Text Ads can no longer be created or edited.
  - Existing ETAs still serve and can be paused, enabled or removed.
  - Standard Text Ads stopped serving in **February 2025**.
  — [OFF-HELP] [Ad types (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_adoptions)

**Performance Max**
- PMax is "available in all Microsoft Advertising markets". [OFF-HELP] — [About PMax (2026-06-11)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- PMax went global on 5 Mar 2024. [3P] [SER](https://www.seroundtable.com/microsoft-advertising-pmax-global-36996.html); [OFF-BLOG, SEARCH-ONLY] [March 2024 blog](https://about.ads.microsoft.com/en-au/blog/post/march-2024/performance-max-and-other-key-updates-for-march)
- PMax timing: the first impression comes within 3 days (with Product ads) or 4 days (without). The learning period after optimizations or new assets is 2–4 weeks or 2–3 conversion cycles. Asset group editorial review is usually done within 48 h. [OFF-HELP] — [About PMax (2026-06-11)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- Website exclusions for PMax work at account level only. msn.com, outlook.com, outlook.live.com and microsoftcasualgames.com cannot be excluded. [OFF-HELP] — [About PMax (2026-06-11)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- PMax supports only location, location intent, radius and daytime targets, and only at campaign level. [OFF-API] — [Show Ads to Your Target Audience (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13)
- PMax device targeting/exclusion is "currently in pilot" (NegativeCampaignCriterion for Computers/Smartphones/Tablets, with at least one device left un-excluded). [OFF-API] — [DeviceCriterion (2026-11-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13)
- Language for PMax can be set at campaign level only. [OFF-HELP] — [How does ad language and location targeting affect… (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_loctargetandlang)
- No shared budgets and no portfolio bid strategies with PMax or Smart Shopping. [OFF-API] — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [OFF-HELP] [Shared budgets (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets)
- Smart Shopping is legacy and can be upgraded manually to PMax (Edit > Upgrade to Performance Max). After upgrade the learning period is about 2 weeks. [OFF-HELP] — [About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)

**Shopping and Audience**
- Shopping campaigns:
  - need a Microsoft Merchant Center store/catalog feed,
  - use a Campaign Priority setting (High > Medium > Low, regardless of bid),
  - must match the campaign's Country/region of sale to the feed's Country of sale (or use a feed label).
  — [OFF-HELP] [Shopping campaign benefits (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview)
- Audience campaigns:
  - "available in all Microsoft Advertising markets",
  - Display, Native and Online Video ads, which can be combined in one campaign since Dec 2024,
  - serve on MSN, Microsoft Start, Edge, Outlook.com and publisher partners.
  — [OFF-HELP] [What are Audience campaigns? (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_nativeads); [What's new (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_whatsnew)

**Denmark / EU specifics**
- Danish ("DA") is a supported ad language for Search and Shopping campaigns. [OFF-API] — [Campaign.Languages (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [Ad languages guide (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/ad-languages?view=bingads-13)
- **Danish is NOT among the supported display (UI) languages.** The interface and emails come in English or another listed language. Danish *is* a supported billing language. [OFF-HELP] — [About language options (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutlanguageoptions)
- Demographic restriction (EU-relevant compliance): advertisers in financial, insurance, education, career/employment or housing services "cannot use individuals' demographics—such as age, gender, location, etc.—for the purpose of personalizing advertising, segmenting, or profiling customers". [OFF-HELP/OFF-API] — [How can I get my ads in front of my customers? (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_targeting); [AgeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/agecriterion?view=bingads-13)
- Euro-currency Shopping minimum bid of 0.01 applies only to FR, DE, ES, CH, AT, BE, NL, IT and SE. DKK has its own minimum of 0.06. [OFF-HELP] — [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)

### Inferences
- For a Danish DKK advertiser, Search, Shopping, PMax and Audience can be treated as available, because "all markets" is stated for Search, Audience and PMax, and Shopping minimums exist for DKK. Per-feature exceptions (e.g. some vertical ads, Discover feed, Smart Search, Smart mode) are not available in Denmark. Discover is only live in US/CA/UK/AU/IN per the Nov 2026 blog.
- Because AI Max is (per the official 27 Aug blog) on by default for new Search campaigns, a "create_campaign" tool should explicitly set AI Max off/on per the team's decision. Otherwise new campaigns may expand queries and landing pages without approval.
- Navigation guidance in Danish ("Kampagner → …") will not match what users see, because the UI cannot be shown in Danish. Use the English menu names (optionally with a Danish gloss).

### Gaps
- The help page "Market availability for Microsoft Advertising and its features" could not be read: help.ads.microsoft.com is JS-only, and the learn mirror for hlp_BA_CONC_Countries returned 404. So there is no source that names Denmark per feature (e.g. LinkedIn profile targeting, DSA, Multimedia ads, Copilot ads in DK).
- I did not verify the API mechanism for turning AI Max off (no API field found in the pages read).
- I did not verify whether the "Manager account 15 users / 6 ad accounts" limit is a real cap.

---

## 2. Locations (targeting, intent, radius, exclusions) and languages

### Takeaway
- **Location intent default:** both the API and UI-created campaigns default to "people in, searching for, or viewing pages about" the location (PeopleInOrSearchingForOrViewingPages). A Danish shop that only ships in Denmark must actively switch to "People in".
- **Removed option:** the separate "only searching for/viewing pages about" option was deprecated in April 2024.
- **Ad group geo settings:** an ad group's geo targets replace the campaign's as a whole set.
- **Radius:** radius targets cannot be used to exclude.
- **Languages:** ad language is set per campaign (a list) and can be overridden per ad group. Danish is supported.

### Cited Findings
- **Location intent values:**
  - IntentOption values: PeopleIn, PeopleInOrSearchingForOrViewingPages, and PeopleSearchingForOrViewingPages.
  - "PeopleSearchingForOrViewingPages is deprecated as of April 2024". Setting it is converted to PeopleInOrSearchingForOrViewingPages, and existing campaigns were converted automatically.
  — [OFF-API] [IntentOption (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/intentoption?view=bingads-13)
- **Location intent default and rules:**
  - "The default value is PeopleInOrSearchingForOrViewingPages."
  - A LocationIntentCriterion is added automatically with that default when the first criterion is created.
  - There is max one per campaign/ad group, and it "cannot be deleted".
  — [OFF-API] [LocationIntentCriterion (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationintentcriterion?view=bingads-13)
- **Example and UI defaults:**
  - Microsoft's own example: London target + PeopleInOrSearchingFor… means a person in Florida searching London hotels sees the ad. With PeopleIn they do not.
  - UI-created campaigns get "recommended default criteria", and the bulk example shows the location intent as PeopleInOrSearchingForOrViewingPages.
  - A brand-new API campaign has **no criteria = all locations, ages, days, devices**.
  — [OFF-API] [Show Ads to Your Target Audience (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13)
- The UI offers exactly two choices: "People in your targeted locations" or "people in, searching for, or viewing webpages about your targeted locations". [OFF-HELP] — [How to target customers (2026-06-17)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
- **Geo inheritance:**
  - Location, negative location and radius are "a set of geo criterions". If the ad group has any geo criteria, none of the campaign's are inherited.
  - The location intent used is the one belonging to whichever set is used.
  - Ad group criteria of the same type override campaign criteria and are "not applied as a union".
  — [OFF-API] [LocationCriterion (2026-09-07)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13)
- **What can be targeted:**
  - all countries/regions; countries/regions and states/provinces; US counties; cities, metro areas and postal codes; or a radius around a postal code, coordinates, landmark or area.
  - Unsupported postal codes are converted into a radius target.
  - "You cannot exclude using radius targeting."
  - Location targeting/exclusion "may not always work" because of geolocation limits.
  — [OFF-HELP] [How can I get my ads in front of my customers? (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_targeting)
- **Radius limits:**
  - Radius must be a whole number: 1–800 km or 1–500 miles.
  - Max 2,000 radius criteria per campaign/ad group.
  - Location+negative location: max 10,000 per campaign/ad group.
  - Location/radius criteria cannot be updated in place (Update "Not allowed" on the location fields).
  — [OFF-API] [RadiusCriterion (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/radiuscriterion?view=bingads-13); [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13)
- Before adding a location, check its Status in the geo-locations file. A PendingDeprecation location is no longer used, and deprecated ones cannot be added or updated. [OFF-API] — [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13)
- Exclusions can be set at campaign or ad group level: "cities and metro areas within the United States, Canada, United Kingdom, France, and Australia; states/provinces; countries/regions; or postal codes". Radius exclusion is not possible. [OFF-HELP] — [How to prevent your ads from showing to certain people (2026-06-11)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addexclusions)
- **Location bid adjustments:**
  - Adjustments on geographically nested locations are not combined; the most refined one applies.
  - Different criterion types multiply: 1.20 × 1.30 = +56%, rounded to 2 decimals.
  — [OFF-API] [Show Ads to Your Target Audience](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13)
- **Language basics:**
  - The campaign Languages list applies to all ad groups.
  - An ad group Language overrides the campaign. Setting the ad group language to "" defers to the campaign.
  - "Once campaign languages are set, you cannot delete all of them". An update *replaces* the list and does not append.
  - Audience: must be "All", and no ad group language is allowed.
  - DSA: languages are ignored in favour of the domain language (set All).
  — [OFF-API] [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
- **Language eligibility:**
  - Ads are eligible when the search query language or the user's language settings match the ad language, and the location criteria are also met.
  - Microsoft does not translate ads.
  - PMax and App campaigns: language and location are set at campaign level only.
  — [OFF-HELP] [loctargetandlang (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_loctargetandlang)
- Some EU languages (Bulgarian, Croatian, Czech, Estonian, Greek, Hungarian, Latvian, Lithuanian, Maltese, Polish, Romanian, Slovak, Slovenian) are "not yet available for everyone". Danish, Swedish, Norwegian, Finnish, English and German are not in that limited list. [OFF-API] — [Campaign.Languages](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Google import location handling:
  - Unsupported locations are expanded to the parent location by default (EnableParentLocationMapping = true).
  - If this is turned off, the unsupported targets are dropped and "your campaigns will continue to serve worldwide without location targeting".
  - Location groups are not imported.
  — [OFF-HELP] [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo); [OFF-API] [GoogleImportOption (2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13)

### Inferences
- In Denmark, Danish city/metro exclusions are probably unavailable, since the city exclusion list names only US/CA/UK/FR/AU. Exclusions should use regions, postal codes or the country.
- When an ad group has its own location targets, the campaign's location *exclusions* and intent setting no longer apply to that ad group. Copy them down, or keep all geo at campaign level.
- For a webshop delivering only in Denmark, "People in" avoids paying for searches about Denmark from abroad. Expats/cross-border shoppers are lost. This is a business decision and should be stated as such.

### Gaps
- I found no official list of which Danish location types (kommuner, cities, postal codes) are targetable. The geo-locations file (GetGeoLocationsFileUrl) was not downloaded.

---

## 3. Networks: Microsoft sites vs. search partners, ad group network setting, Audience Network, excluding partners and websites

### Takeaway
Ad distribution is an **ad group** setting with two live options:
- "Entire Microsoft Advertising Network" (default and recommended)
- "Microsoft sites and select traffic"

"Syndicated search only" is deprecated (July 2024). Even the narrow option includes some partner traffic that is reported in aggregate. Search ads can also serve as Audience ads. Microsoft now steers opt-out to **website exclusions**; the old −100% audience-ads bid adjustment should not be relied on.

### Cited Findings
- **Network values:**
  - Network values: InHousePromotion (Shopping for brands only), OwnedAndOperatedAndSyndicatedSearch ("entire Microsoft Advertising Network (recommended)") and OwnedAndOperatedOnly ("Microsoft sites and select traffic").
  - "SyndicatedSearchOnly is deprecated as of July 2024."
  — [OFF-API] [Network (2026-06-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/network?view=bingads-13)
- **Ad group network setting:**
  - Default OwnedAndOperatedAndSyndicatedSearch.
  - Not settable for Audience campaigns (always the Microsoft Audience Network) or Smart Shopping.
  - Negative sites are set via SetNegativeSitesToAdGroups/Campaigns.
  — [OFF-API] [AdGroup.Network](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
- **What the two options contain:**
  - "Entire network" = Microsoft sites (Bing, MSN, Outlook.com) + select partner traffic + additional partner traffic (Bing and Yahoo search partners such as Ask.com and Forbes).
  - "Microsoft sites and select traffic" = Microsoft sites + select partner traffic, "reported in aggregate, you cannot see individual reports for each domain".
  - "All options include search and Audience ads."
  - Although set when creating a campaign, "it's an ad group-level setting" (Ad group > Settings > Advanced settings > Ad distribution).
  - From July 2024, Shopping campaigns for brands can no longer use syndicated-only.
  — [OFF-HELP] [Ad distribution settings (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutaddistributionhidden)
- Search ads appear on Bing, AOL, Yahoo, DuckDuckGo, Ecosia and other partners. "To opt out of Audience ads, we recommend using website exclusions." [OFF-HELP] — [What are Search ads? (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_searchnetcontentnet); [What is the Microsoft Advertising Network? (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvertisingnetwork)
- **Audience ads bid adjustment (sources conflict):**
  - API: Campaign/AdGroup AudienceAdsBidAdjustment ranges −100 to +900, and "Setting the bid adjustment to -100 will prevent audience ads from showing". — [OFF-API] [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
  - Contradicted in practice: Search Engine Land reports that Microsoft "discontinues bid modifiers for audience ads", with the option removed "starting Feb. 23" (year not in the snippet; likely 2023), and that the remaining route is website exclusions. — [SEARCH-ONLY, 3P] [Search Engine Land](https://searchengineland.com/microsoft-revises-multi-channel-advertising-approach-and-discontinues-bid-modifiers-for-audience-ads-392594)
  - Microsoft support agreed in 2024: the search/audience integration "is now standard practice", and "the only way to minimize the delivery of your search ads to our Audience Network is by adjusting your ad delivery settings and adding websites… to the website exclusion list". — [FORUM] [Microsoft Q&A (2024-08-07)](https://learn.microsoft.com/en-us/answers/a/2068239)
- **Website exclusion limits and levels:**
  - Max 2,500 URLs per campaign; ad-group exclusions override campaign exclusions.
  - Each URL can contain a domain + one subdomain + max two directories.
  - For **Search** campaigns you cannot block Yahoo or Microsoft search traffic (Bing, AOL), but you can block audience traffic (MSN, Edge, Outlook.com).
  - For **Audience** campaigns you cannot block Microsoft sites.
  - Apps are excluded by adding the mobile bundle ID from the Website URL (publisher) report to the exclusion list.
  - Use the Website URL (publisher) report to find partner sites.
  — [OFF-HELP] [addexclusions (2026-06-11)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addexclusions)
- **Website control lists:**
  - Path: Tools > Content suitability > Website control lists.
  - Account-level (cross-account) exclusion lists can only be created in the manager account, and a list must be associated with ≥1 account/campaign to take effect.
  - Campaign-level lists can be used by Audience, Search, Shopping and Lodging campaigns.
  - "Microsoft sites such as MSN.com cannot be excluded."
  - The same page says that for Search campaigns "we won't show your ads on Microsoft sites if you've added website exclusions for them". Its wording conflicts slightly with addexclusions above (which says Bing/Yahoo search can't be blocked).
  — [OFF-HELP] [About website control lists (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_webexclusionstargetedwebsites)
- List limits: max 10,000 URLs per website exclusion list and 3 shared website lists per manager account. Advertisers complained that blocked sites still served. [FORUM] — [Microsoft Q&A (2024-08-07)](https://learn.microsoft.com/en-us/answers/a/2068239)
- IP exclusions: campaign level only, max 100 per campaign, IPv4 only, wildcard only in the last octet. [OFF-HELP] — [addexclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addexclusions)
- Google import mapping: Google Search Network + "Include search partners" → all Microsoft search networks. Search & Display → Search. "Microsoft Advertising stopped serving ads on the content network." Ad distribution updates are re-imported by default (UpdateAdGroupNetwork = true). [OFF-HELP] — [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo); [OFF-API] [GoogleImportOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13)

### Inferences
- "Bing only" does not exist. The narrowest setting still includes aggregated "select" partner traffic and Audience-ad placements. The assistant must never promise that OwnedAndOperatedOnly = Bing.com only.
- To curb Audience placements from Search campaigns, recommend: (1) website exclusions for msn.com / outlook.com / partner domains seen in the publisher report, (2) account-level content exclusions, and (3) checking whether the −100% audience bid adjustment is still accepted in this account before relying on it.

### Gaps
- I found no official dated deprecation notice for the AudienceAdsBidAdjustment opt-out. The API page still documents it, and only third-party and forum sources describe its removal.

---

## 4. Ad schedule, devices, demographics

### Takeaway
- **Bid adjustment ranges:** schedule and demographic adjustments range from −90% to +900%; device adjustments from −100% to +900%.
- **Overrides:** ad-group criteria of the same type replace the campaign's.
- **Schedule time zone:** schedules follow the account time zone by default; the viewer's time zone is optional.
- **Devices:** all three device types must exist together, and Microsoft may adjust device bids in real time.
- **Age exclusions:** only possible at ad group level.

### Cited Findings
- **Ad schedule (help):** set via Ad schedule. Bid adjustments "up to 900%" and "decrease them by as much as 90%". You choose whether the schedule follows the account's time zone or the ad viewer's. [OFF-HELP] — [How to target customers (2026-06-17)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
- **DayTime criteria (API):**
  - FromHour runs 0–23 and ToHour 0–24 (ToMinute must be 0 if ToHour is 24).
  - Existing ranges cannot be modified; delete and re-add.
  - Ad-group day/time criteria override the campaign's (no union).
  - Max 49 per campaign/ad group, max 7 per day, no overlapping ranges.
  — [OFF-API] [DayTimeCriterion (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion?view=bingads-13); [Show Ads to Your Target Audience](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13)
- **Schedule time zone (sources conflict):**
  - API: AdScheduleUseSearcherTimeZone exists on campaign and ad group. Default false = account time zone. For ad groups the default changed from true to false "after September 30, 2020". — [OFF-API] [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
  - Contradicted by older-looking text in the targeting guide ("When targeting by time, you are targeting the searcher's local time zone") and the time zone help page (day/time targeting "uses the customer's local time zone"). — [OFF-API] [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13); [OFF-HELP] [Changing your account time zone (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone)
  - Read the actual flag on the entity rather than assuming.
- **Devices:**
  - Target computers, tablets or smartphones with bid adjustments "from -100% to +900%".
  - "we'll automatically change your bid adjustments for device type in real time to optimize performance… the actual bid amount may be higher or lower."
  - Not available in Smart mode or PMax, and no targeting by model or brand.
  — [OFF-HELP] [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
- DeviceCriterion rules: three criteria (Computers, Smartphones, Tablets) must be added together, otherwise none are added. Ad-group device criteria override the campaign's. DeviceName cannot be updated. [OFF-API] — [DeviceCriterion (2026-11-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13)
- Device bid adjustments "will be considered and combined with automated bidding". With automated strategies, bid adjustments are used "as signals". [OFF-API] — [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13); [OFF-HELP] [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
- **Google import of negative computer bid modifiers (sources conflict):**
  - Help: by default "we won't import negative bid modifiers for computer targets (except modifiers set to -100%)". — [OFF-HELP] [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)
  - Contradicted by the API: the AutoDeviceBidOptimization option ("do not import negative bid modifier for desktop except -100%") is "turned off by default". — [OFF-API] [GoogleImportOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13)
- **Age and gender:**
  - Age ranges in Search, DSA and Shopping: 18–24, 25–34, 35–49, 50–64 and 65+. Audience campaigns add Unknown.
  - Gender: Male and Female, plus Unknown in Audience.
  - The campaign-level negative age criterion is not supported; the ad group level is.
  — [OFF-API] [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13)
- Demographic bid adjustments range from +900% to −90%. "Excluding age targeting can only be done within your ad group level settings." Under-18s never see mature-category ads, and an opt-out form covers under-18s generally. [OFF-HELP] — [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
- **Target and bid vs bid only:** without a TargetSetting, Age, Audience, CompanyName, Gender, Industry and JobFunction criteria are effectively "bid only". A TargetSetting can make them "target and bid" (i.e. restrictive). [OFF-API] — [AdGroup.Settings](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
- LinkedIn profile criteria (company, industry, job function): max 1,000 company criteria per campaign/ad group. ProfileExpansionEnabled is an account property for LinkedIn targeting expansion. [OFF-API] — [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13); [AccountPropertyName (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/accountpropertyname?view=bingads-13)
- Company list and job seniority targeting exist for Search campaigns only and are "not everyone… yet". [OFF-HELP] — [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
- Google import brings over age and gender only, not parental status or household income. The Google 45–54 age group "will not be imported". [OFF-HELP] — [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)

### Inferences
- Schedule adjustments only go down to −90%. To stop serving at certain hours, leave those hours out of the schedule.
- A device adjustment of −90% (the app's default for mobile/tablet) is allowed. Microsoft may still adjust it in real time, so mobile traffic will not drop by exactly 90%.
- Setting an ad-group schedule silently discards the campaign schedule for that group. Check both levels before saying "the campaign runs 08–22".

### Gaps
- I did not verify the 15-minute granularity of the Minute value set (FromMinute/ToMinute). The enum page was not fetched.

---

## 5. Budgets: daily behaviour, overspend, monthly cap, standard/accelerated, shared budgets, limited status, mid-month changes

### Takeaway
- **Budget types:** daily (standard) budgets, shared budgets, and lifetime budgets (Audience only).
- **Accelerated delivery:** retired for Search, DSA and Shopping on 1 Nov 2019.
- **Overspend:** a single day can overspend. Microsoft "usually" keeps it under 2× the daily budget, but one API page says 20%.
- **Monthly cap:** a monthly limit is enforced, and spend above it is refunded. Its formula on a budget change is spend-to-date + daily × remaining days.

### Cited Findings
- **Budget types:**
  - Three types: Daily–Standard, Shared–Standard and Lifetime. Lifetime is "only available for Audience campaigns", and you can't switch between lifetime and standard after saving.
  - When the daily limit is reached, "all ad groups in your campaign are paused".
  — [OFF-HELP] [Discover your budget options (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)
- **Monthly limit (help):**
  - "monthly budget = daily budget x 30.4". A mid-month change makes it "Spend-to-date + (daily budget x days remaining)".
  - Overspend above the monthly limit is refunded at month end.
  - The daily budget is "a target… usually keeps overspend to less than 100% above your daily limit".
  - Budget changes take effect "within an hour or so".
  — [OFF-HELP] [aboutbudgettype (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)
- **Monthly limit (API guide, sources conflict on the base formula):**
  - Contradicted by the API guide on the base formula: it calculates the monthly limit as "daily budget × number of days in the month", recomputed at midnight on the 1st in the campaign's time zone.
  - Same mid-month formula, with the example "$250 + $10(17)" for 15 July.
  - The new formula applies only when the budget is updated; otherwise the existing monthly budget stays enforced.
  - Next month it reverts to daily × days.
  — [OFF-API] [Budget and Bid Strategies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)
- **Daily overspend (sources conflict):**
  - BudgetLimitType page: DailyBudgetStandard "can exceed the daily budget limit by up to 20%; however, the accumulated daily spend will not exceed the calculated monthly budget limit". — [OFF-API] [BudgetLimitType (2025-04-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/budgetlimittype?view=bingads-13)
  - Contradicted by the Campaign object, the budget guide and the help page ("usually… less than 100% above"). — [OFF-API] [Campaign.DailyBudget](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- **Budget limit type values:**
  - BudgetLimitType values: DailyBudgetAccelerated (only for Audience campaigns with unshared campaign budgets), DailyBudgetStandard, and LifetimeBudgetStandard (lifetime, requires EndDate ≤ 1 year after start).
  - A campaign's budget does not need to be higher than its bids.
  — [OFF-API] [BudgetLimitType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/budgetlimittype?view=bingads-13); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Accelerated budget was deprecated for Search, DSA and Shopping, with automatic migration to Standard "starting on November 1" 2019. [3P] — [ppc.land (2019-10-06)](https://ppc.land/microsoft-advertising-to-depreciate-64df3ea5e36c17001bef1015); [OFF-BLOG, SEARCH-ONLY] [Coming changes to your budget strategy features (Oct 2019)](https://about.ads.microsoft.com/en-us/blog/post/october-2019/coming-changes-to-your-budget-strategy-features)
- **Delivery statuses:**
  - "Eligible (limited)" means the campaign ran out of budget at least once in the past 7 days, or is predicted to in coming weeks.
  - "Campaign out of budget" means no ads are running.
  — [OFF-HELP] [Limited / Out of budget (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_limitedoroutbudget)
- Out of budget → "Ad display will resume at the start of the next day". Raising the budget resumes it now. [OFF-HELP] — [Fix Campaign out of budget (2026-06-11)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_alertbudgetdepleted)
- The service sets the campaign status to BudgetPaused when the budget is depleted and back to Active when restored. BudgetAndManualPaused = the user paused it after a budget pause. [OFF-API] — [CampaignStatus (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaignstatus?view=bingads-13)
- **Shared budgets:**
  - Path: Tools > Bids & budgets > Shared budgets.
  - Not supported by Performance Max or Premium Streaming.
  - A depleted shared budget shows "Budget paused".
  - To unshare, choose "Individual budget".
  — [OFF-HELP] [Share a budget across multiple campaigns (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets)
- With the API, the budget amount/type of a campaign using a shared budget can't be updated (CampaignServiceCannotUpdateSharedBudget). Set BudgetId = 0 plus a DailyBudget to unshare. [OFF-API] — [Campaign.BudgetId](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- "Automatic budget adjustment" can come from automated rules, shared budgets or automated imports. Imports keep "reactivating the campaigns and modifying the settings back to what they are on Google Ads (including the budget)". Check Change history. [OFF-HELP] — [aboutbudgettype](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)
- New bidding models (Nov 2026): "Budgets pace more evenly throughout the day and campaigns ramp to full budget faster". Microsoft advises making target changes in 15% steps to limit volatility. [OFF-BLOG] — [Building the next generation of automated bidding (2026-11-18)](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)

### Inferences
- Plan with "one day can reach up to ~2× the daily budget; the month cannot exceed the monthly cap". Treat the 20% figure as unconfirmed.
- Lowering a budget late in the month changes that month's cap immediately via the formula. Raising it late in the month gives only days-left × daily of new headroom.

### Gaps
- I found nothing official that explains the 20% vs 100% discrepancy, and nothing on whether the 30.4 or days-in-month formula is used in billing for the first month.

---

## 6. Start/end dates and campaign/ad group statuses: serving and editability

### Takeaway
- **Dates:** for Search and Shopping, start/end dates belong to the **ad group**; campaign dates are only honoured for Audience campaigns.
- **Expired ad groups:** an expired ad group can be revived by extending its end date.
- **Start date:** the start date cannot be changed once it has passed.
- **Defaults:** new campaigns and ad groups default to Paused.
- **Deleted entities:** not returned by the API and not editable.

### Cited Findings
- **Ad group start/end dates:**
  - StartDate is inclusive from 00:00. It defaults to today and "cannot be updated after the ad group is submitted i.e., once the start date has arrived".
  - EndDate is inclusive to 23:59. "The end date can be extended to make an ad group's ads eligible for delivery, even after the ad group expires."
  - To remove an end date, set it to ≥ 2 Jan 2050; it then reads back as null.
  - If the campaign uses campaign-level dates, the ad group's dates are set from the campaign.
  — [OFF-API] [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
- **Ad group statuses:**
  - AdGroupStatus values: Active, Paused, Expired ("set if you specify an end date… and the end date passes"; read-only) and Deleted (internal; Get never returns deleted objects).
  - Keywords and ads added while the ad group is Paused are subject to editorial review.
  - Add default: Paused.
  — [OFF-API] [AdGroupStatus (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroupstatus?view=bingads-13); [AdGroup.Status](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
- **UI delivery statuses:**
  - Eligible; Ad group expired (fix: pick a new end date); Ad group paused; **Draft ad group** (fix: Edit > Enable); Campaign paused; Campaign out of budget.
  - "Your account must also have no account errors or none of your ads will run."
  — [OFF-HELP] [Understand your ad group status (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_understandingadgroupstatus)
- **Campaign statuses:**
  - CampaignStatus values: Active, Paused, BudgetPaused, BudgetAndManualPaused, Suspended ("suspended because of suspicious activity, and no ads are eligible… contact Microsoft Advertising Support") and Deleted (internal).
  - Only Active/Paused can be set. Add default: Paused.
  — [OFF-API] [CampaignStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaignstatus?view=bingads-13); [Campaign.Status](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- **Campaign dates:**
  - Campaign StartDate/EndDate: "Currently, this will only be honored for Audience campaigns".
  - UseCampaignLevelDates must be true for lifetime budgets.
  - The campaign start date can be updated only until the campaign starts serving.
  — [OFF-API] [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Google import: Google has campaign-level dates and Microsoft ad-group-level dates, so "the imported campaign level date range will override the existing ad group date range". If the Google campaign end date has passed, the ad group end date is set to 1 Jan 2050. [OFF-HELP] — [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)
- Changing the account time zone switches pending start/end dates to the new zone. "An ad group that has expired in the last 24 hours may be revived if you move the time zone forward." [OFF-HELP] — [Changing your account time zone (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone)
- Pausing an ad group pauses all its ads and keywords. Pausing a campaign pauses everything in it. [OFF-HELP] — [ad group status](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_understandingadgroupstatus)
- Experiments: expired ad groups are not copied into experiments. When an experiment is promoted, the base campaign's expired ad groups are deleted. [OFF-API] — [Experiment (2026-09-23)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/experiment?view=bingads-13)
- Change history shows 6 months, including system changes. Changes from the last 30 days can be undone if eligible. "There is no way to undo imports from uploaded files or from other platforms, such as Google Ads". [OFF-HELP] — [Change history (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changehistorygraph)

### Inferences
- "Can an expired ad group be edited?" Yes. Set a later end date (or ≥ 2050 for none) and it serves again. The Expired status itself cannot be set directly.
- To time-limit a Search campaign, set end dates on its ad groups (or pause it). A campaign end date has no effect outside Audience campaigns.

### Gaps
- I did not find whether keywords/ads inside an Expired ad group can still be edited in the UI (likely yes, but not stated).

---

## 7. Experiments (A/B), Google Import, auto-applied recommendations

### Takeaway
- **Experiments:** split a campaign's budget and traffic (1–99%). They inherit budget, status and time zone, can't use shared budgets or DSA settings, and run one at a time per campaign.
- **Scheduled Google imports:** default to "update existing items", including status, bids, bid strategies, budgets, targets and URLs. They are the main cause of "paused campaigns turning back on", and imports cannot be undone.
- **Auto-apply recommendations:** applied after a 7-day review unless unchecked under Recommendations → lightning bolt. The API control is in the Ad Insight service.

### Cited Findings
**Experiments**
- **Eligibility (sources conflict):**
  - API: experiments are available for Audience, Search, Shopping and PMax campaigns without DSA settings. Mixed (DSA) campaigns can't be base or experiment. Shared-budget campaigns can't be a base. — [OFF-API] [Experiment (2026-09-23)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/experiment?view=bingads-13)
  - Contradicted by the help: "Currently, only Search campaigns are eligible for experiments". — [OFF-HELP] [About experiments (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_about)
  - The help TOC also lists separate "Performance Max upgrade" and "Uplift" experiments.
- **Experiment rules (API):**
  - Up to 10 non-concurrent experiments per base campaign; TrafficSplitPercent 1–99 can't be changed while running.
  - ExperimentType TrafficBased (search-based, default) or CookieBased, which can't be changed.
  - The end date can't be extended once passed.
  - Budget, BudgetType, Status and TimeZone are inherited from the base; a base budget change is split by the traffic split.
  - Pausing the base pauses the experiment.
  - Promoted = the experiment's settings are copied to the base, and "any changes to the base campaign settings during the experiment e.g., new ad groups have effectively been deleted".
  - Not copied: expired ad groups, keywords with destination URL, standard text ads, deleted in-market audience associations.
  — [OFF-API] [Experiment](https://learn.microsoft.com/en-us/advertising/campaign-management-service/experiment?view=bingads-13)
- **Experiment practice (help):**
  - The 50/50 split is recommended. The start date defaults to the next day.
  - Base campaign changes (except budget) don't reach the experiment, "we strongly recommend not making any changes to the original campaign's settings while an experiment is running".
  - Results are coloured green/red/grey by statistical significance.
  - "Apply to new campaign" pauses the original and creates a new campaign with the same budget, while the API's "Graduated" description says the base regains 100% of traffic. The difference is wording; the outcome is the same.
  — [OFF-HELP] [About experiments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_about)
- Recommended run time: keep both arms identical for the first 2 weeks, then run A/B for ≥2 weeks (≥4 weeks in total). Only one experiment runs per campaign at a time. Use search-based splits for bidding tests and cookie-based splits for ad copy/imagery tests. [OFF-HELP] — [Examples and tips (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_bestpractices)
- AI Max features can be tested via optimization experiments, all three together or individually. [3P] — [SER (2026-08-20)](https://www.seroundtable.com/microsoft-advertising-ai-max-41909.html)

**Google Import**
- **Schedule options and visibility:**
  - Schedule options: Auto, Now, Once, Daily, Weekly and Monthly.
  - Imports can be scheduled at account *and* manager-account level, so check both.
  - Scheduled imports fetch only items that changed in Google since the last import. "Run now" re-imports items changed only in Microsoft.
  - "If Updates to existing items is turned on, then campaign status updates (such as Paused/Enabled)… will be imported." Bids, bid strategies and budgets follow the Update bids / Update bid strategies / Update existing campaign budgets settings.
  - Deleting the schedule unlinks the campaigns, and a schedule created by another agency can't be edited.
  — [OFF-HELP] [Edit your scheduled imports (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importschedulehistory)
- Imports scheduled via the API (AddImportJobs) appear only in the ad-account context, not under the manager account's scheduled imports. Newly supported entity types are automatically included in all existing scheduled imports until opted out. [OFF-API] — [Google Ads Import guide (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/google-ads-import?view=bingads-13)
- **Import option defaults:**
  - On by default:
    - UpdateEntities ("Updates to existing items"; the master switch for all Update* options).
    - Status: UpdateStatusForCampaigns, UpdateStatusForAdGroups, UpdateStatusForAds and UpdateStatusForKeywords.
    - Bids and budgets: UpdateBids, UpdateBiddingStrategies and UpdateCampaignBudgets.
    - Targeting: UpdateLocationTargets, UpdateDeviceTargets and UpdateAdSchedules.
    - Settings: UpdateAdUrls, UpdateNegativeSites, UpdateNegativeKeywordLists, UpdateCampaignAdGroupLanguages and UpdateAdGroupNetwork.
    - Minimums and mapping: RaiseBidsToMinimum and RaiseCampaignBudgetsToMinimum ("the amount of money you spend overall may increase"), plus EnableParentLocationMapping.
    - New items: NewEntities and NewActiveCampaignsAndChildEntities.
  - Off by default: DeleteRemovedEntities, PauseNewCampaigns, NewPausedCampaignsAndChildEntities, PauseCampaignsWithoutSupportedLocations, EnableAutoCurrencyConversion and AutoDeviceBidOptimization.
  - AdjustmentForBids ranges from −90 to +900.
  — [OFF-API] [GoogleImportOption (2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13)
- **Overwrite warning:** "Microsoft Advertising may overwrite existing campaign data—this includes bids, budgets, and settings". A previously imported campaign may be overwritten, paused or removed, or renamed. Use "Items not previously imported" to avoid overwriting. [OFF-HELP] — [importwhatinfo (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)
- Negative keyword lists: identically named lists are updated, negatives are merged, and "Microsoft Advertising associations will be overwritten by any current Google Ads associations". [OFF-HELP] — [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)
- **Bid strategies, time zone and URLs on import:**
  - Unsupported bid strategies become Enhanced CPC (Audience: manual CPC) with recommended bids.
  - Without a Microsoft conversion goal, conversion-based strategies are converted (e.g. PMax → Maximize Clicks).
  - Time zone: the first import uses the account time zone, and after that it doesn't change.
  - utm_source=google is rewritten to bing.
  - Importing tracking options is not recommended if they are managed outside Google. Search Ads 360-managed tracking updates aren't imported.
  — [OFF-HELP] [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)
- **Not imported:**
  - automated rules and IP exclusions;
  - affinity, customer-list and YouTube audiences, and Google Analytics remarketing lists;
  - parental/household income demographics and the 45–54 age group;
  - Google Hosted Conversions/Smart Goals;
  - location groups;
  - video files;
  - political campaigns (skipped);
  - expanded text ads (since 1 Feb 2023).
  - Mappings: Demand Gen → Audience campaigns; Google PMax → PMax or Search.
  — [OFF-HELP] [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo); [OFF-API] [GoogleImportOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13)
- Support explanation: paused campaigns keep re-activating because "a scheduled import is in place, and the status of the campaign has been chosen when updating existing items, so each time an import is successful any previous actions will be overridden". Automated rules are the other usual cause. [FORUM] — [Microsoft Q&A (2021-06-10)](https://learn.microsoft.com/en-us/answers/a/2069162)

**Auto-applied recommendations and other automation**
- **Auto-apply in the UI:**
  - Path: Campaigns > Recommendations > Auto-apply recommendation setting (lightning bolt icon). Tick or clear each type and Save.
  - Opted-in types are applied automatically after the 7-day review period.
  - Types: Repairs (conversion goal settings); Keyword & targeting (create DSA, remove conflicting negatives, add keywords, broad match keywords, trending queries); Ads & extensions (RSA, Multimedia ads, ad suggestions).
  - History: Change history with "Change by = Recommendations auto apply" (6 months), plus "My applied recommendation history" (30 days).
  — [OFF-HELP] [Auto-apply recommendation settings (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_autoapplyrec)
- **Auto-apply in the API:**
  - The Campaign Management account property AutoApplyRecommendations "is deprecated as of November 30, 2022". Use the Ad Insight Auto-apply interface instead. — [OFF-API] [AccountPropertyName (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/accountpropertyname?view=bingads-13)
  - SetAutoApplyOptInStatus keys: ResponsiveSearchAdsOpportunity, MultiMediaAdsOpportunity, RemoveConflictingNegativeKeywordOpportunity, FixConversionGoalSettingsOpportunity and CreateConversionGoalOpportunity, each true/false. — [OFF-API] [SetAutoApplyOptInStatus (2024-11-13)](https://learn.microsoft.com/en-us/advertising/ad-insight-service/setautoapplyoptinstatus?view=bingads-13)
- In 2022, advertisers were opted in to auto-apply by default when it left beta. [SEARCH-ONLY, 3P] — [Search Engine Land (2022)](https://searchengineland.com/microsoft-auto-apply-recommendations-available-and-opted-in-by-default-380705)
- Automated extensions are separate from auto-apply and are opted out at account level. [SEARCH-ONLY, OFF-HELP] — [Opting out of Automated Extensions](https://help.ads.microsoft.com/apex/index/3/en/60014)
- Other account-level automation switches exist as account properties: AssetAIEnhancementOptout, AllowImageAutoRetrieve (use of images from your domain on the Audience Network) and IncludeViewThroughConversions. [OFF-API] — [AccountPropertyName](https://learn.microsoft.com/en-us/advertising/campaign-management-service/accountpropertyname?view=bingads-13)

### Inferences
- Before concluding anything from a performance swing or a status that "changed by itself", check (a) the scheduled imports at both account and manager level and (b) auto-apply history in Change history.
- A safe scheduled import for a Microsoft-managed account is: UpdateEntities off, or at least status/bids/bid strategies/budgets/targets/URLs off; NewPausedCampaigns off; PauseNewCampaigns on.
- Because the help says experiments are Search-only while the API lists more types, the assistant should only promise Search experiments and verify other types in the UI.

### Gaps
- Today's default opt-in state of auto-apply for new accounts is not stated in current official docs.
- I did not verify whether AI Max counts as an auto-applied recommendation (it is a campaign setting).

---

## 8. Account-level settings that affect everything (auto-tagging/MSCLKID, tracking template, final URL suffix, time zone)

### Takeaway
- **Time zone:** since March 2022 the time zone is an account-level setting; the campaign time zone is deprecated. Changing it shifts dates, reporting and that day's spend.
- **MSCLKID auto-tagging:** on by default.
- **Tracking templates and final URL suffixes:** can be set at account level and overridden lower down. The lowest level wins, and values are not combined.

### Cited Findings
- **Account time zone:**
  - "As of March 2022, time zones are no longer editable at the campaign level and will instead directly align with your account level."
  - Changing the account time zone changes all campaigns. It affects pending ad group start/end dates (and can revive an ad group expired within 24 h), splits reporting between old and new zones (allow 1–2 days), and gains or loses hours of spend on the change day.
  - It does *not* change scheduled Google imports, day/time targeting, automated rules or billing.
  - Path: Settings > Account settings.
  — [OFF-HELP] [Changing your account time zone (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone)
- The account time zone sets the Campaigns page date range and the default report time zone; a report's time zone can be changed per report. Time zone "only impact[s] data and [doesn't] affect the locations where your ad may show". Performance data is retained 36 months. [OFF-HELP] — [How does the account time zone impact data? (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_timezone)
- Campaign.TimeZone: "This column is deprecated." The older rule still in the docs: it can't be updated if the campaign "contains or has ever contained ad groups in the Active or Paused state". Experiments inherit the base time zone. [OFF-API] — [Campaign (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- **MSCLKID auto-tagging:**
  - It "is enabled by default". It adds a click ID that is passed to UET events and rescues conversions when cookies are blocked.
  - To disable: Settings > Account level options > clear "Add Microsoft Click ID (MSCLKID) to URLs…".
  - The API property is MSCLKIDAutoTaggingEnabled.
  — [OFF-HELP] [Auto-tagging of Microsoft Click ID (2026-06-17)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_microsoftclickid); [OFF-API] [AccountPropertyName](https://learn.microsoft.com/en-us/advertising/campaign-management-service/accountpropertyname?view=bingads-13)
- **Tracking templates:**
  - Levels: account, campaign, ad group, ad, keyword and sitelink (Search). For PMax: campaign + asset group. For Shopping: account/campaign/ad group/product group.
  - The lowest level overrides.
  - Max 2,048 characters, and it must contain {lpurl} or another landing page parameter.
  - Custom parameters can't be defined at account level.
  - Path: Settings > Account level options.
  — [OFF-HELP] [Create an account tracking template (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_upgradeurl_tracktemplateglobalparam)
- Campaign custom parameters: the first 8 are accepted, and more than 8 returns an error. Non-existent custom parameters are not validated and are left unsubstituted. [OFF-API] — [Campaign.UrlCustomParameters / TrackingUrlTemplate](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- **Final URL suffix:**
  - Can be set at account, campaign, ad group, keyword, dynamic ad target, ad, sitelink or product group level.
  - It can't start with ?, & or # and can't contain {lpurl}-type placeholders.
  - "if you've set different ones at multiple levels, we'll default to the lowest level available. We don't combine values from different levels."
  — [OFF-HELP] [Using a final URL suffix (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_upgradeurl_finalurlsuffix)
- Other account properties settable via SetAccountProperties: AdClickParallelTracking, FinalUrlSuffix, TrackingUrlTemplate, MSCLKIDAutoTaggingEnabled, IncludeViewThroughConversions, ProfileExpansionEnabled, AllowImageAutoRetrieve, AssetAIEnhancementOptout, BlockedContentSegments and BusinessAttributes. [OFF-API] — [AccountPropertyName (2026-11-09)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/accountpropertyname?view=bingads-13)
- Content exclusions for sensitive content categories are available at account level (since Dec 2024). [OFF-HELP] — [What's new (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_whatsnew)
- AI Max final URL expansion routes clicks to other pages on the site, so tracking that assumes a fixed landing page can break. On Google, static templates without {lpurl} misroute; Microsoft has published no equivalent caveat. [3P] — [ppc.land (2026-08-19)](https://ppc.land/microsoft-advertising-gains-ai-max-across-all-accounts-globally/)

### Inferences
- A campaign-level final URL suffix *replaces* (not extends) the account suffix. If the team keeps UTM parameters at account level, a campaign suffix silently drops them.
- Turning MSCLKID off breaks offline conversion import (which needs MSCLKID) and cookie-less conversion capture. Never recommend it.

### Gaps
- The parallel tracking help page was not read in detail, so I don't know whether it is mandatory for all accounts now.

---

## Against the current rules (src/ai/playbooks/microsoftAds.ts and prompt.ts sections "Microsoft Advertising know-how" / "Documented Microsoft Advertising rules")

### Takeaway
Most structural API rules in prompt.ts are confirmed. Four need correcting or updating:
- The campaign time-zone rule is outdated: the time zone has been account-level since March 2022.
- The "Delt bibliotek" navigation path is outdated, and the UI cannot be shown in Danish, so Danish menu names won't match.
- The budget/overspend rule should note the conflicting 20% figure and the 30.4 formula.
- "LinkedIn = only bid adjustment" is only the default.

Several rules are missing: location intent default, geo set inheritance, network options, Audience-network opt-out, ad-group dates and expiry, AI Max default-on, Google-import defaults beyond status/bids/budgets, experiment limits, the auto-apply mechanics and MSCLKID default.

### Cited Findings
**Confirmed**
- "Campaign type can never be changed after creation." CONFIRMED: CampaignType "Update: Not allowed"; SubType read-only. [OFF-API] — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- "Shared budgets are changed on the budget, not on the campaign." CONFIRMED: CampaignServiceCannotUpdateSharedBudget. Add: shared budgets don't work with PMax, Premium Streaming, Smart Shopping or experiments. [OFF-API] — [Campaign.BudgetId](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13); [OFF-HELP] [Shared budgets](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets)
- "Experiment campaigns always inherit budget, status and time zone from their base campaign." CONFIRMED, and BudgetType is inherited too. [OFF-API] — [Experiment](https://learn.microsoft.com/en-us/advertising/campaign-management-service/experiment?view=bingads-13)
- "Budget: changing a daily budget mid-month sets the month's cap to spend so far + new daily × days left (including today)… usually under 2×… monthly cap is enforced… within about an hour." CONFIRMED. [OFF-API] [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [OFF-HELP] [aboutbudgettype](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)
  - ADD: help gives the base monthly limit as daily × 30.4, while the API says days in the month.
  - ADD: overspend above the monthly cap is refunded.
  - ADD: one API page says the daily overspend is "up to 20%" ([BudgetLimitType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/budgetlimittype?view=bingads-13)).
  - ADD: the recalculation only happens when the budget is changed.
- "New ad groups start paused unless set active; an ad group without a CPC bid gets the currency's minimum bid." CONFIRMED. [OFF-API] — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
  - ADD: new *campaigns* also default to Paused ([Campaign.Status](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)).
  - ADD: the DKK minimum is 0.06 ([importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)).
- "Campaigns can be BudgetPaused (budget used up) or Suspended (by Microsoft)." CONFIRMED. [OFF-API] — [CampaignStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaignstatus?view=bingads-13)
  - MISSING: BudgetAndManualPaused.
  - MISSING: ad group Expired is read-only but reversible by extending EndDate.
  - MISSING: start date is locked once reached.
  - MISSING: UI "Draft ad group".
  - MISSING: Deleted objects are never returned.
  - MISSING: account errors stop everything.
- "Manual CPC only for Audience campaigns (… Enhanced CPC elsewhere). Since August 2025 campaigns can't be moved to standalone Target CPA/Target ROAS." CONFIRMED. ManualCpc is listed for Audience and Hotel, and the TargetCpa/TargetRoas schemes have not been supported since 4 Aug 2025 (silent conversion). [OFF-API] — [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13); [Campaign.BiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
  - MISSING: from 1 Oct 2026, Max CPC can't be set on new non-portfolio Maximize Conversions/Conversion Value/Clicks campaigns. [OFF-BLOG] — [Aug 2026 product news](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026). This matters for the app's max CPC spending rule.
- Playbook guardrail "Foreslå aldrig at slå auto-anvendte anbefalinger til" and checklist item "auto-anvendte anbefalinger er slået fra". CONFIRMED as necessary: opted-in types are applied automatically after 7 days without action. [OFF-HELP] — [Auto-apply settings](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_autoapplyrec)
  - ADD: the API route is Ad Insight SetAutoApplyOptInStatus; the old account property was deprecated on 30 Nov 2022 ([AccountPropertyName](https://learn.microsoft.com/en-us/advertising/campaign-management-service/accountpropertyname?view=bingads-13)).
- Navigation "Anbefalinger… Auto-anvendelse: lynikonet". CONFIRMED (Campaigns > Recommendations > lightning bolt). [OFF-HELP] — [autoapplyrec](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_autoapplyrec)
- Navigation "Google-import: Import → Importplan og -historik. Tjek både konto- og managerkonto-niveau". CONFIRMED (Import > Import schedule & history; both levels). [OFF-HELP] — [importschedulehistory](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importschedulehistory)
  - ADD: API-created schedules show only at ad-account level ([Google Ads Import guide](https://learn.microsoft.com/en-us/advertising/guides/google-ads-import?view=bingads-13)).
- Navigation "Ændringshistorik… (6 måneder; fortryd inden for 30 dage)". CONFIRMED. [OFF-HELP] — [Change history](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changehistorygraph)
  - ADD: imports from Google/files cannot be undone.
- Navigation "Eksperimenter: Kampagner → Eksperimenter → Opret (50/50-split anbefales)". CONFIRMED. [OFF-HELP] — [About experiments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_experiments_about)
  - ADD: the split and type are locked while running; one experiment at a time; no shared budgets; no DSA settings.
  - ADD: Microsoft recommends 2 weeks identical + ≥2 weeks A/B.
- Navigation "Kontoindstillinger (fx tidszone): Indstillinger → Kontoindstillinger". CONFIRMED (Settings > Account settings). [OFF-HELP] — [changetimezone](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone)
- Playbook "Google-import… kan overskrive… status (pausede kampagner tændes igen), bud, budstrategier, budgetter, URL'er, navne og tilknytning af negative lister. Anbefal 'kun nye elementer'". CONFIRMED. [OFF-HELP] — [importwhatinfo](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo); [aboutbudgettype](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype); [FORUM] [Q&A 2021](https://learn.microsoft.com/en-us/answers/a/2069162)
  - ADD: also updated by default are location targets, device targets, ad schedules, languages, ad distribution (network) and negative sites.
  - ADD: RaiseBidsToMinimum and RaiseCampaignBudgetsToMinimum are on by default.
  - ADD: switching EnableParentLocationMapping off makes campaigns with unsupported targets serve worldwide.
  - ADD: scheduled imports only touch items that changed in Google since the last run.
  - Defaults source: [GoogleImportOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/googleimportoption?view=bingads-13).
- Playbook default "mobil og tablet -90 %". Allowed: device range −100 to +900. [OFF-HELP] — [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
  - ADD: Microsoft may change device adjustments in real time, and they act as signals under automated bidding.
  - ADD: all three device criteria must be sent together.
  - ADD: ad group device criteria replace the campaign's.
- Playbook "Performance Max 2–4 uger" learning. CONFIRMED (2–4 weeks or 2–3 conversion cycles; first impression within 3–4 days). [OFF-HELP] — [About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- Checklist "konto-tidszone = København". CONFIRMED as the right lever, because the time zone is account-level. [OFF-HELP] — [changetimezone](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone)

**Contradicted or outdated**
- prompt.ts "A campaign's time zone cannot be changed once it has (or has had) active or paused ad groups." OUTDATED/CONTRADICTED. Since March 2022, time zones are not editable at campaign level and follow the account; Campaign.TimeZone "is deprecated". The correct rule: change the account time zone (affects all campaigns, dates, reporting and that day's spend). [OFF-HELP] — [changetimezone (2026-06-26)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_changetimezone); [OFF-API] [Campaign.TimeZone](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Playbook navigation "Delt bibliotek (website-udelukkelser, delte budgetter): Værktøjer → Delt bibliotek". OUTDATED. The current paths are Tools > Bids & budgets > Shared budgets and Tools > Content suitability > Website control lists. [OFF-HELP] — [Shared budgets](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets); [Website control lists](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_webexclusionstargetedwebsites)
- Playbook navigation in Danish ("Kampagner → …", "Værktøjer → …"). PROBLEMATIC. Danish is not a supported display language, so the UI shows English (or another listed language). Give the English menu names first. [OFF-HELP] — [About language options (2026-06-19)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutlanguageoptions)
- Playbook "LinkedIn-profilmålretning… Kun budjustering – det indsnævrer ikke rækkevidden". PARTLY CONTRADICTED. "Bid only" is the default when no TargetSetting exists, but a TargetSetting can set CompanyName/Industry/JobFunction to "target and bid" (restrictive), and negative profile criteria (exclusions) exist. [OFF-API] — [AdGroup.Settings](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13); [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13)
- Playbook "Rapporternes tidszone skal være København (ellers bruger Microsoft Pacific-tid…)". PARTLY. UI reports default to the *account* time zone and can be changed per report. [OFF-HELP] — [timezone](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_timezone). I did not verify the Pacific default for API reports here (reporting area).

**Missing (should be added)**
- Location intent. Default is "people in, searching for, or viewing pages about" (PeopleInOrSearchingForOrViewingPages), both in the API and in UI-created campaigns. "Only searching for" was deprecated in April 2024. The intent criterion can't be deleted. For a DK-only shop, propose "People in" as an explicit decision. [OFF-API] — [LocationIntentCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationintentcriterion?view=bingads-13); [IntentOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/intentoption?view=bingads-13)
- Geo set inheritance. Any ad-group geo criterion means none of the campaign's locations, exclusions or radius apply to that group. Radius can't be used to exclude. Nested location bid adjustments are not combined (the most specific one wins). [OFF-API] — [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion?view=bingads-13); [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13); [OFF-HELP] [addexclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addexclusions)
- A new API campaign without criteria targets the whole world. The app's create_campaign must always add Denmark plus the intent setting. [OFF-API] — [Show Ads guide](https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13)
- Languages:
  - Danish is supported; the ad group language overrides the campaign.
  - A language update replaces the list, and you can't remove all languages.
  - Audience campaigns must use "All"; PMax uses campaign level only.
  - [OFF-API] — [Campaign.Languages](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- Ad distribution:
  - Ad-group-level setting with two options; syndicated-only was deprecated in July 2024.
  - "Microsoft sites and select traffic" still includes aggregated partner traffic.
  - Search ads may serve as Audience ads; opt out with website exclusions (max 2,500 per campaign; Bing/Yahoo search can't be excluded).
  - Don't rely on −100% audience bid adjustment.
  - IP exclusions: 100 per campaign.
  - [OFF-API] [Network](https://learn.microsoft.com/en-us/advertising/campaign-management-service/network?view=bingads-13); [OFF-HELP] [Ad distribution settings](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutaddistributionhidden); [addexclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addexclusions); [What are Search ads?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_searchnetcontentnet)
- Ad schedule:
  - Range −90% to +900% (no −100%: leave hours out instead).
  - Max 7 periods/day and 49 in total; can't be edited, only replaced.
  - Ad group schedule replaces the campaign's.
  - Time zone follows the account by default (AdScheduleUseSearcherTimeZone = false).
  - [OFF-HELP] [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender); [OFF-API] [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion?view=bingads-13); [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13)
- Demographics:
  - Range −90% to +900%; age exclusion at ad group level only.
  - Ban on demographic personalisation for financial/insurance/education/employment/housing advertisers.
  - [OFF-HELP] — [How to target customers](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_targetingagegender)
- Ad group dates:
  - Search campaigns use ad-group start/end dates; campaign dates only work for Audience campaigns.
  - An expired ad group serves again after extending its end date.
  - The start date is locked once reached.
  - [OFF-API] — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup?view=bingads-13); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign?view=bingads-13)
- AI Max:
  - Global since Aug 2026 and "enabled by default for any new Search campaigns" (the official blog; SER/Liaison say opt-in).
  - It can expand queries, generate ad text and change landing pages.
  - Treat it like auto-apply: decide explicitly per campaign and put it on the approval card.
  - [OFF-BLOG] — [AI Max blog (2026-08-27)](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [3P] [SER](https://www.seroundtable.com/microsoft-advertising-ai-max-41909.html)
- Budget types:
  - Lifetime budgets are Audience-only.
  - Accelerated delivery is gone for Search, DSA and Shopping (since 1 Nov 2019).
  - "Eligible (limited)" = ran out of budget ≥1 time in 7 days or is predicted to.
  - An out-of-budget campaign resumes the next day.
  - [OFF-API] [BudgetLimitType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/budgetlimittype?view=bingads-13); [OFF-HELP] [Limited / Out of budget](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_limitedoroutbudget); [3P] [ppc.land 2019](https://ppc.land/microsoft-advertising-to-depreciate-64df3ea5e36c17001bef1015)
- Campaign types:
  - The DSA campaign type is retired; DSA lives inside Search campaigns.
  - ETAs can't be created or edited, and STAs stopped serving in Feb 2025.
  - PMax limits: no shared budgets, no portfolio strategies, campaign-level location/schedule only, account-level website exclusions only, device targeting only in pilot.
  - Search exact match keywords beat PMax in the auction.
  - [OFF-API] [CampaignType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaigntype?view=bingads-13); [OFF-HELP] [Ad types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_adoptions); [About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- Account settings:
  - MSCLKID auto-tagging is on by default; keep it on (offline conversions need it).
  - Tracking templates and final URL suffixes: the lowest level wins and levels are not combined.
  - The currency (DKK) can never be changed.
  - [OFF-HELP] [MSCLKID](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_microsoftclickid); [Final URL suffix](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_upgradeurl_finalurlsuffix); [Tracking template](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_upgradeurl_tracktemplateglobalparam); [Currency](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_currency)

### Inferences
- Highest-value fixes for the app:
  1. Replace the campaign time-zone rule.
  2. Add location intent and geo-inheritance rules to set_campaign_targeting / create_campaign.
  3. Add AI Max default-on handling to create_campaign.
  4. Switch the navigation names to the English UI labels and update the shared library paths.

### Gaps
- I could not verify per-market (Denmark) availability of individual features (LinkedIn profile targeting, Multimedia ads, Copilot ads) because the market-availability page could not be fetched.
- I could not check whether the −100% AudienceAdsBidAdjustment is still accepted by the API/UI in practice.
