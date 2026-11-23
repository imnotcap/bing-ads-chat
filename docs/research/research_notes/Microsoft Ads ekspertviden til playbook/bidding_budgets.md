# Microsoft Advertising bidding strategies, bid adjustments and budget optimisation (status 20 November 2026)

Source labels used throughout: **[OFF]** = official Microsoft documentation or Microsoft Advertising blog; **[3P]** = third party. Dates are the page's "last updated"/publish date as served on 2026-11-20. "(snippet)" = host not fetchable, claim taken from WebSearch result text only. Help-center articles were read from Microsoft's own learn.microsoft.com mirror of help.ads.microsoft.com (`/advertising/msa-help/…`, ms.date 2026-06-18 unless noted). That mirror predates the 1 Oct 2026 Max CPC change, so where it and later sources disagree, the later source wins.

Timeline of changes relevant to this area:
- **May 2024**: Manual CPC no longer possible for Audience *native* campaigns; existing ones converted to Enhanced CPC. Setting Manual CPC on any other campaign type is ignored without an error and becomes Enhanced CPC.
- **2 Apr 2024**: Maximize Conversion Value (optional target ROAS) opened to standard Search and Shopping campaigns. Before that it was Smart Shopping only.
- **Sep 2024**: Max Conversion Value became available as a portfolio strategy (per ppc.land).
- **4 Aug 2025**: Standalone Target CPA and Target ROAS can no longer be chosen for new campaigns, or for campaigns not already using them. They became optional targets inside Maximize Conversions and Maximize Conversion Value.
- **10 Nov 2025**: Share-of-voice metrics added for Performance Max.
- **May 2026**: Several bidding features became generally available:
  - cross-account portfolio bidding
  - average-target metrics
  - seasonality adjustments for portfolios and shared budgets
  - data-driven attribution
- **1 Oct 2026**: Max CPC removed when creating new non-portfolio Max Conversions, Max Conversion Value and Max Clicks campaigns.
- **18 Nov 2026**: Rollout of the "biggest upgrade to bidding models in a decade" began.
- **12 Jan 2027 (announced)**: The API MaxCpc field disappears for new campaigns and for existing campaigns that don't already use it.

Source list (all fetched 2026-11-20 unless marked "snippet"; date = page's last-updated or publish date):

*[OFF] Microsoft API documentation, learn.microsoft.com/advertising*
- [BiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddingscheme?view=bingads-13) — 2026-09-15
- [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13) — 2026-10-29
- [MaxConversionValueBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionvaluebiddingscheme?view=bingads-13) — 2026-10-29
- [MaxClicksBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxclicksbiddingscheme?view=bingads-13) — 2026-10-29
- [TargetCpaBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetcpabiddingscheme?view=bingads-13) — 2026-10-29
- [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme?view=bingads-13) — 2026-10-29
- [TargetImpressionShareBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetimpressionsharebiddingscheme?view=bingads-13) — 2024-12-03
- [EnhancedCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/enhancedcpcbiddingscheme?view=bingads-13) — 2024-11-13
- [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13) — 2026-09-23
- [CostPerSaleBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/costpersalebiddingscheme?view=bingads-13) — 2024-11-13
- [MaxRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxroasbiddingscheme?view=bingads-13) — 2024-11-13
- [BidStrategy (portfolio)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidstrategy?view=bingads-13) — 2025-11-14
- [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13) — 2024-12-03
- [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13) — 2026-11-15
- [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion?view=bingads-13) — ms.date 2024-11-13
- [AudienceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/audiencecriterion?view=bingads-13) — ms.date 2024-11-13
- [SeasonalityAdjustment](https://learn.microsoft.com/en-us/advertising/campaign-management-service/seasonalityadjustment?view=bingads-13) — ms.date 2024-11-13
- [Budget and Bid Strategies guide](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13) — 2025-06-26
- [Currencies](https://learn.microsoft.com/en-us/advertising/guides/currencies?view=bingads-13) — 2025-06-26
- [Report attributes and performance statistics](https://learn.microsoft.com/en-us/advertising/guides/report-attributes-performance-statistics?view=bingads-13) — 2025-06-26
- [Performance Max guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max?view=bingads-13) — 2026-09-15

*[OFF] Microsoft help center* (learn.microsoft.com mirror of help.ads.microsoft.com; ms.date 2026-06-18 unless noted)
- [Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [Bid adjustments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding)
- [Seasonality adjustments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments)
- [Data exclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions)
- [Portfolio bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy_portfolio)
- [Bid strategy report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategyreport)
- [Share of voice / impression share](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_imprsharereports)
- [Eligible (limited) / out of budget](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_limitedoroutbudget)
- [Budget options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)
- [Shared budgets](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets)
- [Set budget and bids](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_setcampaignbudgetandbidamounts)
- [Budget Center](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_budgetcenter)
- [Minimum bid (Shopping)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productads_minbid)
- [Shopping overview](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview)
- [Bid estimates](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_location_opportunity) — 2026-05-30
- [Did I bid high enough?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_biddingstrategy)
- [Refine your bids](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_refinebids)
- [Bid landscape](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidlandscape)
- [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices) — 2026-05-30
- [About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax) — 2026-05-30

*[OFF] Microsoft Advertising blog*
- [Building the next generation of automated bidding](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising) — 2026-11-18
- [November 2026 product news](https://about.ads.microsoft.com/en/blog/post/november-2026/put-ai-to-work-engaging-customers-in-more-places-whats-new-in-microsoft-advertising-this-november) — 2026-11-19
- [August 2026 product news (Max CPC)](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026) — 2026-08-31
- [May 2026 product news](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026) — 2026-05-19
- [April 2024: Max conversion value for Search/Shopping](https://about.ads.microsoft.com/en/blog/post/april-2024/max-conversion-value-for-search-and-other-updates-for-april) — 2024-04-02
- [July 2018 Target CPA/Max Conversions launch](https://advertise.bingads.microsoft.com/en-in/blog/post/july-2018/automated-bidding-strategies-target-cpa-and-maximize-conversions) — snippet only

*[3P] Third party*
- [Search Engine Roundtable: tCPA/tROAS retire](https://www.seroundtable.com/microsoft-ads-target-cpa-and-target-roas-retire-39688.html) — 2025-07-01
- [Search Engine Roundtable: bidding models upgrade](https://www.seroundtable.com/microsoft-advertising-bidding-models-update-42567.html) — 2026-11-18
- [ppc.land: consolidation](https://ppc.land/microsoft-consolidates-bidding-strategies/) — 2025-07-02
- [ppc.land: Max CPC 1 Oct](https://ppc.land/microsoft-advertising-drops-max-cpc-from-new-campaigns-on-october-1/) — 2026-08-20
- [ppc.land: Max CPC retires](https://ppc.land/microsoft-retires-max-cpc-as-chatgpt-ads-defaults-to-automated-bidding/) — 2026-08-22
- [ppc.land: bid model](https://ppc.land/microsoft-rebuilds-its-bid-model-citing-10-more-value-per-click/) — 2026-11-19
- [ppc.land: MCV expansion](https://ppc.land/microsoft-advertising-expands-conversion-value-bidding) — 2024-04-02
- [Google SA360 Help on Microsoft bid adjustments](https://support.google.com/sa360/answer/9310548?hl=en) — undated
- [Search Engine Land: Max CPC removal](https://searchengineland.com/microsoft-advertising-removes-max-cpc-from-new-standalone-bidding-campaigns-485598) — snippet only
- [Search Engine Journal: bidding upgrade](https://www.searchenginejournal.com/microsoft-rolls-out-its-biggest-bidding-upgrade-in-a-decade/597963/) — fetch refused (403), not used for claims

## 1. Which bid strategies exist per campaign type, and what changed in 2025–2026

### Takeaway
As of Nov 2026, these strategies are available:
- **Search**: Enhanced CPC, Maximize Clicks, Maximize Conversions (optional target CPA), Maximize Conversion Value (optional target ROAS), Target Impression Share.
- **Standard Shopping**: Enhanced CPC, Maximize Clicks, Maximize Conversion Value (optional target ROAS, "where available"), Cost per sale.
- **Performance Max**: only Maximize Conversions (optional target CPA) or Maximize Conversion Value (optional target ROAS).
- **Audience**: Enhanced CPC, Manual CPM, Maximize Conversions (optional target CPA), and Manual CPC only for display/video.

Standalone Target CPA and Target ROAS were retired for new and switching campaigns on 4 Aug 2025. Existing campaigns keep them, portfolios keep them, and API/Editor/bulk changes to them are silently converted. Maximize Conversion Value with a target ROAS **is** available for standard Shopping (since April 2024). Manual CPC is **not** available for Search or Shopping.

### Cited Findings
**Strategy availability per campaign type**
- [OFF] Comparison table in the main bid-strategy help article ("Campaign type supported"):
  - Enhanced CPC: Audience, Search (incl. Vertical ads), Shopping
  - Manual CPM: Audience
  - Maximize Clicks: Search, Shopping
  - Maximize Conversions: Search, Audience
  - Maximize Conversion Value: Search, Shopping Search
  - Target CPA: Search, Audience
  - Target impression share: Search
  - Target ROAS: Search, Shopping

  The same article says manual bid strategies exist only in Shopping, App and Audience campaigns (Cost per sale, Manual CPI, Manual CPM). — [Let Microsoft Advertising manage your bids with bid strategies (help mirror, ms.date 2026-06-18)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] Maximize conversion value "is available for: Search campaigns. Shopping search campaigns, where available". It is not supported for Microsoft Store ads. Maximize clicks "is available only for Search ad and Microsoft Shopping campaigns". Target impression share "is only available for Search campaigns". — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] The API guide's table is older and still Smart-Shopping era:
  - EnhancedCpc: Search, Shopping
  - ManualCpc: Audience, Hotel
  - MaxClicks: Search, Shopping
  - MaxConversions: Audience, Search, Shopping (smart shopping), Performance Max
  - MaxConversionValue: Shopping (smart shopping), Performance Max
  - TargetCpa: Search
  - TargetRoas: Search, Shopping
  - CostPerSale: Shopping

  Defaults: EnhancedCpc for Search and most Shopping, ManualCpc for Audience. — [Budget and Bid Strategies (API guide, updated 2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)
- [OFF] Newer object doc: MaxConversionValueBiddingScheme is used by "Search campaigns, Shopping campaigns, Smart shopping campaigns, and Performance Max campaigns". TargetRoas is used by Search, Shopping, Smart Shopping and PMax. — [MaxConversionValueBiddingScheme (updated 2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionvaluebiddingscheme?view=bingads-13)
- [OFF] MaxConversionsBiddingScheme: "TargetCpa is used by Audience, Search, Smart Shopping, and Performance Max campaigns". Standard Shopping is not listed. — [MaxConversionsBiddingScheme (updated 2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13)
- [OFF] 2 Apr 2024: "Maximize Conversion Value was previously only available for smart shopping campaigns, but … it is now available for all search and shopping search campaigns", with an optional Target ROAS. — [Microsoft Advertising blog, April 2024](https://about.ads.microsoft.com/en/blog/post/april-2024/max-conversion-value-for-search-and-other-updates-for-april); also reported by [3P] [ppc.land, 2024-04-02](https://ppc.land/microsoft-advertising-expands-conversion-value-bidding)

**Performance Max**
- [OFF] PMax: "The BiddingScheme must be set to MaxConversionValueBiddingScheme with optional TargetRoas or MaxConversionsBiddingScheme with optional TargetCpa". Shared budgets are not supported. Device targeting is in pilot (exclusion only, no bid adjustment). — [Performance Max API guide (updated 2026-09-15)](https://learn.microsoft.com/en-us/advertising/guides/performance-max?view=bingads-13)
- [OFF] PMax gained age and gender include/exclude targeting, generally available by 8 Sep 2026. — [Microsoft Advertising blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)

**Manual CPC, Enhanced CPC, Cost per sale**
- [OFF] Manual CPC: "As of May 2024, you can no longer use the manual CPC bid strategy for audience native campaigns. You can only use manual CPC for audience display and video campaigns, and for lodging campaigns … If you attempt to set manual CPC for any other campaign type, the request will be ignored without error and the bid strategy will be set to enhanced CPC." — [ManualCpcBiddingScheme (updated 2026-09-23)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13)
- [OFF] Enhanced CPC: you set ad group and keyword bids. The system raises or lowers them per auction "after we apply any bid adjustments you have set". "Over the long haul … we will try to make sure that your average CPC is not higher than your bid." Stored bids are not changed. — [EnhancedCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/enhancedcpcbiddingscheme?view=bingads-13)
- [OFF] Cost per sale (Shopping only):
  - You pay only for a sale within 24 hours of a click, and you set a target cost per sale.
  - The campaign takes up to 72 hours to start delivering.
  - Sales show in the "Sales" column, not in Conversions.
  - Microsoft recommends using it only after 30–50 conversions.
  - Daily spend can exceed "the normal limit of 200%"; the monthly budget is honoured.

  — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [CostPerSaleBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/costpersalebiddingscheme?view=bingads-13)
- [OFF] MaxRoasBiddingScheme "is not in use and will be removed from a future version of the API". — [MaxRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxroasbiddingscheme?view=bingads-13)

**The August 2025 consolidation of Target CPA and Target ROAS**
- [OFF] "Starting August 4, 2025, the BiddingScheme in the Campaign object will no longer support TargetCpaBiddingScheme and TargetRoasBiddingScheme":
  - "Any bid strategy set to Target CPA will be silently converted to Maximize Conversions using the Target CPA value."
  - "Any bid strategy set to Target ROAS will be silently converted to Maximize Conversion Value using the Target ROAS value."
  - "Existing campaigns that use the Target CPA and Target ROAS bid strategies will remain unaffected." SA360 is unaffected.

  — [BiddingScheme (updated 2026-09-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddingscheme?view=bingads-13); same wording on [TargetCpaBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetcpabiddingscheme?view=bingads-13) and [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme?view=bingads-13) (both updated 2026-10-29)
- [OFF] Help wording: "Stand-alone Target CPA and Target ROAS bid strategies can't be set up for newly created campaigns or for campaigns that aren't currently using them. Existing campaigns … will run as usual. Portfolio bid strategies won't be impacted." For API, Editor and bulk, an update to TCPA/TROAS is automatically converted to Max conversions / Max conversion value. After 4 Aug 2025, target CPA via Maximize conversions also became available for Search. — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [3P] Navah Hopkins (Microsoft Ads Liaison): converted campaigns "will continue to optimize against your set targets under TROAS and TCPA after they have been converted". — [Search Engine Roundtable, 2025-07-01](https://www.seroundtable.com/microsoft-ads-target-cpa-and-target-roas-retire-39688.html)
- [3P] ppc.land says the optimisation logic is unchanged and only the setup path changed. Portfolios keep Target CPA and Target ROAS. — [ppc.land, 2025-07-02](https://ppc.land/microsoft-consolidates-bidding-strategies/)
- [OFF] Ambiguity: the same help article's "Changes" section says target CPA can be set via Maximize conversions "for your Audience, Performance Max, and Shopping campaigns". That contradicts the help comparison table (Max Conversions = Search, Audience) and the API doc (TargetCpa: Audience, Search, Smart Shopping, PMax). — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

**Rules that limit strategy choice**
- [OFF] Target ROAS "cannot be used by campaigns that use shared budgets, except with a portfolio bid strategy". — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] Bid strategy is set only at campaign level. "At the ad group level you cannot change the bid strategy; you can either use the bid strategy that is at the campaign level or set a manual bid." — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] Shopping with Maximize clicks: keep those campaigns at the highest priority, and avoid overlapping product offers across Max-clicks Shopping campaigns. — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

**Performance claims (vendor data only)**
- [OFF] On 18 Nov 2026 Microsoft began rolling out a rebuilt conversion and value prediction model. It claims:
  - bids meet CPA/ROAS targets more consistently
  - bids adjust "nearly twice as quickly" after a target change
  - budgets pace more evenly through the day

  Microsoft's internal figures: Maximize Conversion Value / Target ROAS gave 10% more conversion value per click at similar ROAS. Search campaigns switching from Target CPA to Target ROAS gained 8% conversion value. Campaigns moving from eCPC to Maximize Conversions with a CPA target gained 18% conversions at similar CPA. More updates are promised for 2027. — [Microsoft Advertising blog, 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising); [3P] [Search Engine Roundtable, 2026-11-18](https://www.seroundtable.com/microsoft-advertising-bidding-models-update-42567.html); [3P] [ppc.land, 2026-11-19](https://ppc.land/microsoft-rebuilds-its-bid-model-citing-10-more-value-per-click/) (ppc.land notes the figures are unpublished internal August 2026 data with no baseline)

### Inferences
- For a Danish e-commerce account:
  - **Shopping**: eCPC, or Maximize Conversion Value with optional tROAS (if offered in the UI for the market — "where available"), or Maximize Clicks.
  - **Search**: Maximize Conversions + tCPA (lead/B2B) or Maximize Conversion Value + tROAS (revenue).
  - **PMax**: the same two strategies.
- Maximize Conversions on a standard Shopping campaign is not documented as supported. The one conflicting sentence in the help likely reflects Smart Shopping or PMax legacy.
- Because API changes to TCPA/TROAS are silently converted rather than rejected, a tool that sets `TargetCpa`/`TargetRoas` will not get an error. The read-back shows `MaxConversions`/`MaxConversionValue` with the target.

### Gaps
- No Microsoft page confirms that Maximize Conversion Value is actually offered for Shopping campaigns selling in Denmark. The help says "where available" without a market list.
- No independent (non-Microsoft) performance study of Microsoft automated bidding was found. Optmyzr's bidding studies cover Google Ads only (search results). JumpFly and Adalysis had no Microsoft-specific test data.
- No Microsoft announcement of an Enhanced CPC retirement was found. The Nov 2026 blog still recommends eCPC for accounts with fewer than 5 conversions.

## 2. Conversion requirements, learning period, what disturbs learning, and recommended change sizes

### Takeaway
Microsoft's current number is **30 conversions in 30 days**. It is phrased as a recommendation before evaluating ("ideally"), and the 2025 API guide says the strategies "stop optimizing" below 30 in any 30-day period. The old **15-conversion** minimum is a 2018 enablement rule that Microsoft later dropped. It is not a current Microsoft threshold.

Since 18 Nov 2026 Microsoft has also told advertisers to start new campaigns on a conversion-based strategy if the *account* has at least 5 conversions.

Learning:
- Bids start changing within 2 hours.
- Learning takes up to 2 weeks (Search/Shopping).
- PMax takes 2–4 weeks or 2–3 conversion cycles.
- Change targets in about 10–15% steps and review after one conversion cycle (PMax: wait 2 weeks).

### Cited Findings
**Conversion thresholds**
- [OFF] API guide: "If your campaign falls below 30 conversions over any 30-day period, Maximize Conversions will stop optimizing your bids. If this happens with regularity, we recommend switching to a different bid strategy." The same applies to Target CPA. Target ROAS also stops with zero revenue in 30 days, and it requires non-zero revenue over the last 30 days. — [Budget and Bid Strategies (updated 2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)
- [OFF] Help: "We recommend giving the bid strategy enough time to accumulate at least 30 conversions before evaluating its performance." In setup: "We recommend having at least 30 conversions in the previous 30 days. When setting up Target CPA, we suggest basing your target on your actual CPA from the previous 30 days." — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] 18 Nov 2026: "For new campaigns, if your account has at least five conversions, then we recommend starting on a conversion-based bid strategy right from the beginning, as opposed to starting with Enhanced CPC … conversion history at the account level provides bidding signals to all the campaigns". Accounts with fewer than 5 conversions can start with eCPC. Evaluate "after accumulating sufficient conversions (ideally 30 conversions in 30 days)". — [Microsoft Advertising blog, 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)
- [OFF] PMax: "We recommend adding a Target ROAS after you've accrued a minimum of 30 conversions within the last 30 days." — [Best practices for Performance Max (help mirror, 2026-05-30)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- [OFF] (snippet) The 2018 launch blog required "at least 15 conversions within the past 30 days" to enable Target CPA or Maximize Conversions. A later Microsoft post said "the minimum 15 conversion requirement in last 30 days no longer applies". — [Microsoft Advertising blog, July 2018 (snippet)](https://advertise.bingads.microsoft.com/en-in/blog/post/july-2018/automated-bidding-strategies-target-cpa-and-maximize-conversions) — date of removal not found
- [OFF] (snippet) Microsoft's automated-bidding page: campaigns with fewer than 30 conversions per month "are likely to see higher volatility". — WebSearch result text for Microsoft's automated bidding page

**Conversion lag and offline conversions**
- [OFF] "When conversions occur more than seven days after the associated clicks, it's harder for maximize conversions and Target CPA to make effective bids. If most of your conversions occur more than seven days after the associated clicks, we recommend not using maximize conversions or Target CPA."
- [OFF] "If you don't or can't upload offline conversions on a daily basis, we recommend not using maximize conversions or Target CPA. For best results, upload offline conversions within two days of the conversion."
- [OFF] Goals with "Include in Conversions" unticked do not count for auto-bidding.

  — all three from [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

**Learning period and what disturbs it**
- [OFF] Help timeline:
  - "Your bids will start changing automatically within two hours of turning on a bid strategy. However, a bid strategy needs to run for up to two weeks to build up enough data to bid optimally."
  - "During the initial two weeks, changing your bid strategy setting, campaign budget, or conversion settings—or adding or removing ad groups or keywords—may cause this period to take longer."
  - Getting set up: 30 days. Learning period: 1–2 weeks ("Avoid changing budgets or conversion goals during this period, as this may cause the learning period to start over").
  - Run campaign: a further 2–4 weeks before evaluating.
  - "For Target CPA, we recommend keeping adjustments within 10-15%, up or down."

  — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] 18 Nov 2026 (supersedes the softer help wording on targets):
  - "Targets can be changed at any time, and the system learns continuously."
  - "The changes that tend to drive volatility are major ones: creating a new campaign, switching your bid strategy, and adding/removing conversion goals."
  - "Large target CPA increases or ROAS decreases open up new inventory … If you need to minimize chances of potential volatility, you can make changes in 15% increments and review after one conversion cycle."
  - Evaluate "1-2 conversion cycles after major changes … at the campaign or portfolio level (not at the ad group or keyword level), and judge performance by conversions and CPA/ROAS, not keyword-level CPCs."

  — [Microsoft Advertising blog, 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)
- [OFF] PMax:
  - First impressions within 3 days (product ads) or 4 days (other).
  - "The campaign learning period can take either two to four weeks or two to three conversion cycles."
  - "Start with a less restrictive target … We don't recommend changing the target frequently and suggest waiting two weeks after each change before updating the amount again."
  - Converting Smart Shopping to PMax gives about a two-week learning period.

  — [PMax best practices (2026-05-30)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices); [About Performance Max (2026-05-30)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- [OFF] Portfolio bid strategies: "It will take a few weeks for a portfolio bid strategy to learn". The status shows "Learning" after campaigns are added. — [Portfolio bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy_portfolio)
- [OFF] Data exclusions refer to an "auto-bidding strategy's initial 30-day learning period" and require the strategy to be "active for at least 30 days" before use. — [Data exclusions help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions)

**Statuses and targets**
- [OFF] Status "Limited by auto-bidding target" means the campaign could gain volume if tROAS were lowered or tCPA raised. It "does not indicate any issues". Microsoft does not recommend frequent target changes unless they fit business goals. The status updates the next day. — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] Bid strategy report statuses: Active, Inactive, Limited by budget, Limited by target, Limited by inventory, Limited by max CPC, and "Limited: low data volume" ("Not enough conversions or revenue to optimize bidding"). "Average target values represent the weighted average of the targets the auto-bidding strategy used … not … the average of the target values manually entered." The report also shows conversion delay and bid landscape for targets. — [Monitor and optimize your bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategyreport)
- [OFF] Microsoft lets campaigns over-achieve tCPA/tROAS efficiency "regardless of budget limited status … targets are not rigid values". — [Microsoft Advertising blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); repeated in [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising). [3P] ppc.land contrasts this with Google, which from 17 Aug 2026 pushes over-performing budget-limited tCPA/tROAS campaigns back toward target. — [ppc.land, 2026-08-20](https://ppc.land/microsoft-advertising-drops-max-cpc-from-new-campaigns-on-october-1/)
- [OFF] Data-driven attribution rolled out to all advertisers by end of May 2026. It works for campaigns on Maximize Conversions, Maximize Conversion Value and Enhanced CPC. — [Microsoft Advertising blog, 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)

### Inferences
- Microsoft gives no numeric guidance on budget-change size for automated campaigns. It only says budget changes during the first ~2 weeks can prolong or restart learning. Any "±20% budget" rule is a house rule.
- Microsoft's "one conversion cycle" waiting time can be much shorter than 2 weeks for a webshop (conversion cycle ≈ 1 day). It is longer for B2B leads. PMax keeps the explicit 2-week rule.
- The Nov 2026 model rollout means CPA/ROAS swings in late Nov 2026 to 2027 can come from Microsoft's side, not the account. Pair this with change history before concluding.
- The ">7 days click-to-conversion" warning matters for B2B or offline-conversion campaigns in a Danish B2B context. They may be poor candidates for Max Conversions/tCPA.

### Gaps
- Microsoft does not publish a learning-status indicator definition for single campaigns (only portfolio "Learning" status). The "up to 30 days" figure only appears in the data-exclusion article.
- No Microsoft source states the exact minimum conversions to *enable* each strategy today. The UI may allow enabling with zero conversions as long as tracking exists.
- How EU consent-mode loss affects conversion volume for automated bidding was not covered by any bidding source found.

## 3. Bid adjustments under each strategy: ranges, what is honoured, and stacking

### Takeaway
Ranges:
- Most bid adjustments run from **−90% to +900%** in 1% steps.
- **Device** runs from **−100% to +900%**, and **−100% device = exclusion**. That is the only documented way to switch a device off with a bid adjustment.
- Location *intent* multipliers are ignored without error.

Under automated strategies, Microsoft says all bid adjustments are used as **signals that "inform" the automated bid**, not as hard multipliers. Microsoft also says it "will automatically change your bid adjustments for device type in real time … the actual bid amount may be higher or lower" than the set adjustment. So a −90% mobile adjustment is not a guaranteed cut, especially under automated bidding.

No Microsoft document says ad-schedule adjustments are ignored under Maximize Conversion Value. The documented position is "inform" for all.

Stacking:
- Microsoft documents **multiplication only for LinkedIn profile targeting** (1.10 × 1.20 = 1.32).
- Google's SA360 help about Microsoft campaigns shows device + location as **additive** (+10% + +10% = +20%).
- Microsoft's own general stacking example is incomplete (no result is shown).

### Cited Findings
**What automated strategies do with adjustments**
- [OFF] "Please note that if you're using automated bid strategies, we'll utilize bid adjustments as signals to optimize performance." Also: "If you use an automated bid strategy, it will be informed by any bid adjustments you set." — [How to target my customers by adjusting my bids (help mirror)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding)
- [OFF] Per strategy (Max conversions, Target CPA, Target ROAS, Max clicks): "You cannot change bids for keywords that are using [strategy] … Microsoft Advertising will have full and final control over optimizing your bids. That said, any bid adjustments you have set (or that you set in the future) can be used to inform your … automated bids." — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] API BidMultiplier: "If the campaign uses MaxClicks, MaxConversions, TargetCpa, or TargetRoas bid strategy types, then the multiplier will inform rather than directly modify or override the automated bid. For most criterion types the valid bid multiplier range is -90 through 900." MaxConversionValue and TargetImpressionShare are not named (doc updated 2024-12-03).
  - Device: "Supported values are -100 … through positive 900 … Setting the bid adjustment to -100 percent will result in the exclusion of the corresponding DeviceName."
  - LocationIntentCriterion: "You cannot bid on a location intent criterion. The service will ignore the multiplier without returning any error."

  — [BidMultiplier (updated 2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13)
- [OFF] (snippet, 2018 and possibly outdated) "Any -100% bid modifiers continue to opt you out of the related targeting option (device type, location, ad schedule or audience). However, all other bid modifier values (-90% to +900%) will be applied to your automated bids." This conflicts with today's "inform" wording, and with the current −90% floor for non-device targets. — [Microsoft Advertising blog, July 2018 (snippet)](https://advertise.bingads.microsoft.com/en-in/blog/post/july-2018/automated-bidding-strategies-target-cpa-and-maximize-conversions)
- [OFF] Enhanced CPC applies its own up/down change "after we apply any bid adjustments you have set". — [EnhancedCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/enhancedcpcbiddingscheme?view=bingads-13)

**Ranges and general rules**
- [OFF] From the same help article:
  - "Bid adjustments are rounded down to the nearest cent."
  - "Bid adjustments for most variables can range, in 1% increments, from -90% to + 900%."
  - Device note: "We'll automatically change your bid adjustments for device type in real time to optimize performance and increase your chances for a conversion. We'll use your bid adjustment as a reference point, but the actual bid amount may be higher or lower."
  - "If a customer's criterion is unknown, then no bid adjustment for this criterion will be applied."
  - "By default, bid adjustments of 15% will be applied to new targeting associations."
  - Demographics cannot be used for personalisation in financial, insurance, education, employment or housing ads.

  — [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding)

**Stacking**
- [OFF] Multiple adjustments: "If more than one of your target criterion is met and your ad is clicked, you pay for each of the bid adjustments that match". The worked example ($3.00 keyword, Saturday +10%, Tablet −20%) shows no result on the live page. LinkedIn: "LinkedIn profile targeting bids will multiply if a customer is included in multiple segments … 10% … and … 20% … will be 32% (1.10 x 1.20 = 1.32)." — [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding)
- [3P] Google SA360 help on Microsoft Advertising campaigns:
  - Device: −100% to +900% ("To opt out of showing ads on a certain device, decrease your bid by 100%").
  - Location and demographics: −90% to +900%.
  - Stacking: "If a device bid adjustment and a location bid adjustment both apply … your bid will be US$1.20: US$1.00 + 0.10 for the device … + 0.10 for the location" (additive).
  - Ad-group device adjustment overrides the campaign-level one.
  - For overlapping locations (France +50%, Paris +100%) only the most specific applies.

  — [SA360 Help: About bid adjustments in Microsoft Advertising campaigns (undated)](https://support.google.com/sa360/answer/9310548?hl=en)

**Campaign vs ad group level**
- [OFF] Device: exactly three device criteria (Computers, Smartphones, Tablets) per campaign or ad group. "If ad group level device criterions are specified, the campaign level device criterions are ignored for that ad group … not applied as a union." PMax can exclude device types (pilot), but at least one must remain. — [DeviceCriterion (updated 2026-11-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13)
- [OFF] Ad schedule: "If ad group level day and time criterions are specified, the campaign level day and time criterions are ignored for that ad group … not applied as a union." — [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion?view=bingads-13)
- [OFF] Audiences: biddable audience targets cannot be set at both campaign and ad group level. Exclusions are a union of both levels. — [AudienceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/audiencecriterion?view=bingads-13)

**Performance Max**
- [OFF] PMax device targets: "you cannot set any bid adjustment"; only exclusions are possible. — [Performance Max API guide (2026-09-15)](https://learn.microsoft.com/en-us/advertising/guides/performance-max?view=bingads-13)

### Inferences
- To keep mobile/tablet traffic out of an automated campaign, use **−100% (exclusion)**. −90% under Max Conversions/Max Conversion Value only "informs" the bidder, and per the device note it may even be overridden in real time.
- An ad schedule cannot be set to −100%, because the floor is −90%. Hours are excluded by not including them in the schedule.
- Rule for advisors: say "adjustments are a signal, not a guarantee" under automated strategies. Under eCPC they are a base multiplier that eCPC then adjusts further.
- Because ad-group device or schedule criteria replace the campaign's (no union), setting device bids on one ad group silently drops the campaign's device settings for that group.

### Gaps
- Microsoft has no current page stating additive vs multiplicative stacking for device + location + schedule + audience. Only LinkedIn (multiplicative) is explicit. SA360's additive example is third-party.
- No Microsoft documentation found specifically on Maximize Conversion Value or Target Impression Share and bid adjustments beyond the generic "informs". The claim that "ad schedule adjustments are ignored under MCV" is therefore unconfirmed.

## 4. Max CPC caps, portfolio bid strategies, seasonality adjustments and data exclusions

### Takeaway
**Max CPC is being phased out of standalone automated campaigns:**
- Since **1 Oct 2026**, new non-portfolio Maximize Conversions (±tCPA), Maximize Conversion Value (±tROAS) and Maximize Clicks campaigns cannot get a Max CPC.
- Existing campaigns keep it, but can only edit or remove it. Adding one returns API error 611274. Once removed it cannot be re-added.
- Portfolios, Target Impression Share and eCPC keep Max CPC (per Microsoft's liaison).
- The API notes that from **12 Jan 2027** MaxCpc will not be available for new campaigns or for existing campaigns that don't already use it.
- Microsoft explicitly recommends not keeping a Max CPC at all.

**Seasonality adjustments**: ≤14 days, set as the expected conversion-rate change, only for target-CPA/target-ROAS strategies. They are available for portfolios and shared budgets since May 2026.

**Data exclusions**: ≤14 days (7 or less recommended), campaign level, not in the first 30 days, and they don't affect reporting.

### Cited Findings
**Max CPC**
- [OFF] "Starting October 1, the Max CPC setting will no longer be available when creating new non-portfolio campaigns using Maximize Conversions (with Target CPA), Maximize Conversion Value (with Target ROAS), or Maximize Clicks. Existing campaigns created before October 1, 2026, that already use Max CPC will keep the setting, and Max CPC will remain available for new and existing campaigns using portfolio bid strategies." Reason given: a Max CPC "overrides advertisers' own CPA/ROAS targets … even when the cap is above average CPC". Recommended controls instead: "budgets, target CPA, target ROAS, conversion value rules, and seasonality adjustments". Microsoft suggests experiments to test removing it. — [Microsoft Advertising blog, 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)
- [OFF] "Keeping a Maximum CPC set on your campaigns is not recommended." — [Microsoft Advertising blog, 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)
- [OFF] API object docs: "For non-portfolio campaigns, you can only edit or remove an existing MaxCpc value. Attempting to add a new value returns error MaxCpcCannotBeAdded (611274). Portfolio bid strategies continue to support MaxCpc." MaxCpc "shouldn't be set for Smart Shopping or Performance Max campaigns as it doesn't apply". — [MaxConversionsBiddingScheme (2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13); identical wording on [MaxConversionValueBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionvaluebiddingscheme?view=bingads-13), [MaxClicksBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxclicksbiddingscheme?view=bingads-13) and [TargetCpa](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetcpabiddingscheme?view=bingads-13)/[TargetRoas](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme?view=bingads-13) (all 2026-10-29)
- [OFF] "Starting January 12, 2027, the MaxCpc field will no longer be available for new campaigns or for existing campaigns that don't currently use it." — [BiddingScheme (2026-09-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddingscheme?view=bingads-13); [BidStrategy (2025-11-14)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidstrategy?view=bingads-13)
- [3P] Hopkins: "Target impression share, eCPC, and Portfolio bidding strategies will retain the ability to add a Max CPC". ppc.land flags that the experiment-to-new-campaign path and API/Editor behaviour were not clarified. — [ppc.land, 2026-08-20](https://ppc.land/microsoft-advertising-drops-max-cpc-from-new-campaigns-on-october-1/); [ppc.land, 2026-08-22](https://ppc.land/microsoft-retires-max-cpc-as-chatgpt-ads-defaults-to-automated-bidding/). [3P] (snippet) Search Engine Land: if Max CPC is removed from an existing campaign it cannot be added back. — [Search Engine Land (snippet)](https://searchengineland.com/microsoft-advertising-removes-max-cpc-from-new-standalone-bidding-campaigns-485598)
- [OFF] Target Impression Share: MaxCpc is optional on add and update. TargetAdPosition is one of FirstPage, MainLine or MainLine1 (the very first ad), together with a TargetImpressionShare percentage. — [TargetImpressionShareBiddingScheme (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetimpressionsharebiddingscheme?view=bingads-13)
- [OFF] Older help text (pre-Oct 2026) still says Max CPC can be set "only on the campaign level" for Maximize conversions, Target CPA or Target ROAS. It also says "Maximum CPC campaigns do not support bid landscape functionality". — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

**Portfolio bid strategies**
- [OFF] Supported strategy types per campaign type:
  - Maximize clicks: Search, Shopping
  - Maximize conversions: Search
  - Max. conversion value: Search, Shopping search
  - Target CPA: Search
  - Target impression share: Search
  - Target ROAS: Search, Shopping

  Smart Shopping is not supported. A portfolio's type cannot be changed; move the campaign to another portfolio instead. Campaigns in a portfolio should have individual budgets, or shared budgets that are entirely inside the same portfolio, otherwise the status shows "Misconfigured". Other statuses: Active, Learning, Limited (budget), Inactive. A portfolio can't be deleted while associated to an active campaign. Cross-account portfolios require the same currency. — [Portfolio bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy_portfolio)
- [OFF] Limits: up to 11,000 portfolios per account and 10,000 campaigns per portfolio. AssociatedCampaignType is Search or Shopping (not Smart Shopping) and is read-only after creation. The API object's table also lists Target CPA/Target ROAS for PMax, which conflicts with the help table. — [BidStrategy (2025-11-14)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidstrategy?view=bingads-13)
- [OFF] Cross-account portfolio bidding became available (Search and Shopping) in May 2026. — [Microsoft Advertising blog, 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)

**Seasonality adjustments**
- [OFF] Used "when you expect significant changes to conversion rates, such as a sale or promotion". "Seasonality adjustments are only applicable for campaigns with target ROAS … and target CPA … bid strategies." You set the expected percent conversion-rate change (example: expect +25% → adjust "by up to 25%"). The date range must be 14 days or less. Scope can be a campaign type or specific campaigns, with a device filter. Bids return to baseline afterwards. Path: Tools > Bids & budgets > Advanced controls > Seasonality adjustments. — [Seasonality adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments)
- [OFF] Seasonality adjustments for portfolio bidding and shared budgets became "fully available for all advertisers" (May 2026). — [Microsoft Advertising blog, 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)
- [OFF] (snippet) The March 2022 launch advised using seasonality adjustments only for stable campaigns that have completed learning. — WebSearch summary of [Microsoft blog, March 2022](https://about.ads.microsoft.com/en/blog/post/march-2022/march-2022-market-expansion-and-other-product-updates)

**Data exclusions**
- [OFF] Rules:
  - Up to 14 days, "we recommend that you create data exclusions for 7 days or less".
  - They exclude both conversions and the associated clicks from bidding.
  - Use only on stable auto-bidding campaigns active ≥30 days, and "shouldn't use data exclusions within your auto-bidding strategy's initial 30-day learning period".
  - Not for "boosting performance under normal conditions".
  - Add extra dates for conversion delay.
  - "Data exclusions don't impact reporting."
  - Campaign level only.

  — [Data exclusions help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions)
- [OFF] (snippet) Data exclusions are available for Search and Shopping, not Audience campaigns. — WebSearch summary of [help.ads.microsoft.com article 60156](https://help.ads.microsoft.com/apex/index/3/en/60156)

### Inferences
- **Max CPC as a lever**:
  - For campaigns created after 1 Oct 2026, the assistant should not suggest a Max CPC cap at all.
  - For older campaigns it can only suggest lowering, raising or removing an existing one, and should warn that removal is irreversible.
  - Where a hard cap is essential, the documented route is a portfolio strategy.
- Seasonality adjustments are a conversion-rate forecast, not a bid change. For Black Friday the percent should come from last year's conversion-rate lift.
- After consolidation, "target CPA/ROAS strategies" presumably means Max Conversions + tCPA and Max Conversion Value + tROAS. The help has not been reworded, so applicability to Max Conversions without a target is unclear.

### Gaps
- Whether the 12 Jan 2027 API removal also removes MaxCpc from Target Impression Share and eCPC campaigns (where Hopkins said it stays) is not stated.
- No Microsoft statement confirms that seasonality adjustments apply to Max Conversions/Max Conversion Value *without* a target.

## 5. Budgets and impression share: how to read them and when raising budget helps

### Takeaway
**Budgets:**
- The daily budget is a target. Microsoft enforces a monthly cap and "usually keeps overspend to less than 100% above your daily limit". CPS can exceed 200%.
- A mid-month change resets the monthly cap to spend-to-date + new daily × days left (including today).
- Changes apply within about an hour.

**When to raise a budget:**
- Raise budget only where **IS lost to budget** is material and efficiency is on target. Microsoft's "Eligible (limited)" and "Performance limited by budget" statuses flag this.
- **IS lost to rank** is fixed with bid/target, ad quality and relevance, not budget.
- Under automated bidding, Microsoft allows over-achievement of targets even when budget-limited. A budget-limited campaign beating its tROAS is therefore a scaling candidate.

### Cited Findings
**How the budget is spent and calculated**
- [OFF] Budget rules:
  - "Your budget is a target; your actual spend might be higher or lower … usually keeps overspend to less than 100% above your daily limit."
  - The monthly budget is daily × days in month, recalculated at midnight on the 1st in the campaign time zone. Mid-month changes use "Monthly budget = month-to-date spend + daily budget * (days remaining in the month, including today)". Example: $250 spent + $10 × 17 = $420.
  - "Changes to your budget generally take effect within an hour or so."
  - Ad group and keyword bids are validated independently of the campaign budget.

  — [Budget and Bid Strategies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)
- [OFF] Help variant: "monthly budget = daily budget x 30.4 (the average number of days per month)". This conflicts slightly with the API guide's days-in-month formula. "If you reach your daily budget limit, all ad groups in your campaign are paused." Automated rules, shared budgets and **Google imports** can change budgets automatically, and imports reactivate campaigns. — [Discover your budget options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)
- [OFF] Budgets are set only at campaign level, not ad group or product group. — [Set your campaign budget and bid amounts](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_setcampaignbudgetandbidamounts)
- [OFF] Shared budgets reallocate unspent money between campaigns. Performance Max and Premium Streaming don't support shared budgets. — [Shared budgets help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets)
- [OFF] PMax: "give Performance Max campaigns up to two to three times the budget of your historical standalone campaigns". A constrained budget slows learning. — [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- [OFF] Budget Center (Tools > Bids & budgets) shows depleted campaigns, % of daily budget depleted, and recommended budgets. — [About Budget Center](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_budgetcenter)

**Budget statuses**
- [OFF] "Eligible (limited)": the campaign "ran out of budget at least once in the past seven days or … will run out of budget in the coming weeks". "Campaign out of budget": no ads are running. Microsoft suggests several budgets via the Delivery-column hover, plus recommendations. — [Eligible (limited) / Out of budget help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_limitedoroutbudget)
- [OFF] Auto-bidding status "Performance limited by budget": performance is limited by the budget. Microsoft suggests "Apply the recommended Campaign budget". — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] The new bidding models (Nov 2026) pace budgets "more evenly throughout the day and campaigns ramp to full budget faster". — [Microsoft Advertising blog, 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)

**Impression share definitions**
- [OFF] Report column definitions:
  - **ImpressionSharePercent**: "estimated percentage of impressions, out of the total available impressions in the market you were targeting".
  - **ImpressionLostToBudgetPercent**: "impressions your ad did not receive due to issues with your daily or monthly budget".
  - **ImpressionLostToRankAggPercent**: impressions not received "due to issues with your ad ranking".
  - **TopImpressionSharePercent**: mainline share of eligible mainline impressions; eligibility is based on approval, quality score, targeting and bids.
  - **AbsoluteTopImpressionSharePercent**: share of the top position.
  - **TopImpressionShareLostToRank/BudgetPercent**: mainline impressions lost to rank or budget.
  - **ExactMatchImpressionSharePercent**: share on searches that exactly matched your keyword.

  Rank "is based on factors including your bid amount, ad performance, ad relevance, ad extensions, other competing ads". IS columns are updated 14–18 h after the UTC day ends. Hourly/HourOfDay aggregation gives error 2053, or silently wrong data for top/abs-top columns. Shopping IS appears only in campaign, ad group, product dimension and product partition reports, not the SOV report. — [Report attributes and performance statistics (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/report-attributes-performance-statistics?view=bingads-13)
- [OFF] Share-of-voice help: "To improve absolute top impression share, increase your bid or budget." A low exact-match IS "might be because your bid is too low, or ad quality or relevance is low". SOV figures are estimates and can be blank for statistically insignificant keywords. Further lost-IS splits exist (lost to relevance, expected CTR, bid). Since 10 Nov 2025 PMax has click share, IS, IS lost to budget and IS lost to rank at campaign/account level only, covering Search + Shopping placements only. — [Share of voice report help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_imprsharereports)
- [OFF] Bid landscape simulates impressions and clicks for alternative bids at keyword, ad group, campaign (bid scaling) and product group level, when data is sufficient. "Simulations are estimates". — [Bid landscape help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidlandscape)

### Inferences
- How to read impression share: a high IS lost to budget with on-target CPA/ROAS argues for more budget. A high IS lost to rank argues for higher bids or looser targets (raise tCPA / lower tROAS) and better ads, quality and landing pages. More budget does not fix lost rank.
- Under automated bidding, "Limited by auto-bidding target" plus high lost-to-rank means the target is binding.
- Because a daily budget can overspend up to 2× on single days, "spends ≥90% of budget" should be judged over a week or more, not a single day.

### Gaps
- Microsoft does not state that IS + lost-to-budget + lost-to-rank = 100%. It is not confirmed whether the three columns sum to 100% in Microsoft reports.
- No Microsoft numeric threshold exists for "material" IS lost to budget (e.g., ≥10%). That is a house rule.

## 6. When keyword and ad group bids are ignored, minimum bids in DKK, and bid estimates

### Takeaway
**When bids are ignored:**
- Keyword, ad group and product group bids are ignored under every automated strategy (Max Clicks, Max Conversions ± tCPA, Max Conversion Value ± tROAS, legacy Target CPA/ROAS, Target Impression Share) and in PMax.
- They are used under eCPC (as a base the system moves up or down) and Manual CPC (Audience display/video only).
- Manual CPC set on Search or Shopping is silently converted to eCPC.

**DKK limits per the API currency table** (dated 2025-06): minimum bid 0.06 DKK, maximum bid 6,000 DKK, minimum daily budget 0.06 DKK, minimum monthly 2.00 DKK, maximum monthly 183,000,000 DKK. Shopping uses 0.01 (Shopping tab only) and 0.05 (everywhere) in local units for listed markets, and Denmark isn't listed.

**Bid estimates**: first page, mainline (top of page) and best position, based on exact match. There is a first-page warning based on the last 7 days.

### Cited Findings
**Bids under automated strategies**
- [OFF] "You cannot change bids for keywords that are using maximize conversions [likewise target CPA, target ROAS, maximize clicks]. This means that automated rules and third-party bid management tools will not affect these keywords." "When using the auto bidding function, you can only set the bid on the campaign level. The auction bid for every keyword is calculated by the backend model in real-time." — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- [OFF] "With some bid strategy types, your bid and ad rotation settings are ignored and conversion tracking … is required." MaxClicks/MaxConversions/TargetCpa/TargetRoas: "you don't need to set ad group or keyword bids". — [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)
- [OFF] "Bids are manually set at the ad group and keyword levels … for non-automated bid strategies, such as enhanced CPC. Automated bid strategies like maximize clicks, maximize conversions, target CPA, etc., have bids automatically set by the platform." — [Refine your bids](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_refinebids)
- [OFF] Under eCPC Microsoft does not change stored bids; new bids are used "as a starting point". — [EnhancedCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/enhancedcpcbiddingscheme?view=bingads-13)

**Match-type bids**
- [OFF] Match-type bid fallback: an exact-match comparison uses the exact bid, otherwise the first less-restrictive bid (phrase, then broad or the ad group default). A keyword with only an exact bid does not enter phrase-delivered auctions. — [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13)

**Minimum and maximum bids**
- [OFF] Currency table row "DanishKrone — The Danish Krone (DKK)": Minimum Bid 0.06; Maximum Bid 6,000.00; Minimum Daily Budget 0.06; Minimum Monthly Budget 2.00; Maximum Monthly Budget 183,000,000.00. NOK is identical. For comparison, EUR is 0.05 / 1,000 / 0.05 / 5.00 / 5,850,000. "Subject to change." The Shopping fixed-bid table lists AUD, CAD, EUR (AT, BE, FR, DE, IT, NL, ES, CH, SE), INR, PLN, ZAR, TRY, GBP and USD, but no DKK. — [Currencies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/currencies?view=bingads-13)
- [OFF] Shopping minimum bid: 0.01 for the Shopping tab and 0.05 "for everywhere else". Products under 0.05 serve only in the Shopping tab. Shopping bids can be set at product group, ad group or campaign level. Google-import opt-in raises bids to recommended minimums. — [Minimum bid for Microsoft Advertising (help mirror)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productads_minbid)
- [OFF] Shopping campaign priority: High beats Medium beats Low "regardless of bid" for the same product. — [Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview)

**Bid estimates**
- [OFF] Three bid estimates for exact-match queries:
  - First page ("anywhere on the first page")
  - Mainline ("among the ads on the mainline")
  - Best position ("first position at the top of the first page")

  They reflect targeted devices and quality score and are not guarantees. — [How to get my ads on the first page using estimated bids (2026-05-30)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_location_opportunity)
- [OFF] Bulk edit can raise bids to "the estimated top of page bid or estimated first page bid". — [Refine your bids](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_refinebids)
- [OFF] Microsoft warns in the Keywords Delivery column if, "based on the last seven days of data, your bid is not adequate to put your ads on the first page". The keyword bid is the maximum charged per click, but bid adjustments ("incremental bids") can raise the cost above it. — [Did I bid high enough?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_biddingstrategy)

### Inferences
- **DKK bid floor**: the DKK minimum of 0.06 looks inconsistent with EUR 0.05 (≈0.37 DKK). It may be a documentation artefact, but it is the documented API limit. Practically, any sensible bid is far above it, and the team's own `minCpcBid` rule matters more.
- **Shopping minimums**: for Danish Shopping campaigns, the 0.01/0.05 Shopping minimums are documented only for the listed markets.
- **What a bid card should say**: under automated strategies, a card that changes keyword or product group bids changes nothing at auction time. The tool should block it, as the app already does.

### Gaps
- No Microsoft source confirms what bid an ad group gets when created without a CPC bid (the app's claim that it gets "the currency's minimum bid").
- Whether product-group bids are ignored under Cost per sale is not documented explicitly.
- No Microsoft bid-estimate data specific to Denmark was examined.

## 7. Against the current rules (microsoftAds.ts, prompt.ts, checks.ts)

### Takeaway
Most structural rules are confirmed:
- bids are ignored under automated strategies
- Manual CPC silently becomes eCPC
- the standalone tCPA/tROAS cut-off of Aug 2025
- PMax uses only Max Conversions/Max Conversion Value
- seasonality adjustments ≤14 days and data exclusions ≤7 days
- the budget formulas
- impression share logic

Five rules are **wrong or outdated**:
1. "Microsoft stops optimising below 15 conversions" (Microsoft says 30; 15 is a retired 2018 rule).
2. Max CPC presented as a general lever (removed for new standalone campaigns since 1 Oct 2026; Microsoft advises against it).
3. "Under 30 conversions → recommend manual/eCPC" (Microsoft since Nov 2026: start conversion-based if the account has ≥5 conversions; Manual CPC is not possible for Search/Shopping).
4. "Bid adjustments multiply (+10% and +20% = +32%)" (documented only for LinkedIn profile targeting; device + location is additive per SA360).
5. "No target changes during learning" (Microsoft Nov 2026: targets can change any time in ~15% steps).

### Cited Findings
**Conversion thresholds and strategy choice**
- **checks.ts `MIN_CONVERSIONS_30D = 15`**, with the comment "Microsoft: below 15 conversions in 30 days these strategies stop optimising", the strategyDataCheck message, and **prompt.ts line 210** "Microsoft stops optimising below 15 conversions in 30 days" — **CONTRADICTED**.
  - Microsoft's API guide says Max Conversions/Target CPA/Target ROAS stop optimizing "below 30 conversions over any 30-day period" — [Budget and Bid Strategies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13).
  - The help recommends 30 before evaluating — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).
  - The 15 figure was the 2018 enablement minimum that Microsoft later dropped — [Microsoft blog 2018 (snippet)](https://advertise.bingads.microsoft.com/en-in/blog/post/july-2018/automated-bidding-strategies-target-cpa-and-maximize-conversions).
  - Note the tension with the newest guidance: start conversion-based from launch if the account has ≥5 conversions — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
- **checks.ts `RECOMMENDED_CONVERSIONS_30D = 30`** and the playbook "mindst 30 konverteringer på 30 dage" — **CONFIRMED** as Microsoft's evaluation recommendation ("ideally 30 conversions in 30 days") — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising). PMax: tROAS after 30 in 30 days — [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices).
- **Playbook line 23**, "Under det: anbefal manuel/Forbedret CPC eller samling af kampagner" — **PARTLY CONTRADICTED**.
  - Manual CPC isn't available for Search/Shopping. It silently becomes eCPC — [ManualCpcBiddingScheme (2026-09-23)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13).
  - Microsoft now recommends conversion-based strategies for new campaigns when the account has ≥5 conversions, and eCPC only for accounts with <5 — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
  - "Samling af kampagner" (consolidating campaigns) is supported in spirit: portfolios pool data — [blog 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026).
- **Playbook line 81**, "Uden konverteringsdata: anbefal ikke automatiske budstrategier" — **CONFIRMED** for conversion-based strategies: tracking is a prerequisite — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising). Max Clicks and Target Impression Share don't need conversions — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).

**Learning period and change sizes**
- **Playbook line 22**, learning "de første ~2 uger, op til 30 dage; Performance Max 2–4 uger … foreslå ikke ændringer i budget, mål eller strategi" — **MOSTLY CONFIRMED, one part contradicted**.
  - Confirmed: up to 2 weeks, plus changes to strategy, budget, conversion settings or ad groups/keywords can lengthen it — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy). The "30-day initial learning period" — [data exclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions). PMax 2–4 weeks *or 2–3 conversion cycles* — [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices).
  - Contradicted for **targets**: "Targets can be changed at any time … the system learns continuously". Only new campaigns, strategy switches and adding/removing conversion goals "tend to drive volatility" — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
  - Also applies to **playbook line 108**.
- **Playbook line 94**, "Mål-CPA/-ROAS: ±10–15 % pr. skridt, mindst 2 uger mellem ændringer" — **CONFIRMED on size, NUANCED on timing**.
  - Size: tCPA adjustments "within 10-15%" — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy). "15% increments" — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
  - Timing: Microsoft's wait is "one conversion cycle" for Search/Shopping; the explicit 2 weeks applies to PMax only — [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices).
  - Internal inconsistency in the app: **prompt.ts line 79** says steps of 10–20% and a 7-day wait, which conflicts with the playbook's 10–15% and 2 weeks.
- **Playbook line 93**, budget "±20 % pr. ændring og højst én ændring pr. 7 dage" (automated), and **prompt.ts line 79**, "budgets up to about 20–30 %" — **NOT IN MICROSOFT DOCS**. These are house rules. Microsoft only warns against budget changes during the ~2-week learning period — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy). Keep them, labelled as a rule of thumb.
- **Playbook line 95**, "Manuelle CPC-bud: ±20 % pr. søgeord pr. uge" — **NOT IN MICROSOFT DOCS** (house rule). For Search these are eCPC base bids, not manual CPC — [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13).

**Bid adjustments**
- **Playbook line 96**, "Budjusteringer … De ganges sammen (+10 % og +20 % = +32 %)" — **UNSETTLED / LIKELY WRONG AS A GENERAL RULE**.
  - Microsoft documents multiplication only for LinkedIn profile segments — [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding).
  - Google's SA360 help on Microsoft campaigns shows device + location as additive ($1.00 + 0.10 + 0.10 = $1.20) — [SA360 9310548](https://support.google.com/sa360/answer/9310548?hl=en).
  - Also missing from the rule: under automated strategies, adjustments only "inform" bids — [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding); [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13).
- **Playbook line 46**, set_campaign_targeting default "mobil og tablet -90 %" — **CONFIRMED as valid** (device range −100…+900), but **MISSING CAVEATS**:
  - Under automated strategies −90% only "informs" bids.
  - Microsoft "will automatically change your bid adjustments for device type in real time … actual bid amount may be higher or lower" — [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding).
  - Only −100% excludes a device — [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier?view=bingads-13).
  - Ad-group device or schedule criteria replace campaign ones (no union) — [DeviceCriterion (2026-11-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13); [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion?view=bingads-13).
  - PMax cannot take device bid adjustments; device exclusion is in pilot — [PMax API guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max?view=bingads-13).

**Seasonality adjustments and data exclusions**
- **Playbook line 109**, "sæsonjustering (≤14 dage) eller dataudelukkelse (≤7 dage)" — **CONFIRMED**: seasonality ≤14 days; data exclusion maximum 14, recommended ≤7.
  - **Missing caveats**: seasonality applies only to target-CPA/target-ROAS strategies, and the percent equals the expected conversion-rate change — [seasonality help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments). Data exclusions: not within the first 30 days, campaign level only, and add buffer days for conversion lag — [data exclusions help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions).

**Levers under automated bidding**
- **prompt.ts line 174**, "Under automated bidding … keyword and ad group bids are ignored – the levers are the campaign target (CPA/ROAS), the budget, the max CPC cap, search terms/negatives, ads and landing pages" — **CONFIRMED except max CPC**.
  - Bids ignored: [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).
  - Max CPC cannot be added to non-portfolio campaigns (error 611274). Since 1 Oct 2026 it is absent from new Max Conversions/Max Conversion Value/Max Clicks campaigns. From 12 Jan 2027 the API field goes for campaigns not already using it, and Microsoft recommends removing it — [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13); [BiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddingscheme?view=bingads-13); [blog 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026).
  - **Missing levers** Microsoft names: conversion value rules and seasonality adjustments — [blog 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026).
- **checks.ts `LEVER` map**:
  - MaxClicks → "budget eller maks. CPC-loft" and MaxConversions → "budget eller maks. CPC-loft (eller skift til Mål-CPA)" — **OUTDATED**. Max CPC can only be edited or removed where it already exists. "Skift til Mål-CPA" should be "tilføj en mål-CPA til Maksimér konverteringer", because standalone tCPA can't be chosen — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).
  - TargetImpressionShare → "målet for visningsandel eller maks. CPC-loftet" — **CONFIRMED** (TIS retains Max CPC per Hopkins) — [ppc.land 2026-08-20](https://ppc.land/microsoft-advertising-drops-max-cpc-from-new-campaigns-on-october-1/). Watch the 12 Jan 2027 API note.
- **checks.ts `AUTOMATED` set** (MaxClicks, MaxConversions, TargetCpa, TargetRoas, MaxConversionValue, TargetImpressionShare) and **`bidsIgnoredReason`** — **CONFIRMED** — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [Refine your bids](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_newad_refinebids). CostPerSale (Shopping) is not covered by the set. Its bid behaviour is undocumented.

**bidStrategyProblem checks**
- **ManualCpc outside Audience → refuse** — **CONFIRMED**, with nuance: Audience *native* also lost Manual CPC in May 2024 (only Audience display/video and lodging keep it) — [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme?view=bingads-13).
- **Shopping + MaxConversions → refuse; Shopping supports eCPC, Max clicks, MCV (opt. tROAS)** — **CONFIRMED** by the help comparison table and the API docs (Max Conversions only for Smart Shopping). One conflicting help sentence exists — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [MaxConversionsBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionsbiddingscheme?view=bingads-13). **Missing**: Cost per sale is also a Shopping option, and existing standalone Target ROAS may persist on old Shopping campaigns.
- **PMax only MaxConversions/MaxConversionValue** — **CONFIRMED** — [PMax API guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max?view=bingads-13).
- **Switch to standalone TargetCpa/TargetRoas → refuse** (prompt.ts line 210, "Since August 2025 …") — **CONFIRMED**: 4 Aug 2025, existing ones are kept, portfolios unaffected. Note that the API would not error; it silently converts — [BiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddingscheme?view=bingads-13); [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).

**Budgets, impression share and other rules**
- **prompt.ts line 175** (budget only buys volume when IS is lost to budget; lost to rank is fixed by ads, quality and targets/bids) and **line 89** (no higher budget without lost-to-budget share) — **CONFIRMED** by the column definitions and the SOV help — [report attributes](https://learn.microsoft.com/en-us/advertising/guides/report-attributes-performance-statistics?view=bingads-13); [SOV help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_imprsharereports).
- **prompt.ts line 90** (raise budget only if lost IS budget ≥10%, CPA/ROAS within target ≥14 days, spend ≥90% of budget) — **HOUSE RULE, consistent with Microsoft**. "Eligible (limited)" = out of budget at least once in 7 days — [limited/out-of-budget help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_limitedoroutbudget). Add: under automated bidding Microsoft lets budget-limited campaigns over-achieve targets — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising).
- **prompt.ts line 177** (shared budgets and portfolios can't be changed per campaign) — **CONFIRMED** (a portfolio's type can't be changed; move the campaign instead) — [portfolio help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy_portfolio). **Missing**: Target ROAS can't use shared budgets except in a portfolio — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy). PMax can't use shared budgets — [shared budgets help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_sharedbudgets).
- **prompt.ts line 222** (mid-month budget formula, overspend usually under 2×, changes within about an hour) — **CONFIRMED** — [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13). Nuance: the help uses daily × 30.4 for the monthly figure — [budget options help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype). CPS can exceed 200% — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy).
- **prompt.ts line 224 / playbook line 16** (IS data 14–18 h after the UTC day; no hourly; error 2053) — **CONFIRMED** — [report attributes](https://learn.microsoft.com/en-us/advertising/guides/report-attributes-performance-statistics?view=bingads-13). **Missing**: Shopping IS only in campaign, ad group, product dimension and partition reports — same source.
- **prompt.ts line 220** ("an ad group without a CPC bid gets the currency's minimum bid") — **NOT VERIFIED**. The DKK minimum bid is documented as 0.06 — [Currencies](https://learn.microsoft.com/en-us/advertising/guides/currencies?view=bingads-13).
- **prompt.ts line 146** ("Under Maksimér konverteringsværdi no bid is needed") — **CONFIRMED** — [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies?view=bingads-13).

**Rules missing from the app** (all [OFF] unless marked):
1. **Max CPC**: deprecated for new standalone campaigns since 1 Oct 2026. Existing values can only be edited or removed (611274), and removal is irreversible per [3P SEL snippet](https://searchengineland.com/microsoft-advertising-removes-max-cpc-from-new-standalone-bidding-campaigns-485598). API field removal on 12 Jan 2027. Microsoft advises not to use it. — [blog 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026)
2. **Strategy choice**: new campaigns in an account with ≥5 conversions should start on Maximize Conversions + tCPA or Maximize Conversion Value + tROAS. Value-based bidding is preferred when real revenue is tracked. — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)
3. **Conversion timing**: if most conversions arrive more than 7 days after the click, or offline conversions aren't uploaded daily or within 2 days, don't use Maximize Conversions/tCPA. — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
4. **Statuses**: "Limited by auto-bidding target" (lower tROAS / raise tCPA to gain volume; not an error) and bid-strategy-report statuses such as "Limited: low data volume" and "Limited by max CPC". — [bid strategies help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [bid strategy report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategyreport)
5. **Evaluation level**: evaluate automated bidding at campaign or portfolio level on conversions and CPA/ROAS, not keyword CPCs, after 1–2 conversion cycles. — [blog 2026-11-18](https://about.ads.microsoft.com/en/blog/post/november-2026/building-the-next-generation-of-automated-bidding-at-microsoft-advertising)
6. **Model rollout**: bidding models upgraded from 18 Nov 2026 and rolling out over time. Expect pacing and target-adherence changes; check before attributing swings to account changes. — same source
7. **Over-achievement**: Microsoft lets automated campaigns over-achieve targets when budget-limited (unlike Google since Aug 2026). — [blog 31 Aug 2026](https://about.ads.microsoft.com/en/blog/post/august-2026/ai-max-for-search-and-other-product-news-for-august-2026); [3P ppc.land](https://ppc.land/microsoft-advertising-drops-max-cpc-from-new-campaigns-on-october-1/)
8. **PMax**:
   - budget 2–3× historical standalone campaigns
   - tROAS only after 30 conversions in 30 days
   - start with a loose target
   - wait 2 weeks between target changes
   - no bid adjustments
   - no shared budget
   - IS metrics at campaign level only

   — [PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices); [SOV help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_imprsharereports)
9. **Criteria levels**: ad-group device and schedule criteria override campaign ones (no union). Biddable audiences can't be set at both levels. — [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion?view=bingads-13); [AudienceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/audiencecriterion?view=bingads-13)
10. **Default adjustment**: new targeting associations get a default +15% bid adjustment. — [bid adjustments help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutadvancedbidding)
11. **Bid estimates**: first page, mainline and best position estimates, plus the first-page warning based on 7 days. — [estimated bids help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_location_opportunity); [Did I bid high enough?](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_biddingstrategy)
12. **Data-driven attribution**: rolled out May 2026 for Maximize Conversions, Maximize Conversion Value and eCPC. It can shift conversion counts and therefore CPA/ROAS. — [blog 19 May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)
13. **Google import**: imports can reset budgets and reactivate campaigns (already in the playbook navigation section; confirmed). — [budget options help](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutbudgettype)

### Inferences
- **Code changes**:
  - `MIN_CONVERSIONS_30D` and its message should say 30, per the Microsoft API guide. Alternatively, separate a "Microsoft: optimisation unreliable below 30/30d" warning from any hard block. Microsoft's own Nov 2026 advice (≥5 account conversions → conversion-based) argues against a hard refusal at 15.
  - The `LEVER` texts for MaxClicks and MaxConversions should drop "maks. CPC-loft". Replace with "budget, mål-CPA/-ROAS, konverteringsværdiregler, sæsonjustering".
- **Playbook wording**:
  - The stacking sentence should be qualified: "LinkedIn-segmenter ganges; øvrige justeringer er ikke entydigt dokumenteret (SA360 viser dem lagt sammen) – og under automatiske strategier er de kun signaler".
  - The −90% mobile/tablet default should come with a note that it is not a hard cap under automated bidding. Use −100% to exclude.
- **Timing rules**: the app's own timing rules are internally inconsistent (7 days in prompt.ts vs 2 weeks in the playbook). Microsoft's current guidance is "one conversion cycle" (Search/Shopping) and "2 weeks" (PMax). Steps of about 15%.

### Gaps
- Whether Microsoft's UI in Denmark still offers Maximize Conversion Value for standard Shopping, and whether the 1 Oct 2026 Max CPC removal also applies to campaigns created via API, Editor or import, could not be confirmed. ppc.land flags the API/Editor question as unanswered.
- No independent tests of Microsoft automated bidding (vs eCPC) were found to back or challenge Microsoft's 8–18% uplift claims.
