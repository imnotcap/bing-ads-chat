# Microsoft Advertising: keywords, match types, negatives, search terms and quality score (as of November 2026)

Research date: 2026-11-20 to 2026-11-23. Labels: **[Official]** = Microsoft documentation, a Microsoft blog or a Microsoft support answer. **[3rd]** = third-party. **(fetched)** = the full page was downloaded and read. **(snippet)** = only the WebSearch result text was seen (the host was blocked or the page is rendered with JavaScript). Dates are the page's "Last updated" date or its publish date.

Note on Microsoft's own pages: help.ads.microsoft.com is a JavaScript app and could not be fetched. The same articles are mirrored on learn.microsoft.com/advertising/msa-help, and those copies were fetched. The mirror can lag behind the live help site. For example, the match-type mirror (2026-06-26) still describes "predictive matching", which Microsoft folded into AI Max in July and August 2026.

---

## 1. Match types (exact, phrase, broad), BMM retirement, close variants, Microsoft vs Google, Danish-language behaviour

### Takeaway
Microsoft now has three positive match types: Exact, Phrase and Broad. Broad is the default and the one Microsoft recommends with auto-bidding. Phrase took over broad match modifier (BMM) behaviour in 2021. New BMM keywords were blocked from August 2021, and since 15 March 2023 old BMM keywords serve as **broad**, not phrase. Google's legacy BMM keywords serve as phrase, so an imported Google BMM keyword behaves more loosely on Microsoft. Exact and phrase both match close variants, which can include synonyms, paraphrases and "same intent". Since August 2026, AI Max search term matching adds a fourth, system-only "AIOptimized" delivered match type, and AI Max is **on by default for new Search campaigns**.

### Cited Findings
- Microsoft lists the match types as Broad (syntax `keyword`), Phrase (`"keyword"`) and Exact (`[keyword]`). Broad captures every query the narrower types would match, plus more. — [Official, fetched, 2026-06-26] [What are keyword match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- Broad is "the default keyword match type". It can match searches that don't contain the keyword's words, plus synonyms and misspellings. Microsoft's examples: "red flower" matches "crimson poppies" and "red roses"; "mobile phone" matches "telephone". — [Official, fetched, 2026-06-26] [About broad match](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_broadmatch); [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- Phrase matches when the query's meaning is similar to the keyword or part of it. Word order is respected when it matters: "chocolate milk" does not match "milk chocolate", and "garden tools" matches "best gardening tools" but not "gardening without tools". — [Official, fetched, 2026-06-26] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- Exact matches "the exact meaning of your keyword". Microsoft's example: [winter vacations] matches "winter vacation" and "vacations winter". — [Official, fetched, 2026-06-26] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- What close variants include (Microsoft support's wording): "singulars, plurals, abbreviations, misspellings, punctuations, accents, stemming, reordered words, synonyms, paraphrases, implied words, and same search intent". Phrase can also match reordered words "if the intent of the search query matches". — [Official support answer, fetched, 2022-11-09] [Microsoft Q&A, close variant](https://learn.microsoft.com/en-us/answers/questions/2288943/why-does-microsoft-charge-me-for-a-close-variant-t)
- The live help page reportedly says close-variation matching "applies only in certain countries" and that "exact match is preferred over exact match close variants". — [Official, snippet only] [help.ads.microsoft.com 50822](https://help.ads.microsoft.com/apex/index/3/en/50822). The fetched mirror confirms only the second part. Which countries are covered is **not** stated in any source I could read.
- In the search term report, "(close variant)" in the Match type column means a minor variation triggered the ad: misspellings, plurals, same search intent and so on. — [Official, fetched, 2026-06-26] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- Precedence: if the same keyword exists as exact and broad, exact wins, and reports count only the match type that won. — [Official, fetched] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- Older behaviour: in 2017 Bing Ads support confirmed that "enhanced exact" and "enhanced phrase" matching could map a branded exact keyword such as [usa military medals] to "american military medals". The advice was to add negatives. — [Official support, fetched, 2017] [Microsoft Q&A, "Advertisers BEWARE"](https://learn.microsoft.com/en-us/answers/questions/2290268/advertisers-beware-your-phrase-match-and-exact-mat)
- **BMM timeline:**
  - On 5 May 2021 Microsoft announced that phrase match would take on BMM behaviour, mirroring Google's change of February 2021. It rolled out first in the US and Canada. — [3rd, fetched, 2021-05-05] [SER](https://www.seroundtable.com/microsoft-advertising-expands-phrase-match-to-cover-broad-match-modifier-31366.html)
  - From August 2021 no new BMM keywords could be created, and existing BMM keywords served as phrase. — [3rd, fetched, 2021-05-05] [SER](https://www.seroundtable.com/microsoft-advertising-expands-phrase-match-to-cover-broad-match-modifier-31366.html)
  - Since 15 March 2023, "All broad match modifier keywords for Search ads now serve as broad match keywords instead of phrase match". — [3rd, fetched, 2023-03-16] [SER](https://www.seroundtable.com/microsoft-advertising-broad-match-modifier-bing-35063.html); still stated on [Official, 2026-06-26] [About broad match](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_broadmatch)
- Microsoft recommends broad match, saying auto-bidding "work[s] best with the broad match keyword type". It warns regulated industries to weigh the risks first. If most search terms are unrelated, it advises switching to phrase or exact. — [Official, fetched, 2026-06-26] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- Bid inheritance between match types: exact inherits phrase's bid, and phrase inherits broad's, never the other way. — [Official, fetched] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions). Since April 2021, ad groups and keywords can't have their own bid strategy; they inherit the campaign's. — [Official, fetched, 2026-09-29] [Keyword data object](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13)
- **Predictive matching (retired into AI Max, July–August 2026):** when it was on, every keyword in the campaign became broad and match types could not be changed. It needed Maximize conversions, Target CPA or Target ROAS. — [Official mirror, fetched, 2026-06-26, now outdated] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions). The Bulk docs still say that with predictive targeting on, the keyword match type reads "Predictive" and can't be changed. — [Official, fetched, 2026-09-29] [Bulk Keyword record](https://learn.microsoft.com/en-us/advertising/bulk-service/keyword?view=bingads-13)
- On 29 July 2026 a help notice said predictive matching was moving to search term matching in AI Max. — [3rd, snippet] [ppc.land](https://ppc.land/microsoft-kills-predictive-matching-shifts-search-ads-to-ai-max/) (blocked by Cloudflare)
- **AI Max (announced 21 April 2026, open pilot from May, global rollout from 19 August 2026)** has three parts: search term matching, text customization and final URL expansion. Campaigns that used predictive matching or auto-generated text had the matching AI Max setting switched on. The other features need an opt-in. AI Max settings carry over in Google imports, and imported Google AI Max campaigns that had been upgraded from DSA are converted back to DSA. — [3rd, fetched, 2026-08-19] [SEJ](https://www.searchenginejournal.com/microsoft-advertising-rolls-out-ai-max-globally/586459/)
- Microsoft's own AI Max post adds:
  - Expanded matches show as an "AI optimized" match type in search term and keyword reports.
  - AI Max "respects all existing Search campaign controls — including negative keywords".
  - Brand inclusions and exclusions and term exclusions are available.
  - "AI Max will also be enabled by default for any new Search campaigns you create in Microsoft Advertising, though it can still be turned off."
  - Microsoft cites at least +8% conversions in tests (44 experiments, spend-weighted ~13.6%), with a larger lift for campaigns that relied on exact and phrase.

  — [Official, fetched, 2026-08-27] [Microsoft Advertising blog: AI Max](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)
- API: AIOptimized "is a Reporting attribution value and an internal system match type used by AI Max search term matching. It is not a valid Campaign Management MatchType request value." — [Official, fetched, 2026-10-14] [MatchType value set](https://learn.microsoft.com/en-us/advertising/campaign-management-service/matchtype?view=bingads-13). The AIOptimized system keyword is not returned as a Keyword, can't be added, updated or deleted, and is left out of Bulk downloads. — [Official, fetched, 2026-09-29] [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13); [Bulk Keyword](https://learn.microsoft.com/en-us/advertising/bulk-service/keyword?view=bingads-13)
- **Match type can be updated in Microsoft:** both the Keyword data object and the Bulk Keyword record say MatchType is "Update: Optional", while keyword **Text** is "Update: Read-only". — [Official, fetched, 2026-09-29] [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13); [Bulk Keyword](https://learn.microsoft.com/en-us/advertising/bulk-service/keyword?view=bingads-13)
- Keywords exist only in Search campaigns: "It's not possible to add keywords to other campaign types." — [Official, fetched] [About broad match](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_broadmatch)
- Normalization rules that matter for Danish:
  - Matching ignores case and most punctuation.
  - **Accents are not removed.**
  - Stop words are not removed.
  - Singular and plural are separate keywords: "bike and bikes would be separate keywords. If you want to use both … bid on each separately."
  - Spaces matter: "bikerepair is not a duplicate of bike repair".

  — [Official, fetched, 2026-07-27] [About duplicate keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_normalization)
- Keywords should be written in the language set on the ad group. — [Official, fetched] [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13). Danish (DA) is a supported ad language. — [Official, fetched, 2025-06-26] [Ad Languages](https://learn.microsoft.com/en-us/advertising/guides/ad-languages?view=bingads-13)

### Inferences
- Microsoft treats singular/plural and spaced forms as different keywords. For Danish compound words, "kontorstol" and "kontor stol" are therefore separate keywords, and so are inflections such as stol / stole / stolen / stolene. Close variants may still cover some of these when serving, but only in markets where close variants apply, and that list isn't published. A safe Danish keyword set adds the main compound and its split form when both show up in search terms.
- Since BMM became broad in 2023, any keyword with "+" syntax that came in from Google, or is left from before 2021, is broad in Microsoft. It should be found and replaced with phrase or exact where control matters.
- AI Max is on by default for new Search campaigns. A campaign the app creates may expand beyond its keywords (AIOptimized matches) unless AI Max is switched off at creation. That runs against a house rule of "broad only with ≥30 conversions".

### Gaps
- Which countries or languages get close-variant matching, and whether Danish is among them. Not stated in any readable source.
- No Microsoft or third-party source on Danish compound-word matching specifically.
- Exact AI Max controls level: SEJ says ad group-level settings are kept, while a Search Engine Land comparison (snippet only, [SEL](https://searchengineland.com/google-vs-microsoft-ai-max-486296)) says controls are campaign-level. This is unresolved.
- No independent study of match-type performance on Microsoft was found. Optmyzr and Adalysis studies were not reached.

---

## 2. Negative keywords: match types, close variants, levels, limits, characters, Shopping and PMax

### Takeaway
Negatives can only be Exact or Phrase. There is no broad negative and no keyword-level negative. Negatives do **not** match close variants: plurals, synonyms, misspellings and inflections must each be added. There are four places to put them: account level (one list), campaign, ad group, and shared lists attached to campaigns (or, since February/March 2026, to the account). Since March 2026 Performance Max takes negatives too, but they apply only to Search and Shopping inventory. Microsoft's own pages disagree on the account-level limit (1,000 vs 5,000).

### Cited Findings
- Negative phrase: blocks if the query contains the words in the same order, whatever other words are present. Negative exact: blocks only when no extra words or characters are present. "Your ads may still appear for search queries that include additional words." — [Official, fetched, 2026-06-19] [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- The API phrase example: negative "sandals" blocks the query "small red sandals". Phrase is the default negative match type in the API. — [Official, fetched, 2025-06-26] [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13). Phrase is also the default in the PMax creation flow. — [Official, fetched, 2026-06-11] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- The supported NegativeKeyword MatchType values are Exact and Phrase. Text has a maximum of 100 characters. A negative "can be added and deleted, but cannot be updated". — [Official, fetched, 2024-11-13] [NegativeKeyword data object](https://learn.microsoft.com/en-us/advertising/campaign-management-service/negativekeyword?view=bingads-13). To change a match type, delete the negative and add it again. — [Official, fetched] [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13)
- **Close variants:** "Only the precise negative keyword will be filtered out. Variants (such as plurals, synonyms, and common misspellings of the negative keyword) are not filtered out … you will need to enter each one as a separate negative keyword." Capitalization is normalized. — [Official, fetched, 2026-06-19] [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- **Characters not supported in negatives:** `, . / ; ' [ ] = - \ < > ? : " | + _ ~ ! @ # $ % ^ & * ( ) ` { }` and line breaks or tabs. Apostrophes are allowed only as 's or 't. Example: "w-omens shoes" is filtered as "w omen's shoes". — [Official, fetched] [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- When adding in the UI, don't use "-" to mark a negative. Use [ ] for exact and " " for phrase. — [Official, fetched] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- Keyword-level negatives are not supported. Third-party tools may let you create them, but Microsoft ignores them. — [Official, fetched] [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- How the levels work:
  - **Account level:** one list per account. It applies to Search, Shopping and Performance Max and adds to campaign and ad group negatives. UI path: Campaigns > Settings > Account level options > Negative keywords. — [Official, fetched, 2026-06-11] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
  - **Campaign and ad group:** negatives at both levels are combined for the ad group. — [Official, fetched] [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13)
  - **Shared lists:** "Negative keyword lists cannot be associated with an ad group." — [Official, fetched] [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13)
  - The same guide also says "each campaign can be associated with one negative keyword list", which contradicts the entity-limits page: "a campaign can be associated with any or all negative keyword lists within the account". — [Official, fetched, 2026-11-19] [Entity limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13). The entity-limits page is newer, so it should be trusted.
- **Limits:**
  - 20,000 negatives per campaign and per ad group, up to 5,000,000 per account.
  - 20 negative keyword lists per account, 5,000 negatives per list.
  - At most 50,000 campaign-to-list associations per account.
  - So one ad group can effectively have 140,000 negatives.

  — [Official, fetched, 2026-11-19] [Entity limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13)
- **Account-level list size, a conflict between Microsoft sources:**
  - The help page says "one list at the account level that contains up to 1,000 negative keywords". — [Official, fetched, 2026-06-11/2026-06-19] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords); [About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
  - Microsoft's March 2026 blog says "Negative keyword lists can be applied at the campaign or account level, and the limit is 5000 negative keywords per list." — [Official, fetched, 2026-03-17] [Microsoft blog March 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026)
  - SEJ flagged the same inconsistency. — [3rd, fetched, 2026-02-27] [SEJ PPC Pulse](https://www.searchenginejournal.com/ppc-pulse-googles-asset-guidance-ad-scheduling-updates-microsoft-negatives/568271/)
- **Self-serve lists and PMax negatives (new in 2026):**
  - Self-serve negative keyword lists went live around 25 February 2026 (Navah Hopkins). — [3rd, fetched, 2026-02-27] [SER](https://www.seroundtable.com/microsoft-advertising-negative-keyword-lists-41005.html)
  - PMax negatives can be added, changed or deleted like in other campaigns, including through lists. "Negative match types will behave the same for PMax as they do for traditional Search campaigns." API, Editor and Google import support followed in March. "negative keywords currently only apply to Search and Shopping inventory in PMax." — [Official, fetched, 2026-03-17] [Microsoft blog March 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026)
  - The help page still says PMax negatives are "Not everyone has this feature yet". — [Official, fetched, 2026-06-11] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- **PMax brand exclusions:** brand exclusion lists can be applied to PMax ("Not everyone can use brand exclusions yet"). — [Official, fetched, 2026-06-11] [About Performance Max](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax). Brand inclusions and exclusions arrived for Search through AI Max in August 2026. — [Official, fetched, 2026-08-27] [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max). Brand list sizes are reported as up to 20 brand lists per campaign and up to 100 brands per list. — [3rd, snippet only] [SEL Google vs Microsoft AI Max](https://searchengineland.com/google-vs-microsoft-ai-max-486296). **Not verified in Microsoft docs.**
- **PMax vs Search priority:** if a query matches a Search keyword in the account, the Search ad takes priority over PMax. Exact-match Search keywords are prioritized over PMax. Otherwise the highest ad rank serves. PMax website exclusions work only at account level. — [Official, fetched, 2026-06-11] [About Performance Max](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- **Shopping:** account-level negatives apply to Shopping, and a separate "Product negative keyword conflicts" report exists (Reporting > Templates > Product ads). — [Official, fetched, 2026-07-27] [Negative keyword conflicts](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_intentionalnkwconflicts); [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- **Conflicts:** a negative identical to a keyword blocks it. Microsoft separates "Possibly intentional" conflicts (for example, an exact negative used to funnel a phrase keyword) from "True" conflicts. After adding campaign-level phrase negatives, run the conflict report a day later. — [Official, fetched, 2026-07-27/2026-06-17] [Conflicts](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_intentionalnkwconflicts); [Search terms → keywords/negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_searchterm). The API equivalent is NegativeKeywordConflictReportRequest. — [Official, fetched] [Negative Keywords guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13)
- Language: if a campaign has ad groups in different languages, negatives added in the UI go only to ad groups whose language matches the account's. Bulk edits use the account language. — [Official, fetched] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- There is no way to apply negative lists across all accounts or sub-accounts at once. — [Official, fetched] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- API error codes: 4335 `NegativeKeywordAlreadyExists` (already in list), 4338 `NegativeKeywordDuplicateFound` (duplicates in one call), 4334 duplicate list name. — [Official, fetched, 2026-08-10] [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes?view=bingads-13)
- Practitioner opinion: "Exact by default is the safe way to build up your list", because one mistaken phrase negative can block delivery. — [3rd, fetched, 2026-02-27] [SEJ PPC Pulse](https://www.searchenginejournal.com/ppc-pulse-googles-asset-guidance-ad-scheduling-updates-microsoft-negatives/568271/)

### Inferences
- In Danish, a phrase negative "brugt" won't block "brugte" or "brugtmarked", because negatives don't match variants. Compound words make this worse: "gratis" doesn't block "gratisfragt", since it is one token. Each inflection or compound that appears in search terms must be added on its own.
- Hyphens and other symbols are unsupported in negatives. Danish terms with hyphens ("3-sæders", "e-cykel") should be entered without the hyphen or with a space, as Microsoft would normalize them.
- The account-level list is the only way to reach PMax and Shopping together. Its 1,000 limit (per help) should be treated as the safe ceiling until Microsoft's pages agree.

### Gaps
- Whether the account-level list really holds 1,000 or 5,000 entries in November 2026. Microsoft's sources conflict.
- Whether PMax negatives are now fully available to all accounts. The help mirror still says "coming soon".
- Exact Microsoft brand-list limits in official docs.

---

## 3. Search term report, privacy thresholds, data delay, search terms insights, deciding on negatives and new keywords

### Takeaway
Microsoft's search term report only lists terms with "a significant number of clicks". The rest are pooled in an "Other search terms" row on the Keywords tab, and Microsoft publishes no hidden share. PMax has category-level "Search terms insights" that include every term, but with up to three days' delay. Microsoft sets no threshold for deciding on a negative. Practitioner heuristics are 2× target CPA with no conversions, or 3× over 90 days.

### Cited Findings
- The report shows "search terms that have had a significant number of clicks in the last 30 days". The Keywords tab adds an "Other search terms" row for terms with impressions but no significant clicks. The report's impressions are therefore "a fraction" of the totals in other reports. — [Official, fetched, 2026-06-17/2026-06-19] [Search terms → keywords/negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_searchterm); [Run a search term report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchqueryreport)
- API: "The report will include only search terms that resulted in a significant number of clicks in the last 30 days … please use the KeywordPerformanceReportRequest to get the performance metrics for your keywords." If no time zone is set, the default is PacificTimeUSCanadaTijuana. — [Official, fetched, 2024-11-13] [SearchQueryPerformanceReportRequest](https://learn.microsoft.com/en-us/advertising/reporting-service/searchqueryperformancereportrequest?view=bingads-13)
- Search terms include Bing, AOL, Yahoo and their syndicated search partners. — [Official, fetched] [Search terms → keywords/negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_searchterm)
- UI: Campaigns > Keywords > Search terms > "Add as keywords" or "Add as negative keywords", choosing campaign or ad group level and the match type. For DSA: Campaigns > Dynamic ad targets > Search terms > Add as negative keyword. — [Official, fetched] [Search terms → keywords/negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_searchterm); [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- **Search terms insights** exist only for PMax. They group terms into auto-generated categories that "include all search terms, even those not shown in the search terms report". Metrics include clicks, CTR, conversions, conversion rate, conversion value, impressions and search volume. Results can take up to three days. Path: Reporting > Performance > Search terms insights. — [Official, fetched, 2026-06-19] [Search terms insights](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchtermsinsights)
- AI Max adds an "AI optimized" match type label to search term reports and a new search-term landing page report template. — [Official, fetched, 2026-08-27] [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)
- A comparison article reports that Microsoft gives full search term reporting for any query that got a click, across AI Max, PMax, Search and Shopping. — [3rd, snippet only] [SEL Google vs Microsoft AI Max](https://searchengineland.com/google-vs-microsoft-ai-max-486296). This contradicts the "significant number of clicks" wording in Microsoft's own docs, so treat it as unverified.
- Microsoft's own optimization advice: if most terms are unrelated, use phrase or exact; add terms that should trigger more often as phrase or exact keywords; add unwanted terms as negatives. — [Official, fetched] [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions). For DSA, add other campaigns' paused keywords and existing negatives as negatives in the DSA ad groups. — [Official, fetched, 2026-06-26] [About DSA](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dynamicsearchads)
- Thresholds (practitioner heuristics, not Microsoft rules): a query that "has cost more than 3x the target CPA with zero conversions over 90 days" is used as an example rule. — [3rd, snippet] [Search Engine Land negative keyword strategy](https://searchengineland.com/negative-keywords-strategy-476563). A third-party Microsoft Ads agent skill treats a term as waste only at ≥2× the cost target, or 2× account CPA when there is no target, and calls anything below that "too early". — [3rd, snippet, low authority] [coupler.io skill](https://www.coupler.io/ai-agent-skills/microsoft-ads-waste-and-scale/download)
- For comparison, Google's search terms privacy threshold is undisclosed. Third-party studies estimate large hidden shares on Google, around 40% of clicks and spend in one analysis. These are Google figures, not Microsoft. — [3rd, snippet] [SEL on hidden Google search terms](https://searchengineland.com/google-ads-hidden-search-terms-cost-advertisers-458306)

### Inferences
- The "last 30 days" wording suggests the significance filter is applied over a rolling 30-day window. Longer date ranges (the app uses last 90 days) will still miss low-click terms, so zero-click terms with impressions cannot be judged from the report.
- In a small Danish account, many terms won't reach the "significant clicks" threshold. The "Other search terms" share should be mentioned when the visible spend is far below the keyword spend.

### Gaps
- No Microsoft-published share or number for the significance threshold, and no independent study of Microsoft search term visibility.
- No documented data delay for the search term report specifically. Only PMax insights (up to 3 days) are documented.

---

## 4. Keyword planner and research tools, Denmark data

### Takeaway
Microsoft's Keyword Planner page now says **all** supported markets are available. Denmark has been a Microsoft Advertising market since December 2022/January 2023. The old six-country list (US, UK, CA, AU, FR, DE) is outdated. Volumes are rounded, ignore match type, show a dash when data is thin, and can lag up to 72 hours at month start.

### Cited Findings
- "Use keyword planner to research campaigns aimed at worldwide, all Microsoft Ads supported markets are now available with keyword planner." — [Official, fetched, undated, read 2026-11-23] [Microsoft Advertising Keyword planner page](https://about.ads.microsoft.com/en/tools/planning/keyword-planner)
- Denmark was among 34 markets added in December 2022, bringing the total to 164. — [Official, snippet] [Microsoft blog Jan 2023, 164 markets](https://about.ads.microsoft.com/en/blog/post/january-2023/access-a-world-of-opportunity-scaling-campaigns-to-164-markets). An older Bing Ads page listed only US, Canada, UK, France, Germany and Australia for the Keyword Planner. — [Official legacy, snippet] [Benefits of keyword planner](https://about.ads.microsoft.com/en-us/bing-ads-intelligence). This is superseded.
- Keyword Planner can take up to 200 words or phrases, a URL or a category, plus targeting, negatives and a date range. It returns monthly volume trends, competition, suggested minimum bid and ad impression share. Path: Tools > Keywords. It extracts keywords only from a page's HTML, not from JavaScript-rendered content. — [Official, fetched, 2026-06-26] [How to use keyword planner](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_keywordplannerintro)
- About average monthly searches:
  - Averaged over 12 months by default.
  - Location and network settings are used; the **language setting is not**.
  - A dash means not enough data.
  - The number "does not take into account keyword match types".
  - Volumes are rounded.
  - "Suggested bid" is the suggested **minimum** bid.
  - Traffic estimates are weekly.

  — [Official, fetched, 2026-06-26] [Keyword planner statistics](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_keywordplanner_statisticstrafficestimates)
- API: GetKeywordIdeas must include LanguageSearchParameter, LocationSearchParameter and NetworkSearchParameter. The previous month's data can take up to 72 hours to arrive, and the request errors if a date range asks for a month that isn't ready yet. — [Official, fetched, 2024-11-13] [GetKeywordIdeas](https://learn.microsoft.com/en-us/advertising/ad-insight-service/getkeywordideas?view=bingads-13). GetHistoricalSearchCount: the countries in PublisherCountries must support the language. — [Official, fetched] [GetHistoricalSearchCount](https://learn.microsoft.com/en-us/advertising/ad-insight-service/gethistoricalsearchcount?view=bingads-13). GetKeywordTrafficEstimates needs language, location and network, and each keyword with a match type. — [Official, fetched, 2025-06-26] [Keyword ideas & traffic estimates guide](https://learn.microsoft.com/en-us/advertising/guides/keyword-ideas-traffic-estimates?view=bingads-13)
- The delivery status **"Low search volume"** means the keyword has very little or no search history. It stays inactive until traffic increases, and Microsoft rechecks weekly. — [Official, fetched, 2026-06-26] [Delivery status](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialstatus)

### Inferences
- For Denmark the planner should return data, but many Danish long-tail terms will show "-". The tool should report "no data" rather than zero, and lean on the account's search terms. Low-volume keywords may sit in "Low search volume" status and not serve at all.

### Gaps
- No source states how complete Danish-language volume data is.

---

## 5. Quality score, ad relevance, landing page experience

### Takeaway
Quality score is 1–10 per keyword, with three components each scored 1–3 (below average, average, above average). Microsoft states plainly that it is **not used at auction time and does not affect cost or spend**. It is a diagnostic. It is based on exact-match traffic over the last 30 days and updated daily, usually between 2 and 6 pm GMT. Coverage for phrase and broad keywords is reduced in international markets, which includes Denmark.

### Cited Findings
- QS ranges 1–10. The components are expected CTR, ad relevance and landing page experience, each 3 = above average, 2 = average, 1 = below average. Roughly: 1–5 means at least one component is below average, 6 means average, and 7–10 means all above average. — [Official, fetched, 2026-06-19] [Quality score in depth](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- "Quality score is an evaluation of your ads, keywords, and landing pages based on historical performance in past auctions. It is not used at auction time to determine ad rank, and does not affect cost or spend." — [Official, fetched, 2026-06-19] [Quality score in depth](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- Landing page experience is based on how often customers leave the landing page shortly after arriving. — [Official, fetched] [Quality score in depth](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- How QS is calculated and updated:
  - It is based on queries that matched keywords **exactly** in the last 30 days. "In international markets, you may see a decrease in quality score coverage for phrase match and broad match keywords."
  - Syndicated partner traffic is excluded.
  - It is "usually updated between 2 and 6 p.m., GMT", and "updated every day".
  - History is available for 18 months.
  - Blank values mean too little search traffic.
  - Campaign and ad group QS are aggregates of their keywords.

  — [Official, fetched, 2026-06-19] [Quality score in depth](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- "Quality impact" forecasts impressions gained by improving QS: 3 = >500/day, 2 = 100–500, 1 = <100. — [Official, fetched] [Quality score in depth](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- The delivery status "Low quality score" means ads are running but less competitive. — [Official, fetched] [Delivery status](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialstatus)
- The Bulk Keyword record exposes "Keyword Relevance" and related component columns. — [Official, fetched, 2026-09-29] [Bulk Keyword](https://learn.microsoft.com/en-us/advertising/bulk-service/keyword?view=bingads-13)

### Inferences
- In a Danish account, many phrase and broad keywords will show a blank QS. A blank is "not enough data", not "bad".
- The same components that make up QS (expected CTR, relevance, landing page) presumably still feed the real-time auction. But Microsoft says the reported QS number itself does not set price, so chasing the number is not a goal.

### Gaps
- How much the underlying signals weigh in Microsoft's ad rank is not documented.

---

## 6. Keyword editorial rules: length, characters, duplicates, trademarks (Denmark/EU), statuses and editorial reasons

### Takeaway
Keyword text is at most 100 characters, cannot be edited after creation (only replaced), and must be in the ad group's language. Every keyword goes through editorial review, which usually takes under 48 hours. Statuses: KeywordStatus Active/Paused/Inactive (Inactive = under review or rejected) and KeywordEditorialStatus Active/ActiveLimited/Inactive/Disapproved. Microsoft allows duplicates that differ only in punctuation; accents are not normalized. Trademark rules depend on the market, and no Denmark-specific statement was found.

### Cited Findings
- Keyword text max 100 characters, "Update: Read-only". — [Official, fetched, 2026-09-29] [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13); [Entity limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13)
- Limits: 20,000 keywords per ad group, 5,000,000 per account and 50,000,000 per customer. Param1 max 1,022 characters; Param2 and Param3 max 70; final URL max 2,048. — [Official, fetched, 2026-11-19] [Entity limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13)
- KeywordStatus values: Active, Paused, Inactive ("undergoing editorial review or has failed editorial review") and Deleted (internal only). — [Official, fetched, 2024-11-13] [KeywordStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keywordstatus?view=bingads-13)
- KeywordEditorialStatus values: Active (passed review), ActiveLimited (passed in one market, still pending in another), Disapproved, and Inactive (an element is under review). — [Official, fetched, 2024-11-13] [KeywordEditorialStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keywordeditorialstatus?view=bingads-13)
- UI delivery statuses: "Approved limited" means approved in at least one targeted location and disapproved in another. Others: "Disapproved", "Disapproved, exception denied", "Exception under review", "Pending editorial review" (most done within a day), "Below first page bid", "Low search volume" (rechecked weekly), "Low quality score" and "Keyword paused". — [Official, fetched, 2026-06-26] [Delivery status](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialstatus)
- The review process: ad text, assets, keywords, extensions and customizers all get an editorial review. An extra review, which can take hours, is triggered by double meanings, **registered trademarks**, or "A keyword is not in the editorial database". "Most reviews are completed within 48 hours." Ads must be in the ad group's language and market. Reviews continue after go-live, so live keywords can be disapproved later. A protocol-only URL change does not trigger re-review. — [Official, fetched, 2026-06-26] [The editorial review](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editprocess)
- Reading editorial reasons: hover over the status in the Delivery column of the Keywords table. The detection mode is System, User or Legal order, and the rejection was by System or Manual review. A disapproved keyword cannot be edited: "add a new keyword and then delete the disapproved keyword". Exceptions can be requested via Edit > Request exception, for up to 5,000 ads at once account-wide. Policies "may vary depending on the country/region". — [Official, fetched, 2026-06-26] [Fix Disapproved / Approved Limited](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialdisapprovalreasons)
- Duplicates:
  - Microsoft "will allow you to add keywords that are duplicates after normalization, though they won't impact your keyword coverage". Normalization strips characters such as `" & - * % ( ) [ ] { } . , ? / \ : ; ! < > + # = | _ ~ @ $ ^ ``, and apostrophes except 's and 't.
  - It is case-insensitive.
  - Accents are **not** removed.
  - Singular and plural are not duplicates.
  - When duplicates exist, typically the highest-bid one reports the click.

  — [Official, fetched, 2026-07-27] [About duplicate keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_normalization)
- API error codes:
  - 1517 `CampaignServiceDuplicateKeyword`: "An attempt was made to create a duplicate of a keyword that already exists".
  - 1542 `CampaignServiceKeywordAndMatchTypeCombinationAlreadyExists`.
  - Text errors: `CampaignServiceInvalidKeywordText`, `CampaignServiceForbiddenWordInKeywordText`, `CampaignServiceExclusiveWordInKeywordText` ("reserved word"), `KeywordTooLong`.

  — [Official, fetched, 2026-08-10] [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes?view=bingads-13)
- Trademarks:
  - Microsoft's IP policy says trademark complaints about keywords and ad copy go through the Intellectual Property Concern Form. Some markets get keyword investigations; others are limited to ad copy. Safe harbors cover informational sites, dictionary uses and authorized resellers. Owners should first contact the advertiser, since Microsoft is not a mediator. — [Official, snippet only, the page is JavaScript-rendered and redirects to help.ads.microsoft.com ext60211] [Intellectual property policies](https://about.ads.microsoft.com/en-us/policies/intellectual-property-policies)
  - History: Microsoft stopped reviewing US and Canada trademark keyword complaints from 3 March 2011, while still investigating ad text, and the UK kept keyword coverage at that time. — [3rd, snippet, 2011] [Pinsent Masons Out-Law](https://www.pinsentmasons.com/out-law/news/microsoft-will-not-pursue-keyword-trade-mark-users-in-us); [Eric Goldman blog 2011](https://blog.ericgoldman.org/archives/2011/02/microsoft_adopt.htm)
  - Trademarked terms trigger an extra editorial review. — [Official, fetched] [The editorial review](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editprocess)

### Inferences
- Danish letters æ, ø and å are distinct letters, not accents, so they are not normalized. "kokken" and "køkken" are different keywords. Words with real accents (idé, allé, café) are also kept distinct from their unaccented spelling under the current normalization rules.
- When a keyword is "Inactive", the app should read EditorialStatus and delivery status before reporting it as live. "ActiveLimited" or "Approved limited" can happen with multi-country targeting, for example Denmark plus neighbouring regions.

### Gaps
- The current IP policy's market list (whether Denmark and EU markets get keyword-level trademark investigations) could not be read, because the page renders with JavaScript. EU case law (CJEU Google France, 2010, on trademark keywords) was not fetched or verified in this research.
- No list of Microsoft's forbidden or reserved keyword words.

---

## 7. Dynamic Search Ads

### Takeaway
DSA is available in all markets, including Denmark, and Microsoft says it will keep supporting DSA "until further notice" (August 2026), unlike Google. DSA uses website content in place of keywords. Exclusions are done with negative dynamic ad targets and with negative keywords on DSA ad groups. Microsoft pushes a "DSA → PMax" upgrade recommendation.

### Cited Findings
- "This feature is available in all Microsoft Advertising markets." DSA is turned on per Search campaign under Settings > Dynamic Search ads. It "cannot be disabled once enabled", and the website cannot be edited. Serving starts within a week, sometimes up to ten days. — [Official, fetched, 2026-06-26] [About Dynamic Search ads](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dynamicsearchads). The API country list includes Denmark (DK). — [Official, fetched, 2025-06-26] [DSA API guide](https://learn.microsoft.com/en-us/advertising/guides/dynamic-search-ads?view=bingads-13)
- Targets: recommended categories, all webpages, or specific pages (URL, category, title or content "contains"). Negative dynamic ad targets work at campaign or ad group level, and conditions cannot be changed once a target is created. Tips: make sure there is no NoIndex; use the same language for campaign, ad group, ad and domain; set bids near non-exact keyword bids; add other campaigns' paused keywords and negatives as DSA negatives. — [Official, fetched] [About DSA](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dynamicsearchads)
- API: an ad group-level negative DSA target **overrides** (ignores) the campaign-level negative target for that ad group. This is unlike negative keywords, which stack. — [Official, fetched, 2025-06-26] [DSA API guide](https://learn.microsoft.com/en-us/advertising/guides/dynamic-search-ads?view=bingads-13)
- DSA search terms can be turned into negatives via Campaigns > Dynamic ad targets > Search terms. — [Official, fetched] [Add negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- The DSA → PMax upgrade is offered as a recommendation. Microsoft claims an average +24% conversions or value at similar CPA/ROAS. Eligibility: up to 100 active DSA ad groups, no shared budget. Account-level negatives, URL rules and page-feed exclusions carry over. Learning takes up to 6 hours. — [Official, fetched, 2026-07-27] [DSA → PMax upgrade](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dsa_pmax_upgrade)
- "DSA campaigns will continue to be supported in Microsoft Advertising until further notice". Google-imported upgraded DSA campaigns are converted back to DSA. — [Official, fetched, 2026-08-27] [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)

### Inferences
- If the team runs DSA alongside keyword campaigns, the keyword campaigns' converting terms should be added as negatives in DSA (or vice versa), so the two don't compete. This follows Microsoft's own tip.

### Gaps
- No source on how DSA and AI Max search term matching interact in the same campaign.

---

## Against the current rules (src/ai/playbooks/microsoftAds.ts and the keyword/negative parts of src/ai/prompt.ts)

### Takeaway
Most of the app's keyword and negative rules match Microsoft's docs. Four should change, and each is detailed below:
- the keyword-planner "6 countries only" rule, which is outdated;
- "match type cannot be changed", which Microsoft's API docs contradict;
- "duplicates that differ in case/accents/punctuation are rejected", which is partly wrong;
- "negatives at campaign or ad group level", which leaves out account level, lists and PMax.

Missing entirely: negatives don't match variants (plurals and inflections must be added one by one), the rule against symbols in negatives, AI Max on by default for new campaigns, BMM = broad since 2023, PMax negatives apply only to Search/Shopping, "Low search volume", the search-term-report significance filter, and QS being blank in international markets.

### Cited Findings
**Confirmed**
- *prompt.ts* "Match types (Exact, Phrase, Broad), negative keywords (Exact/Phrase)" — **confirmed**. — [MatchType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/matchtype?view=bingads-13); [NegativeKeyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/negativekeyword?view=bingads-13)
- *prompt.ts* "Keywords: max 100 characters" — **confirmed**. — [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13)
- *prompt.ts* "1542 = the keyword with that match type already exists" — **confirmed**: `CampaignServiceKeywordAndMatchTypeCombinationAlreadyExists`. — [Error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes?view=bingads-13)
- *prompt.ts* "Negative keywords: Exact or Phrase only, max 100 characters, up to 20,000 per campaign or ad group. They cannot be edited – delete and add again." — **confirmed**. — [Entity limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13); [NegativeKeyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/negativekeyword?view=bingads-13). The UI shows an "Edit" option for negatives. — [Add negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- *prompt.ts* "Statuses: ads and keywords show 'Inactive' while under editorial review or when rejected – check the editorial status (Active / ActiveLimited / Inactive = under review / Disapproved)" — **confirmed**. — [KeywordStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keywordstatus?view=bingads-13); [KeywordEditorialStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keywordeditorialstatus?view=bingads-13)
- *prompt.ts* "quality score updates once a day" and *playbook* "kvalitetsresultat opdateres 14–18 timer efter dagens slutning (UTC)" — **confirmed** ("usually updated between 2 and 6 p.m., GMT"). — [Quality score](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- *playbook* "Kvalitetsresultat: … (3 = over gennemsnit, 2 = gennemsnit, 1 = under). Det er en diagnose, ikke et mål, og påvirker ikke prisen direkte." — **confirmed**, and Microsoft goes further: QS "is not used at auction time to determine ad rank, and does not affect cost or spend". — [Quality score](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- *playbook navigation* "Søgetermer: Kampagner → Søgeord → Søgetermer. (Performance Max: Rapportering → Ydeevne → Søgetermindsigt.)" and "Negative søgeordslister: Værktøjer → Negative søgeordslister" — **confirmed**: Campaigns > Keywords > Search terms; Reporting > Performance > Search terms insights; Tools > Negative keyword lists. — [Search terms](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_searchterm); [Search terms insights](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchtermsinsights); [Add negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords)
- *prompt.ts* "Search term reports are the main source of negative keywords" — **consistent** with Microsoft's advice. — [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- *prompt.ts* "Prefer one Phrase negative on the unwanted word when it covers several terms" — **consistent** with phrase-negative semantics (it blocks any query containing the words in order). The limit is that it does not cover inflections. — [About negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords). A practitioner counter-view is "Exact by default is the safe way". — [SEJ](https://www.searchenginejournal.com/ppc-pulse-googles-asset-guidance-ad-scheduling-updates-microsoft-negatives/568271/)
- *playbook guardrails* "Negativt søgeord: 0 konverteringer efter forbrug på mindst 1,5–2× mål-CPA eller mindst 30 klik" — a **house rule**. Microsoft has no threshold. It is in line with practitioner heuristics of 2× target ([coupler.io, snippet](https://www.coupler.io/ai-agent-skills/microsoft-ads-waste-and-scale/download)) and 3× over 90 days ([SEL, snippet](https://searchengineland.com/negative-keywords-strategy-476563)). The lower end, 1.5×, is more aggressive than either.
- *prompt.ts / playbook* "Broad only under automated bidding with ≥30 conversions in 30 days" — a **house rule**, stricter than Microsoft, which recommends broad with auto-bidding without a conversion floor. — [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)

**Contradicted**
- *prompt.ts* "Keyword planner (get_keyword_ideas): Microsoft documents keyword ideas only for the US, UK, Canada, Australia, France and Germany. For Denmark expect an empty or refused answer" — **contradicted/outdated**. Microsoft now says "all Microsoft Ads supported markets are now available with keyword planner" — [Keyword planner page](https://about.ads.microsoft.com/en/tools/planning/keyword-planner) — and Denmark has been a market since December 2022 ([Microsoft blog Jan 2023, snippet](https://about.ads.microsoft.com/en/blog/post/january-2023/access-a-world-of-opportunity-scaling-campaigns-to-164-markets)). The six-country list comes from a legacy page ([snippet](https://about.ads.microsoft.com/en-us/bing-ads-intelligence)). The playbook's own "research_keywords (Microsofts søgetal i Danmark …)" also already assumes Danish data. Suggested wording: Danish data exists but is thin; a dash means "no data", never invent volumes.
- *prompt.ts* "A keyword's match type cannot be changed – add a new keyword with the new match type (and pause/delete the old one)" — **contradicted by API docs**. MatchType is "Update: Optional" on both the Keyword object and the Bulk Keyword record; only Text is read-only. — [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword?view=bingads-13); [Bulk Keyword](https://learn.microsoft.com/en-us/advertising/bulk-service/keyword?view=bingads-13). It is not verified in practice whether history carries over. If the app's update tool sees Microsoft silently ignore or refuse the change, keep the rule, but cite that observation instead.
- *prompt.ts* "Duplicates that only differ in case, accents or punctuation are rejected" — **partly contradicted**. Help says Microsoft "will allow you to add keywords that are duplicates after normalization" (punctuation and case). It also says accents "will not be removed", so accented and unaccented forms are not duplicates. — [About duplicate keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_normalization). The API does have 1517 DuplicateKeyword and 1542 for exact text and match-type duplicates. — [Error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes?view=bingads-13). Safer wording: "Duplicates that differ only in case or punctuation add no coverage (Microsoft may accept or reject them); accents and singular/plural are separate keywords."
- *prompt.ts* "negative keywords (Exact/Phrase) at campaign or ad group level" and "Negative keyword lists (shared) are a separate feature" — **incomplete**. It leaves out:
  - the account-level list, which applies to Search, Shopping and PMax (1,000 per help, 5,000 per the March 2026 blog);
  - shared lists: 20 per account, 5,000 each, attachable to campaigns and, since 2026, to the account, never to ad groups;
  - PMax negatives, since March 2026, which affect only Search and Shopping inventory.

  — [Add negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_addnegativekeywords); [Entity limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits?view=bingads-13); [Microsoft blog Mar 2026](https://about.ads.microsoft.com/en/blog/post/march-2026/negative-keywords-for-pmax-and-other-product-news-for-march-2026)
- *playbook navigation* (Danish menu names such as "Kampagner → Søgeord") — **flag, outside my area**. Danish is not among Microsoft Advertising's display (UI) languages; it is only an ad and billing language. A Danish team will see an English (or other) UI. — [About language options](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutlanguageoptions). The English names the playbook already gives should come first.

**Missing (to add)**
- Negatives do not match close variants: plurals, misspellings and synonyms must each be added. Capitalization is normalized. — [About negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords). The Danish consequence: add each inflection or compound that appears in search terms (inference).
- Negatives can't contain `, . / ; ' [ ] = - \ < > ? : " | + _ ~ ! @ # $ % ^ & * ( ) ` { }`, and apostrophes are allowed only as 's or 't. Keyword-level negatives are ignored. — [About negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- After adding phrase negatives at campaign level, run the negative keyword conflict report a day later (in the API: NegativeKeywordConflictReportRequest). — [Search terms](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_searchterm); [Negative guide](https://learn.microsoft.com/en-us/advertising/guides/negative-keywords?view=bingads-13)
- Positive exact and phrase match close variants, including synonyms, paraphrases and same intent. Look for "(close variant)" in the search term report. — [Microsoft support](https://learn.microsoft.com/en-us/answers/questions/2288943/why-does-microsoft-charge-me-for-a-close-variant-t); [match types](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_matchoptions)
- Since 15 March 2023, legacy BMM ("+word") keywords serve as **broad**. Imports from Google with BMM syntax therefore become broad. — [About broad match](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_broadmatch); [SER 2023](https://www.seroundtable.com/microsoft-advertising-broad-match-modifier-bing-35063.html)
- **AI Max:** on by default for new Search campaigns since the August 2026 global rollout. Search term matching adds "AI optimized" matches that respect negatives. Predictive matching and auto-generated text were folded in. Settings come over with Google imports. create_campaign should turn it off explicitly unless the user wants it, and the approval card should say so. — [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max); [SEJ](https://www.searchenginejournal.com/microsoft-advertising-rolls-out-ai-max-globally/586459/)
- The search term report lists only terms with a significant number of clicks in the last 30 days. Low-volume terms go to "Other search terms", so the report undercounts compared with keyword totals. — [Search term report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchqueryreport); [SQR API](https://learn.microsoft.com/en-us/advertising/reporting-service/searchqueryperformancereportrequest?view=bingads-13)
- QS is based on exact-match traffic. In international markets QS coverage for phrase and broad keywords is reduced, so a blank QS often means "not enough data". Syndicated partners are excluded. — [Quality score](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutqualityscore)
- The "Low search volume" delivery status keeps a keyword inactive and is rechecked weekly. Common for Danish long-tail terms (inference). — [Delivery status](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialstatus)
- A disapproved keyword cannot be edited: add a new one and delete the old one, or request an exception. Editorial review usually takes under 48 hours. Trademarked terms trigger extra review. — [Fix disapprovals](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editorialdisapprovalreasons); [Editorial review](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_editprocess)
- A Search keyword match takes priority over PMax: exact-match Search keywords beat PMax, so adding exact keywords pulls those queries away from PMax. — [About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- DSA: available in Denmark and supported "until further notice". Negative dynamic ad targets at ad group level override the campaign-level ones. DSA search terms can be made into negatives. The app has no DSA rules today. — [About DSA](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dynamicsearchads); [DSA API guide](https://learn.microsoft.com/en-us/advertising/guides/dynamic-search-ads?view=bingads-13); [AI Max blog](https://about.ads.microsoft.com/en/blog/post/august-2026/reimagining-search-campaigns-for-the-ai-era-with-ai-max)
- Keyword Planner volumes ignore match type and language setting, are rounded, and show "-" when data is thin. Suggested bid is a minimum. — [Planner statistics](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_keywordplanner_statisticstrafficestimates)

### Inferences
- The highest-value fixes for a Danish account: (1) the negatives-don't-match-variants rule, because Danish inflects heavily; (2) switching AI Max off explicitly on new campaigns; (3) the corrected keyword-planner rule.

### Gaps
- Whether changing a keyword's match type through the API keeps its history or quality score is not documented. It should be tested once before the rule is changed.
- The account-level negative list limit (1,000 vs 5,000) is unresolved in Microsoft's own docs.
