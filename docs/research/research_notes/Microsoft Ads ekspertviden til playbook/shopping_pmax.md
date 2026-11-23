# Microsoft Advertising Shopping, Performance Max and Microsoft Merchant Center (as of November 2026, Danish advertiser)

Source conventions:
- **[O-API]** is the official Microsoft Advertising API docs on learn.microsoft.com/advertising. The date given is the page's "Last updated".
- **[O-Help]** is the official Microsoft Advertising help articles, read from the learn.microsoft.com/advertising/msa-help mirror. Those pages carry ms.date 2026-05-30 or 2026-06-18 and updated_at 2026-07-27. help.ads.microsoft.com itself could not be fetched: the host is outside this session's allowed network and its pages render with JavaScript only.
- **[O-Blog]** is the official Microsoft Advertising blog at about.ads.microsoft.com.
- **[3P]** is a third-party source.
- **(snippet)** means the claim comes from WebSearch result text only and the page was not read in full. ppc.land pages returned a bot challenge to curl, so every ppc.land claim is a snippet.

All pages were accessed 2026-11-20.

---

## 1. Microsoft Merchant Center (MMC): stores, feeds, Google import, attributes, item ids, offer statuses, disapprovals, Denmark

### Takeaway
Denmark is a fully supported Shopping and Product ads market (Danish/Denmark). A feed or Google import must be refreshed at least every 30 days, or the offers expire and stop serving. Product ids are max 50 characters, unique per market, and should be treated as **exact-case**: Microsoft's own docs disagree on case sensitivity. Most disapprovals come from crawl and landing-page problems (robots.txt, redirects, price or availability mismatch, images) or from feed-value errors.

### Cited Findings

**Denmark availability**
- Denmark is on the list of markets where Shopping campaigns and Product ads are available (not pilot) — [O-API Product Ads guide, updated 2025-06-26](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- The Google Merchant Center (GMC) import supports "Danish: Denmark". Only offers targeting supported markets are imported. — [O-Help Import from Google Merchant Center](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmc_gmcimportintro)
- The June 2025 Shopify "Microsoft Channel" app expansion named FR, DE, IT, ES, NL, JP, AU, UK, US and CA. Denmark was not named. — [O-Blog June 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june)

**Stores**
- A store must pass domain validation through Bing Webmaster Tools or a UET tag. With UET, the tag must register at least 50 events before the domain can be chosen. — [O-Help Create a store](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createbingmerchantcenterstore)
- A new store is auto-approved, auto-rejected or queued for manual review, which takes up to 5 days. — same source
- Rejection reasons: an unverified domain, adult advertiser, no presence in supported markets, no real privacy policy, a non-SSL checkout, or a duplicate store for the same domain or account. — same source
- You can request only one review per store, under Tools > Merchant Center > Summary > Product issues > Request a review. — same source
- You can create multiple stores, but you may not sell the same products through multiple stores. — same source
- Stores created in a manager account are visible to all of its accounts. — same source
- **Conflict on changing the domain.** The help article says "You cannot change the domain once a store is created" ([O-Help, ms.date 2026-05-30](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createbingmerchantcenterstore)). The April 2026 blog says you can now "change your store name or domain name right in Merchant Center – without the need to reach out to support" ([O-Blog April 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)). The blog is newer.

**Feeds**
- Format: tab-delimited TXT, or ZIP/GZ/GZIP/TAR.GZ/TGZ. XML is accepted only if it is Google-formatted. The file name has no spaces and is at most 50 characters, with a single header row and no HTML. — [O-Help Creating and organizing feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog)
- Upload methods — same source:
  - Manual upload, for files under 4 MB.
  - FTP/SFTP to ftps://feeds.adcenter.microsoft.com, for files under 1 GB (max 3 GB uncompressed). The file name must match the feed's registered name.
  - Automatic download from URL, for files under 1 GB on a public server.
  - Import.
- Automatic download runs once every 24 hours by default. It is **the only method with built-in scheduling** (daily, weekly or monthly). Other methods must be scheduled outside Microsoft Merchant Center. — [O-Help feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog); [O-Help Schedule downloading of feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_bmc_scheduledownloadfeed)
- Timing — [O-Help feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog):
  - A submitted file usually finishes processing within minutes, but can take several hours.
  - Editorial review takes up to 24 hours, plus up to 3 business days for a second review.
- **A feed expires after 30 days, and its products stop publishing.** Microsoft recommends uploading daily. — same source; [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices)
- Newly uploaded or updated feeds can take **up to about 72 hours** to surface as eligible offers. Until then, campaigns can show "Product offers not found". — [O-Help "Product offers not found"](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_error)
- Test feeds: products in a test feed are validated but never served. Switching an existing feed to test deletes all of its previously submitted offers, and they stop serving within hours. — [O-Help feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog)
- Supplemental feeds — same source:
  - They override fields in the primary feed by matching feed label (or country of sale), language and Product ID.
  - Supported fields: Product ID (required), custom label 0–4, title, description, promotion ID, size and color.
  - They cannot add or delete products.
- Multi-country feeds (not yet available to everyone): one feed can target countries "with the same language within your region". The campaign's location targets must align with the feed's countries. — same source

**Import from Google Merchant Center (GMC) and scheduled imports**
- Path: Tools > Merchant Center > [store] > Import > New import, then sign in to Google. The import can run once now, or recur daily, weekly or monthly at a set time and time zone. — [O-Help GMC import](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmc_gmcimportintro)
- "Find and replace string in URL" swaps tracking values, for example google → bing. — same source
- Email notifications can go out on every import, only on issues, or never. — same source
- What gets imported — same source:
  - **All offers, including pending and disapproved ones**, each with the feed label from its GMC feed.
  - Offers go into their own "Google Import" catalog.
  - Local-only (in-store) offers are skipped, and so are destinations other than Shopping.
- **Imported offers expire after 30 days**, so the import must run at least every 30 days. — same source
- Deleting a scheduled import does **not** delete its offers. — same source
- Before deleting a feed that came from a GMC import, delete its scheduled import first. — [O-Help feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog)
- Import errors — [O-Help GMC import](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmc_gmcimportintro):

  | Error | Cause or fix |
  |---|---|
  | No matching products | No offers for the chosen markets, no online offers, or the destination is not Shopping |
  | Import size limit | More than 10 million offers per market |
  | AuthorizationError | The Google token is invalid, for example after a password change. Fix: "Change account" and sign in again |
  | Store domain mismatch | The GMC store and product URLs are on a different domain from the MMC store |

- Importing from a Google account that has multiple GMC stores is "coming soon"; contact Support. — same source
- Importing Google Shopping campaigns requires an MMC store, or a **draft store** that must be completed before the campaigns can serve. Microsoft remembers GMC→MMC store mappings for future imports across the manager account. — [O-Help Import Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_mapmmcstoretogooglemcstore)

**Required attributes and attribute rules**
- Content API: every offer must include availability, channel, condition, contentLanguage, imageLink, link, offerId, price, targetCountry and title. — [O-API Managing your Products](https://learn.microsoft.com/en-us/advertising/shopping-content/manage-products)
- brand, gtin and mpn are also required when the manufacturer assigned them; otherwise set identifierExists=false. Missing identifiers produce a warning, not a rejection. — same source
- An update is a full insert: you must send all fields. — same source
- Google attributes Microsoft uses — [O-Help What feed attributes can I use](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcgoogleattributes):

  | Attribute | Microsoft behaviour |
  |---|---|
  | id, title, description, google_product_category, link, additional_image_link, condition | Used |
  | product_type | Treated as a **single value**: a comma-separated list is one string, so product filters must exact-match the whole string |
  | image_link | Google's 250×250 minimum is accepted |
  | availability | `in stock`, `out of stock` or `preorder`. The English values are accepted in all languages |
  | price, sale_price, sale_price_effective_date | Used. **VAT must be included** for UK, FR, DE and AU; Denmark is not mentioned |
  | brand, gtin, mpn, identifier_exists | Used |
  | Apparel and variant attributes, item_group_id | Used |
  | custom_label_0–4 | Used (the table omits 3, which looks like a typo) |
  | adwords_labels | Multi-value, but filters must match the whole string |
  | tax, shipping, shipping_weight | Ignored, except shipping in Germany |
  | **excluded_destination** | **Not used** |
  | expiration_date | Used |

- Product-group attribute limits — [O-Help Understand and use product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups):

  | Attribute | Limits and notes |
  |---|---|
  | Brand | Max 70 characters and 10 words. Don't use the store name unless you make the product. A new or changed brand stays pending until crawled, which takes up to 3 business days |
  | Condition | new, used or refurbished. Defaults to new |
  | Product type | Max 750 characters, ">" as delimiter |
  | Custom label | Max 200 characters, up to 1,000 unique values per label (5,000 in total) |
  | Category | Up to 5 per offer |

**Item ID rules (case sensitivity)**
- Item ID: max 50 Unicode characters; ASCII letters, digits, _ and - are recommended. It must be unique per market and across all feeds of the store. It is the same as the Merchant Product ID (MPID). — [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups)
- A duplicate MPID in the same account causes a rejection ("The offer is a duplicate based on the merchant product ID field"). — [O-Help Troubleshoot Merchant Center errors](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcerrormessages)
- **Conflict on case sensitivity.** The Products resource says "The offer ID is case insensitive and must be unique within a catalog… max 50 characters". The same page says the full product ID (channel:language:country:offerId) "is case sensitive" ([O-API Products Resource, updated 2026-10-28](https://learn.microsoft.com/en-us/advertising/shopping-content/products-resource)). Manage-products warns: "use the same casing for channel, contentLanguage, targetCountry, and offerId because you can effectively add the same product multiple times if the casing is different" ([O-API Managing your Products](https://learn.microsoft.com/en-us/advertising/shopping-content/manage-products)).
- For product-group conditions, "An attribute's value must exactly match the value specified in the customer's Microsoft Merchant Center catalog file". The Id operand allows up to 1,000 characters and may appear only once per branch. — [O-API ProductCondition, updated 2024-11-13](https://learn.microsoft.com/en-us/advertising/campaign-management-service/productcondition)

**Offer statuses**
- Content API ProductStatuses (closed beta) lists offers whose status is **Disapproved** or **Warning**. — [O-API Get product statuses](https://learn.microsoft.com/en-us/advertising/shopping-content/product-offer-statuses)
  - Each item-level issue carries a code and a `servability` value. Examples: `GtinPlusBrandRequiredWarn` ("Missing one or more identifiers", servability "Unaffected") and `EVRejectedErr` (servability "Disapproved").
  - Offers not returned are implicitly fine (approved).
  - Summary counts can take up to 2 hours to update (snippet).
- In the UI, issues are under Merchant Center > Summary > Product issues > Download report. An offer under review can take up to 3 business days. — [O-Help Troubleshoot errors](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcerrormessages)

**Common disapprovals and fixes** — [O-Help Troubleshoot Merchant Center errors](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcerrormessages)

| Problem | Fix |
|---|---|
| Editorial or policy violation | Fix the offer and re-upload, or request a review |
| Expiration date in the past | Set a valid date |
| Product URL not http/https, or an IP address | Use an http/https URL on the domain |
| URL redirects to another domain | Link directly to the product page |
| URL not a sub-path of the store domain | Use a URL under the store's domain |
| Duplicate MPID | Give the new offer its own ID |
| Price outside 0.00–10,000,000 | Correct the price |
| Adult content | Not allowed |
| condition not new, used or refurbished | Use one of the three values |
| Brand longer than 10 words | Shorten the brand |
| HTTP 4xx/5xx | Check the URL and domain |
| robots.txt blocks Bing, or **adixbot** for images | Allow the crawlers |
| Page requires authentication | Make the page public |
| Image type wrong | Use bmp, gif, exif, jpg, png or tiff |
| Image under 220×220 px or over 3.9 MB | Use an image within the size limits |
| **Price or availability in the feed doesn't match the landing page microdata** | Make the feed and the page agree |
| "Pending according to image crawl" | Usually broken product links; fix them and they will be re-crawled |
| Feed file name doesn't match the registered feed | Rename the file |
| "{X}% offers are untargeted" | Download the diagnostic report |

- "Product offers not found" in Shopping or PMax campaigns — [O-Help "Product offers not found"](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_error). Check in order:
  1. The store is active, not a draft and not rejected.
  2. The feed has "Enable publishing" on, and its location and language match the campaign's country or region of sale.
  3. Products are approved, in stock and not past their expiration.
  4. The campaign and product-group filters.
- Diagnostic report for untargeted offers: generated once per 24 hours, excludes rejected and pending offers, and the campaign↔MMC sync takes up to 12 hours. — [O-Help Diagnostic report](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmc_diagnosticreport)
- Image best practice: no watermarks or promotional text, no placeholders such as "Image not available" (those ads won't display), and keep whitespace to about 10% (above 60% very likely won't display). — [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices)

### Inferences
- An assistant should never "normalise" item-id casing. Copy ids exactly as Merchant Center returns them (case differences can create duplicates), and compare ids case-sensitively when matching sheet or Google ids to MMC.
- Denmark is not in the VAT-included list (UK/FR/DE/AU). Danish B2C price-display law effectively requires incl. VAT anyway, so feed prices should be incl. moms for B2C. This is legal context, not a Microsoft rule; for B2B feeds this is a judgement call.
- A GMC scheduled import that fails silently (for example after a Google password change → AuthorizationError) will make all imported offers expire 30 days after the last good import. Monitoring the import schedule is critical.
- Because excluded_destination is ignored, products a merchant excludes from Shopping in GMC may still be imported and served in Microsoft unless they are filtered out in product groups.

### Gaps
- I found no Microsoft list of status values beyond Disapproved and Warning, and no official list of UI status names ("Approved", "Pending", "Expired") with definitions. The UI wording was not verified.
- I could not confirm whether Microsoft's product-group *matching* on the Id operand is case-insensitive.
- Microsoft has a page on non-appealable rejected offers (hlp_ba_conc_bmcrejectedoffer), but I did not read its details.
- I did not verify whether Denmark can be combined with other countries in a multi-country feed. The rule is same language within the region, and Danish is only Denmark.

---

## 2. Standard Shopping campaigns: product groups, bids, priority, negatives, product ads, Sponsored Products, bid strategies

### Takeaway
Between Standard Shopping campaigns on the same store, **priority (High > Medium > Low) decides regardless of bid**. A product filtered out by a business rule falls through to the next priority. Bid strategies allowed in November 2026:
- Enhanced CPC (the API default)
- Maximize clicks
- Maximize conversion value, with optional target ROAS
- Maximize conversions, with optional target CPA
- Cost per sale

Standalone Target ROAS and Target CPA cannot be chosen for new campaigns since 4 August 2025. Negative keywords work in Shopping. Every ad group needs one product ad, and has exactly one product-group tree.

### Cited Findings

**Campaign setup and settings**
- CampaignType is Shopping, with a ShoppingSetting holding Priority (0, 1 or 2), SalesCountryCode **or** FeedLabel (mutually exclusive; one feed label per campaign, max 20 characters) and StoreId. — [O-API ShoppingSetting, updated 2024-11-13](https://learn.microsoft.com/en-us/advertising/campaign-management-service/shoppingsetting); [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- Priority: "A higher priority value denotes a higher priority… 0, 1, and 2" for standard Shopping, **3 for Smart Shopping, 4 for Performance Max**. The UI default "Low" = 0. — [O-API ShoppingSetting](https://learn.microsoft.com/en-us/advertising/campaign-management-service/shoppingsetting)
- An optional campaign **Product Scope** filter (one per campaign, up to 7 conditions) limits which catalog items the campaign can use. — [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- The **store ID and the country or region of sale cannot be changed after creation**; to change them, delete and recreate the campaign. — [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices)

**Product groups (partitions)**
- Each ad group has exactly one product group (tree) and vice versa. The default ad group starts with a single "All products" group with one bid. — [O-Help Understand and use product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups); [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- The UI allows subdividing **up to 5 levels**. The API allows branches **up to 7 levels deep, with the root at level 0**. — [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups); [O-API ApplyProductPartitionActions, updated 2026-01-22](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- **"Every subdivision must have at least one leaf node that bids on the remainder of the subdivision's conditions"**: an "everything else" node with the same operand as its siblings and a null attribute. — [O-API ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- "Every Unit must have a bid, unless the node is a NegativeAdGroupCriterion": an excluded node. Excluding "everything else" is the documented UI step ("Everything else in 'All products'" → pencil in the Bid column → Exclude). — same source; [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups)
- **The root must be biddable.** The docs describe the root as "The product partition group's root **BiddableAdGroupCriterion** must have its condition Operand set to 'All' and Attribute to null". The root is either a Unit (one bid on everything) or a Subdivision. — [O-API ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- Product groups cannot be paused one by one: "To pause any product partition you must pause the entire ad group". The Status field of partitions is ignored. — same source
- Operand rules — [O-API ProductCondition](https://learn.microsoft.com/en-us/advertising/campaign-management-service/productcondition):

  | Operand | Rule |
  |---|---|
  | All | Root only |
  | Brand, Condition, Channel, ChannelExclusivity, Id, each CustomLabel0–4 | Allowed in many branches but **once per branch** |
  | CategoryL1–5, ProductType1–5 | Must be in ascending order; the parent level may sit higher up, not necessarily the immediate parent |
  | GTIN, MPN | Sponsored Products only |
  | CustomLabel, ProductType | Not applicable to Sponsored Products |

- Bids can be set at product group, ad group or campaign level. Bulk bid changes by percentage, with a min or max cap, are possible at account, campaign or ad group level. — [O-Help Minimum bid](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productads_minbid); [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups)
- Leaf nodes can also carry their own destination URL, tracking template and custom parameters (Bulk fields). — [O-API Bulk Ad Group Product Partition, updated 2025-06-05](https://learn.microsoft.com/en-us/advertising/bulk-service/ad-group-product-partition)
- Bulk doc note on the Bid field: "This field is only applicable for campaigns with Enhanced CPC bidding strategies". It is still **Required on Add** for non-excluded Unit nodes. — same source
- **Minimum bid**: 0.01 in the campaign currency, but bids under 0.05 serve **on the Shopping tab only**. The recommended minimum is 0.05 in EUR, GBP, USD, CAD and AUD markets, and 0.50 INR. **DKK is not listed.** — [O-Help Minimum bid](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productads_minbid)
- Structural changes to product groups show immediately. Performance data is then redistributed across the new structure, and an alert shows while that runs. — [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups)

**Campaign priority, and how overlapping campaigns are chosen**
- "Microsoft Advertising will Display ads from these higher priority campaigns instead of ads from other campaigns, **regardless of bid**… High takes precedence over Medium, which takes precedence over Low." — [O-Help Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview); [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices)
- Exception: "if the product gets filtered out by any business rules, like location targeting, minimum bids, etc., the campaign priority is applied to the non-filtered product". The lower-priority campaign then serves. — same sources
- Priority only matters when "two or more campaigns use the product catalog feed from the same Microsoft Merchant Center store". — [O-API ShoppingSetting](https://learn.microsoft.com/en-us/advertising/campaign-management-service/shoppingsetting)
- With **Maximize clicks**, Microsoft advises: "Shopping campaigns that use maximize clicks should be kept at the highest priority" and "Avoid creating overlapping product offers in multiple Shopping campaigns that use maximize clicks". — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- Performance Max vs Standard Shopping on the same products is covered in section 3. **Since May 2025, the higher Ad Rank serves**; before that, PMax won automatically.

**Negative keywords, product ads, reporting**
- "Although Shopping campaigns don't use keywords to trigger the Product ads, you can still use negative keywords." — [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices)
- Account-level negative keyword list: "applied to Search, Shopping, and Performance Max campaigns", one list per account with up to 1,000 negatives. Keyword-level negatives are not supported. — [O-Help About negative keywords](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- The ProductNegativeKeywordConflictReport shows negatives that block products in Shopping campaigns. — [O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)
- "You must add at least one Product Ad" per ad group. The product ad is not used as ad copy; ads are built from the catalog. Promotional text is retired; use Merchant Promotions instead. — [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads); [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices)
- Reporting service statistics and the partition tree lag the UI by up to an hour. Use campaign or ad group scope to get Shopping-only data. — [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)

**Sponsored Products (Shopping campaigns for brands)**
- Available **only in the United States and United Kingdom**, as an open beta for pilot customers (pilot 684). — [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- Setup: subtype ShoppingSponsoredProductAd, bid strategy ManualCpc (CostPerSale for promotions for brands), and up to 10 excluded stores. — same source
- It is **not relevant for a Danish advertiser.**

**Bid strategies allowed in Shopping (Nov 2026)**
- Help — [O-Help Let Microsoft Advertising manage your bids, ms.date 2026-06-18](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy):
  - Enhanced CPC: "Shopping campaigns, where available".
  - Maximize clicks: "available only for Search ad and Microsoft Shopping campaigns".
  - Maximize conversion value: "Shopping search campaigns, where available", with optional Target ROAS.
  - Cost per sale (CPS) for Shopping, which needs details:
    - You pay only for a sale within 24 hours of a click.
    - It takes up to 72 hours to start, showing "In review" until then.
    - Sales appear in a Sales column.
    - It can exceed the normal 200% daily cap but honours the monthly budget.
    - "CPS is supported… in all available markets".
- **4 August 2025:** standalone Target CPA and Target ROAS can no longer be set up for new campaigns, or for campaigns not already using them. Existing campaigns and portfolios are unaffected. In the API, Editor and bulk, setting TargetCpa or TargetRoas is auto-converted to MaxConversions or MaxConversionValue with the target. "If you want to set a target ROAS value for your Performance Max, Search, or Shopping campaigns… use Maximize conversion value… and optionally enter a target ROAS", and the same applies to target CPA with Maximize conversions for Shopping. — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [3P Search Engine Roundtable, July 2025](https://www.seroundtable.com/microsoft-ads-target-cpa-and-target-roas-retire-39688.html)
- **Stale official table.** The API guide (updated 2025-06-26) lists MaxConversionValue only for "Shopping (smart shopping), Performance Max", and TargetRoas for Search and Shopping. That is contradicted by the help page above and by the 2024 expansion of Maximize conversion value to standard Search and Shopping (snippets: [3P Search Engine Land](https://searchengineland.com/microsoft-expands-maximum-conversion-calue-shopping-search-campaigns-438955), [3P SER](https://www.seroundtable.com/microsoft-ads-max-conversion-value-search-37157.html)). The same API table says the default for most Shopping campaigns via the API is EnhancedCpc. — [O-API Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
- **Manual CPC** cannot be used for Shopping. "If you attempt to set manual CPC for any other campaign type, the request will be ignored without error and the bid strategy will be set to enhanced CPC". Manual CPC remains only for audience display, audience video and lodging; audience native lost it in May 2024. — [O-API Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
- **Max CPC breaking change.** "You can no longer add a Max CPC value to non-portfolio campaigns" using MaxClicks, MaxConversions, MaxConversionValue, TargetCpa or TargetRoas; the error is MaxCpcCannotBeAdded (611274). Existing values can be edited or removed, and portfolio strategies still support Max CPC. The start date is not given; it is listed under "Breaking changes (recent and upcoming)". This contrasts with July 2025, when MaxCpc was *added* to MaxConversionValueBiddingScheme. — [O-API Release notes, updated 2026-11-15](https://learn.microsoft.com/en-us/advertising/guides/release-notes)
- Conversion thresholds: "If your campaign falls below **30 conversions** over any 30-day period, Maximize Conversions [and Target CPA / Target ROAS] will stop optimizing your bids". Target ROAS also needs non-zero revenue in the last 30 days. — [O-API Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
- The help page recommends "at least 30 conversions before evaluating performance". Target ROAS cannot be used with shared budgets except through a portfolio. — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)

### Inferences
- Priority mapping: "Low" = 0 is documented. Medium = 1 and High = 2 follow from "higher value = higher priority", but no page states the mapping explicitly.
- With **equal priority**, Microsoft says nothing explicit. The standard ad auction (bid × quality, i.e. ad rank) presumably decides which campaign's product serves.
- A query-sculpting setup (High-priority catch-all with low bids, Low-priority "hero" campaign with high bids, separated by negatives) depends on the "regardless of bid" rule. Under Maximize clicks Microsoft explicitly advises against overlapping products.
- An "exclude 'everything else'" Shopping ad group whose only units are item ids is a valid tree: root subdivision → item-id units → everything-else (Id, null) excluded. With no item-id units under the root subdivision, the only leaf would be the excluded everything-else, and the group serves nothing. The UI equivalent is "select every item you'd like to add" plus exclude everything else.
- Under Maximize clicks, Maximize conversions or Maximize conversion value, product-group bids are ignored. The API may still demand a bid value on biddable units (the Bulk "Bid" field is required on Add for non-excluded units), so tools should send a placeholder bid rather than fail.
- For a DKK account, the 0.01 / 0.05 minimums are presumably in DKK as account currency. That is not confirmed: DKK is absent from the table.

### Gaps
- The DKK minimum and recommended minimum bid for Shopping are not documented.
- No official statement covers same-priority overlaps.
- The help bid-strategy page's "Maximize conversions is available for" list shows only Audience and Search, yet the same page says target CPA via Maximize conversions works for "Audience, Performance Max, and Shopping". Whether Maximize conversions is selectable for standard Shopping in the UI in November 2026 is not verified.
- Whether CPS is actually available in Denmark is not verified ("all available markets" is ambiguous).
- I found no official document on whether target ROAS for Shopping is entered as a percent or a ratio in the UI and API.
- The start date of the Max CPC restriction is not given.

---

## 3. Performance Max in Microsoft Advertising

### Takeaway
PMax is available in all Microsoft Advertising markets, Denmark included.
- **Bidding and budget:** it uses only Maximize conversion value (optional tROAS) or Maximize conversions (optional tCPA). Without a conversion goal, Microsoft switches it to Maximize clicks automatically. It cannot use a shared budget.
- **Auction:** exact-match Search keywords beat PMax. **Since May 2025, PMax and Standard Shopping on the same products compete on Ad Rank**; before that, PMax always won.
- **Signals and controls:** search themes go up to 50 per asset group, and brand exclusions are still not universal.
- **Reporting:** this improved strongly in 2026 (search terms, landing pages, publisher URLs). Auction insights for PMax were announced as "coming soon".
- **Learning and budget:** learning takes 2–4 weeks, or 2–3 conversion cycles. Microsoft recommends up to 2–3× the budget of the campaigns PMax replaces.

### Cited Findings

**Availability**
- "This feature is available in all Microsoft Advertising markets." — [O-Help About Performance Max (ms.date 2026-05-30)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax); [O-Help Create a PMax campaign](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)
- PMax has been "globally available to all advertisers since earlier this year (2024)". — [O-Blog July 2024](https://about.ads.microsoft.com/en/blog/post/july-2024/how-pmax-is-working-for-advertisers-and-new-updates)
- The global launch was in March 2024 (snippet). — [3P Search Engine Land](https://searchengineland.com/microsoft-advertising-performance-max-globally-438111)
- The API guide still says "open beta worldwide" although it was updated 2026-09-15; that wording is stale. — [O-API Performance Max guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max)

**Structure and limits**
- Up to 300 PMax campaigns per account and up to 100 asset groups per campaign. — [O-API PMax guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max); [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)
- **Shared budget is not supported** with PMax. — [O-API PMax guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max)
- Retail PMax: the ShoppingSetting must have **Priority 4** and a StoreId. — same source
  - Text and image assets are optional for asset groups in a store-linked campaign.
  - Product conditions exist only at asset-group level (listing groups); **campaign ProductScope is not supported.**
- In the UI, the store is chosen at creation. **"once you select a store for this campaign, you cannot change it"**. A PMax created without a store needs a new campaign to advertise products later. You can filter by feed label or country of sale. — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)
- The Final URL domain must match the store's URL. Spaces, UTM tags, tracking templates and < > { } are not allowed in the Final URL. — same source
- Since December 2025 (blog January 2026), asset groups support their own tracking templates, final URL suffix and custom parameters. — [O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes); [O-Blog January 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026)
- Asset specs — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax):

  | Asset | Limit |
  |---|---|
  | Images | Up to 20, including at least one landscape 1200×628 (min 703×368) |
  | Logos | Up to 5, at least 128×128 |
  | Short headlines | Up to 15, 30 characters each |
  | Long headlines | Up to 5, 90 characters each |
  | Descriptions | Up to 5, 90 characters each |
  | Term exclusions | Up to 25, for AI-generated text |

- Campaign criteria — [O-API PMax guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max):
  - Exclusions: age, gender, audience, device and webpage.
  - Targets: location (also excludable), location intent, radius and day-time, with no bid adjustments.
  - Device targeting is in pilot.
  - Campaign-level negative age and gender arrived in Bulk in May 2026 ([O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)).
- Website exclusions for PMax work only at account level. Microsoft first-party sites (msn.com, outlook.com, bing.com and others) cannot be excluded. — [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)

**Listing groups**
- Up to 20,000 listing groups per asset group. The choice is "All products" or "Filtered products". — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax); [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- To exclude item ids in PMax: Asset groups → edit, toggle off the products, "You may need to subdivide your products down to the item ID level". — [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups)
- Asset group listing group fields gained ListingGroupPath in July 2025. — [O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)

**Audience signals and search themes**
- Audience signals include interests (in-market), first-party lists (remarketing, dynamic remarketing, customer match), age, gender and LinkedIn company, industry and job function (LinkedIn is not available to everyone). — [O-Help About audience signals](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_audiencesignals)
  - "Your ads may surface to audiences beyond those associated with your audience signal."
  - Each asset group takes one audience group ([O-API PMax guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max)).
- Microsoft says remarketing, custom audiences and customer match "provide strong baseline signals". — [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- Search themes — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax); [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices):
  - Set at asset-group level, **up to 50 per asset group**, each max 80 characters.
  - They are signals that "don't limit ad reach" and are never shown to users.
  - Microsoft recommends refreshing them every few months and using them for event asset groups such as Black Friday.
- The limit doubled to 50 in January 2026; it was 25. — [O-Blog January 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026)
- Search themes and search term insights for PMax were first released in July 2024. — [O-Blog July 2024](https://about.ads.microsoft.com/en/blog/post/july-2024/how-pmax-is-working-for-advertisers-and-new-updates)

**Brand exclusions**
- Brand exclusions entered pilot "for all markets" in July 2024. — [O-Blog July 2024](https://about.ads.microsoft.com/en/blog/post/july-2024/how-pmax-is-working-for-advertisers-and-new-updates)
- As of 2026 the help still says "Not everyone can use brand exclusions yet". — [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- May 2026: Microsoft is "refining brand exclusions so you can choose to apply them to text ads only, while still showing up for these brand searches on product ads" (snippet). — [O-Blog May 2026 (search result)](https://about.ads.microsoft.com/en/blog/post/may-2026/providing-more-transparency-for-your-performance-max-campaigns)
  - Consistent with this, September 2026 API added BrandExclusionSetting (ProductAdsOptOut) ([O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)).
  - A third-party analysis says the exclusions can be "leaky" (snippet, source not identified).

**URL expansion and page feeds**
- PerformanceMaxSetting.FinalUrlExpansionOptOut determines "whether Microsoft will use the entire domain and dynamically generate assets to match landing page content". — [O-API PMax guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max); [O-API PerformanceMaxSetting](https://learn.microsoft.com/en-us/advertising/campaign-management-service/performancemaxsetting)
- The same setting also holds AutoGeneratedText/ImageOptOut, CostPerSaleOptOut and PageFeedIds. — [O-API PerformanceMaxSetting](https://learn.microsoft.com/en-us/advertising/campaign-management-service/performancemaxsetting)
- URL rules ("contains") and page-feed custom labels steer which pages serve. With a page feed and no URL rules, only page-feed URLs that contain the asset group's Final URL are used. — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)
  - Microsoft's own example uses a .dk domain: `contoso.co.dk/teahouse` vs `/tea/herbal` → no match, no ads.

**Negative keywords and exclusions in PMax**
- Account-level negative keyword lists apply to PMax. — [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax); [O-Help negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- "Context exclusions" in PMax creation combine excluded content terms and negative keywords, with phrase match as the default negative type. They are not available to everyone. — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)
- The API added AssetGroupNegativeKeywords to bulk download (August 2026), and AssetGroupId support in GetKeywordsByIds, UpdateKeywords and DeleteKeywords (September 2026). — [O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)

**How PMax shares traffic with Search and Shopping**
- "Ad delivery for Search campaigns with **exact match keywords is prioritized over Performance Max** campaigns. For all other campaign types, the campaign with the highest ad rank will serve." — [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- The same FAQ also says, more broadly, "If a search query matches a search keyword associated with your account, then your Search campaign ads will take priority". That is internally inconsistent with the exact-only statement; ppc.land reported an exact-match-wins change (snippet, [3P ppc.land](https://ppc.land/microsoft-advertising-now-gives-exact-match-total-control-over-ad-auctions/)).
- **PMax vs Standard Shopping (change dated May 2025):** "instead of Performance Max automatically being prioritized over Standard Shopping, normal auction dynamics will now apply and the campaign with the highest Ad Rank will serve". This applies to campaigns "in the same account targeting the same products". Microsoft recommends adjusting budgets and targets to control the split. — [O-Blog June 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june)
- *Before May 2025*, PMax (priority 4) automatically beat Standard Shopping, and Microsoft's PMax product page still said so (snippet). The API still requires Priority = 4 for PMax. — [O-API ShoppingSetting](https://learn.microsoft.com/en-us/advertising/campaign-management-service/shoppingsetting)

**Reporting (state in November 2026)**
- Search terms insights are auto-generated search categories with clicks, CTR, conversions, conversion value and search volume. They are "only available for Performance Max campaigns" and take up to 3 days to appear. Path: Reporting > Performance > Search terms insights. — [O-Help Search terms insights](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchtermsinsights)
- April 2026: landing page (Final URL) reporting for PMax went live, and the search term column became the default in search term insights. — [O-Blog April 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)
- May 2026:
  - A Website URL (publisher) report with conversions, clicks and spend is "now available".
  - Search term reporting for PMax was "rolling out in May".
  - **Auction insights for PMax: "coming soon"** (not confirmed live).
  - Custom columns now support all conversion metrics.
  - Source: [O-Blog May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/providing-more-transparency-for-your-performance-max-campaigns)
- January 2026: share-of-voice metrics for PMax (impression share, click share, lost to budget and lost to rank). They cover search and shopping only, not audience placements, with data from 10 November 2025. — [O-Blog January 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026)
- The asset report covers PMax at asset-group level. Campaign- and account-level support is "in a future release". — [O-Help About asset reporting](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_assetreport)
- The API added AssetGroupId and AdId to AssetPerformanceReport (September 2026), and CostPerConversion to AssetGroupPerformanceReport (December 2025). — [O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)
- Microsoft's own guidance — [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices):
  - Evaluate at campaign level first.
  - Don't exclude placements or queries on low volume, no clicks or short windows.
  - Optimise on conversions, value, CPA and ROAS, not on impressions, clicks or CPC.

**Conversion requirements, bidding, learning period, budget**
- UET plus a conversion goal is required; variable-revenue tracking is needed for Maximize conversion value. Offline conversion goals can replace UET. — [O-API PMax guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max)
- With no conversion goal at creation or import, the bid strategy is converted to **Maximize clicks**, then auto-switches to the selected conversion strategy once enough data exists. — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax); [O-Help What gets imported from Google Ads](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_importwhatinfo)
- Target guidance — [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices):
  - Add a target ROAS only after **≥30 conversions in the last 30 days**.
  - Start with a less restrictive target.
  - Wait two weeks after each target change.
- First impressions come within 3 days for product-ad PMax and 4 days otherwise. — same source
  - The **learning period** after optimisations or new assets is **2–4 weeks or 2–3 conversion cycles**.
  - Editorial review of asset groups takes up to 48 hours.
- Budget: "give Performance Max campaigns up to two to three times the budget of your historical standalone campaigns". — same source; [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)
- New customer acquisition: open beta in January 2026 for purchase goals. It offers "increase bids for new customers" or "only new customers", with a recommended new-customer value of at least 30% of average revenue. — [O-Blog January 2026](https://about.ads.microsoft.com/en/blog/post/january-2026/performance-max-updates-and-other-product-news-for-january-2026)
  - It was "generally available since the start of the year", and Google import of NCA goals came in April 2026.
  - "Unknown" customers are treated as existing customers. — [O-Blog April 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)

**Migration from Smart Shopping**
- "Starting in August, Smart shopping campaigns will deprecate and automatically upgrade to Performance Max campaigns." Creating new ones fails with SmartShoppingCampaignCreationNotSupported. Smart Shopping used only MaxConversionValue and supported no negatives or audience targets. — [O-API Smart Shopping guide, updated 2025-06-26](https://learn.microsoft.com/en-us/advertising/guides/smart-shopping-campaigns)
- Remaining Smart Shopping campaigns can be upgraded manually: Campaigns → select → Edit → Upgrade to Performance Max. Expect about 2 weeks of learning; the old performance data is retained for reporting. — [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)
- Smart Shopping campaigns upgraded to PMax with autogenerated assets now serve those assets in Search and Product ad placements. This was a bug fix. — [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)

**Microsoft's own performance claims (vendor data, treat with care)**

| Claim | Basis | Source |
|---|---|---|
| +39% user conversion rate for PMax vs Standard Shopping only | US, Feb–Apr 2025 | [O-Blog June 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june) |
| +8% average incremental conversions | Global, Sep 2024–Sep 2025 | [O-Blog May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/providing-more-transparency-for-your-performance-max-campaigns) |
| −32% CPA and about 3× ROAS when PMax is combined with Search | — | [O-Blog July 2024](https://about.ads.microsoft.com/en/blog/post/july-2024/how-pmax-is-working-for-advertisers-and-new-updates) |

### Inferences
- In November 2026, a Standard Shopping campaign that overlaps a PMax campaign on the same products no longer loses automatically. The split is driven by each campaign's Ad Rank, so budgets and targets set the balance. Any rule stating "PMax always takes Shopping traffic" is outdated (pre-May 2025).
- For a Danish advertiser, brand exclusions and audience-signal LinkedIn features may not be enabled on the account. The assistant should check availability before promising them.
- Changing the store of a PMax campaign is impossible, as it is for Shopping. A wrong store means a new campaign.

### Gaps
- The year of the automatic Smart Shopping → PMax upgrade is not stated in the API doc ("Starting in August"). I did not find the primary announcement; it was likely August 2024, but that is unverified.
- I found no official confirmation that PMax auction insights are live as of November 2026.
- I did not verify whether asset-group-level negative keywords are a UI feature or only an API/Bulk surface.
- I did not verify that "SearchInsightPerformanceReport" is the reporting-API name for PMax search insights.
- ppc.land articles (exact match, 50 search themes, supplemental feeds) could not be read: the site served a bot challenge.

---

## 4. Product and listing group behaviour in the API (ApplyProductPartitionActions / ApplyAssetGroupListingGroupActions)

### Takeaway
Both operations are all-or-nothing, one ad group or asset group per call, and must leave a complete tree.
- **The root:** must be `All`/null.
- **Every subdivision:** needs an "everything else" (null-attribute) leaf.
- **Leaves:** must have a bid unless they are negative (Shopping).
- **Changing a condition or the excluded flag:** means delete and re-add, which gives a new id.

### Cited Findings
- Root: "The product partition group's root BiddableAdGroupCriterion must have its condition Operand set to 'All' and Attribute to null". Use PartitionType Unit to bid on all products, or Subdivision with ParentCriterionId null and a negative temporary Id. — [O-API ApplyProductPartitionActions, updated 2026-01-22](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- Limits: up to 5,000 actions per call and 20,000 nodes per tree; 7 levels below the root (root = level 0). — same source
- "Each of the AdGroupCriterionAction objects must have the same AdGroupId, otherwise the call will fail." — same source
- "If any action fails, all remaining actions that might have otherwise succeeded will also fail." — same source
  - The response then returns all AdGroupCriterionIds as null, with a generic error for the actions that would otherwise have succeeded.
- "All actions in one call must result in a complete tree structure." More than 5,000 actions need multiple calls, using the parent ids returned by the first call. — same source
- "Every path from the root node to the end of a branch must terminate with a leaf node (Unit). Every Unit must have a bid, unless the node is a NegativeAdGroupCriterion." — same source
- "Every subdivision must have at least one leaf node that bids on the remainder of the subdivision's conditions, i.e. use the same operand as its sibling unit(s) and set its Attribute to null." — same source
- To change Condition or Attribute, or to switch between Biddable and Negative, you must delete the node and add a new one, which gets a **new id**. — same source
- Other rules — same source:
  - Children must come after their parent.
  - Negative temporary ids are valid only within the call.
  - Deleting a parent deletes all of its descendants.
  - No duplicate conditions in a branch.
  - CriterionBid and DestinationUrl are ignored on Subdivisions.
  - Status is ignored; to pause, pause the ad group.
  - EditorialStatus is meaningless for partitions.
  - Delete needs only Id and AdGroupId.
- Read the tree back with GetAdGroupCriterionsByIds, setting AdGroupCriterionIds to null (CriterionType ProductPartition). The node with a null ParentCriterionId is the root. — [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads); [O-API ProductPartition](https://learn.microsoft.com/en-us/advertising/campaign-management-service/productpartition)
- Conflicts with campaign ProductScope are **not** validated. Duplicates within the ad-group tree fail, but the operation doesn't check against the campaign scope. — [O-API ProductPartition](https://learn.microsoft.com/en-us/advertising/campaign-management-service/productpartition)
- Bulk: parents must precede children for structural changes. A bid-only update needs just Id, Parent Id and Bid. Download order is not guaranteed. "Is Excluded" TRUE marks a negative node. — [O-API Bulk Ad Group Product Partition](https://learn.microsoft.com/en-us/advertising/bulk-service/ad-group-product-partition)
- PMax ApplyAssetGroupListingGroupActions follows the same rules — [O-API ApplyAssetGroupListingGroupActions, updated 2026-01-22](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions):
  - Root All/null, 7 levels, 5,000 actions per call, 20,000 nodes.
  - Same AssetGroupId in every action, all-or-nothing, complete tree.
  - An everything-else leaf in every subdivision.
  - Delete and re-add to change a condition or the excluded flag.
  - Pause via UpdateAssetGroups.
  - There are **no bids**: leaves are included or excluded (IsExcluded).
- Bulk Asset Group Listing Group: "Is Excluded" is Add: Required and Update: Read-only. — [O-API Bulk Asset Group Listing Group](https://learn.microsoft.com/en-us/advertising/bulk-service/asset-group-listing-group)

### Inferences
- "Root must be biddable": for Shopping the doc wording ties the root to BiddableAdGroupCriterion. Excluding "All products" (the root) is therefore most likely rejected. To stop all products in an ad group, pause the ad group, or subdivide and exclude every leaf including everything-else.
- For PMax listing groups the docs do not say whether the root can be IsExcluded=true.
- Any tool that "changes" an item from bid to excluded must send a delete plus an add in the same call, keeping the tree complete. History reported per node id will start over for the new node.
- Because of all-or-nothing, one bad item id (for example a duplicate in a branch) fails the whole ad group's change set. Validate item ids against Merchant Center before calling.

### Gaps
- I found no explicit statement on whether the Shopping root may be a NegativeAdGroupCriterion, or whether the PMax root may be excluded. This needs an API test.
- I found no documented error codes for the "missing everything-else" and "duplicate condition" cases in this research.

---

## 5. Best practices and studies on Shopping and PMax structure (item id vs category, bids per product, seasonal or Black Friday), and how priority decides which campaign serves

### Takeaway
Microsoft's own guidance:
- Split "All products" into groups of closely related products.
- Use custom labels (best seller, seasonal, high margin).
- Bid higher on proven sellers, and don't underbid relative to text-ad keyword bids.
- Refresh the feed daily.
- Use campaign priority for control.
- Use search themes and event asset groups for Black Friday.
- Use seasonality adjustments (≤14 days) and data exclusions (≤14 days, ideally ≤7) rather than moving targets.

I found **no independent, Microsoft-specific study** (Optmyzr, Adalysis, JumpFly, PPC Hero, WordStream) that compares item-id-level against category-level structures. The evidence base for "item id vs category" on Microsoft is Microsoft guidance plus agency opinion.

### Cited Findings
- Structure and testing — [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups); [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices):
  - "We recommend that you break down the single product group into smaller product groups so that each product group contains closely related products."
  - "Test… the granularity of product targets. For example, you might find that product targets based on specific products or specific business goals perform better than a target that includes a wide group of products."
- Bidding — [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices):
  - "Don't underbid": set initial product bids at or above the bids for the closest-matching keywords, because product ads compete with text ads.
  - "Reward high-performing products with higher bids."
  - Device bid adjustments run from −100% to +100%.
- Budget and feed — same source:
  - "Some advertisers have found that allocating 30% of their total budget to Shopping campaigns is a good starting point." This is anecdotal.
  - Fill as many attributes as possible, including custom labels, Bing category and merchant category.
  - Don't use "Miscellaneous" as a category.
- Custom labels can mark "best seller, seasonal item, special offer or high-margin item" for product groups. — [O-Help Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview)
- PMax asset groups can be organised "by market, promotion, and/or the audiences you want to target". Search themes are "a powerful tool for event-specific asset groups and campaigns (i.e., Black Friday and New Year's sales)". — [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- Seasonality adjustments: the date range must be 14 days or less, scoped by campaign type or specific campaigns. — [O-Help Seasonality adjustments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments)
  - For portfolios, use one consistent adjustment across campaigns unless their seasonality differs (brand vs non-brand, distinct categories). — [O-Blog April 2026](https://about.ads.microsoft.com/en/blog/post/april-2026/performance-max-updates-and-other-product-news-for-april-2026)
- Data exclusions — [O-Help Data exclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions):
  - Up to 14 days; Microsoft recommends 7 days or less.
  - Use them only for auto-bid campaigns with stable performance whose strategy has been active for at least 30 days.
- Priority mechanics for choosing which campaign serves an overlapping product:
  - Standard Shopping vs Standard Shopping: priority wins regardless of bid, with the filtered-product exception ([O-Help Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview)).
  - PMax vs Standard Shopping: Ad Rank, since May 2025 ([O-Blog June 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june)).
  - Exact-match Search vs PMax: Search wins ([O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)).
- Holiday advice (snippet only): start early because CPCs rise toward Black Friday and Cyber Monday; split into granular brand, category and SKU groups; "Set campaign priorities thoughtfully when layering new structures". — [3P Adzooma](https://adzooma.com/blog/how-to-get-microsoft-campaigns-holiday-ready/)
- For Google Ads, Google made the same change in October 2024: PMax no longer takes priority over Standard Shopping in the same account (snippet). This is context only. — [3P Search Engine Roundtable](https://www.seroundtable.com/google-ads-pmax-priority-standard-shopping-38265.html)

### Inferences
- A Black Friday Standard Shopping campaign at **High** priority carrying the campaign items takes those items' traffic from any Low or Medium Shopping campaign on the same store, whatever the bids. It does *not* automatically beat an overlapping PMax; there the Ad Rank decides. To avoid cannibalisation and muddy data, exclude the campaign items from the PMax listing groups, or accept the Ad Rank competition.
- Item-id-level product groups give per-product bids and control, which suits Enhanced CPC. Under Maximize conversion value, item-level bids are ignored, so splitting by item id mainly serves reporting or exclusion; the target and budget are the levers.
- Product-group performance history is per node id. Restructuring (delete and re-add) resets node-level history, so restructure before peak season, not during it.

### Gaps
- I found no Microsoft-specific study by Optmyzr, Adalysis, JumpFly, PPC Hero or WordStream on Shopping structure (item id vs category, SKU-level bids) or on PMax vs Standard Shopping on Microsoft. The general Google-based studies were not researched here.
- I found no Microsoft-published Black Friday playbook for 2026 Shopping or PMax.

---

## 6. Against the current rules (src/ai/playbooks/microsoftAds.ts and the Shopping/product-group parts of src/ai/prompt.ts)

### Takeaway
Most product-group rules are consistent with Microsoft's API:
- one call per ad group
- exclude "everything else"
- a product ad per group
- item ids must match the catalog
- priority High → `priority high`
- Maximize conversion value with target ROAS for Shopping

Five rules are contradicted or outdated:
1. "every Shopping campaign uses bids"
2. "Microsoft stops optimising below 15 conversions in 30 days" (Microsoft says 30)
3. Excluding "Alle produkter" (the root) — the docs say the Shopping root must be biddable
4. The implicit "higher priority takes the traffic", which no longer holds against PMax since May 2025
5. "Manual CPC only for Audience campaigns", which is imprecise

Several Shopping and Merchant Center rules are missing.

### Cited Findings

**Confirmed**
- **prompt.ts:** "product groups … → edit_product_groups – one call per ad group" (line ~192).
  - Confirmed: the API requires every action in a call to share one AdGroupId, applies them all-or-nothing, and needs a complete tree. — [O-API ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- **prompt.ts:** "Shopping groups always exclude 'alt andet' … without items the group shows nothing until items are added" (line ~187), plus "Shopping groups with their MATCHED item ids in items ('alt andet' excluded, a product ad each)" (line ~146).
  - Confirmed: every subdivision needs an everything-else leaf, which may be negative. Excluding it is the documented UI step. At least one product ad per ad group is required. — [O-API ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions); [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups); [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- **prompt.ts:** "check_item_ids with ALL the sheet's item ids – before any Shopping ad group"; "Item ids not in the catalogue are listed, never guessed"; "Item ID → Microsofts produkt-id (Merchant Center)".
  - Confirmed: the attribute must exactly match the catalog value. Item ID = MPID, max 50 characters, unique per market. One bad node fails the whole call. — [O-API ProductCondition](https://learn.microsoft.com/en-us/advertising/campaign-management-service/productcondition); [O-Help product groups](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_aboutproductgroups)
- **prompt.ts:** "Mål-ROAS 300 % → Maksimér konverteringsværdi med mål-ROAS 3,0 (also for Shopping)".
  - Confirmed: since 4 August 2025, target ROAS is set as an optional goal on Maximize conversion value, including for Shopping. — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy); [3P SER](https://www.seroundtable.com/microsoft-ads-target-cpa-and-target-roas-retire-39688.html)
  - Not verified: the 300 % → 3.0 unit conversion (see section 2 Gaps).
- **prompt.ts:** "Standard Shopping 'høj prioritet' → create_campaign priority high".
  - Confirmed as a concept: Shopping has Low, Medium and High, which are 0/1/2 in the API. The High = 2 mapping is inferred. — [O-API ShoppingSetting](https://learn.microsoft.com/en-us/advertising/campaign-management-service/shoppingsetting)
- **prompt.ts:** "a higher-priority Shopping campaign takes the item's traffic" (line ~154).
  - Confirmed for Standard Shopping vs Standard Shopping on the same store, "regardless of bid". — [O-Help Benefits of Shopping campaigns](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_overview)
  - **Incomplete:** add (a) the exception that a product filtered out by location targeting or minimum bid falls through to the lower priority, and (b) that **PMax vs Standard Shopping is decided by Ad Rank since May 2025, not by priority**. — [O-Blog June 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june)
- **prompt.ts:** "Paused ad groups … a bid or product group change in a paused ad group does nothing until it is activated".
  - Consistent: product partitions have no status of their own and can only be paused through the ad group. — [O-API ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- **prompt.ts:** "Under automated bidding (Maximize clicks/conversions/conversion value, Target CPA/ROAS…) keyword and ad group bids are ignored".
  - Consistent; Enhanced CPC uses the bids. — [O-API Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
- **prompt.ts:** "Since August 2025 campaigns can't be moved to standalone Target CPA/Target ROAS – use the Maximize strategies with a target instead".
  - Confirmed, effective 4 August 2025. Existing campaigns and portfolios are unaffected, and API updates are auto-converted. — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- **microsoftAds.ts workflow:** "Læringsfase: … Performance Max 2–4 uger".
  - Confirmed: 2–4 weeks or 2–3 conversion cycles; first impressions within 3 days (product ads) or 4 days. — [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- **microsoftAds.ts workflow:** "Automatiske strategier … kræver mindst 30 konverteringer på 30 dage".
  - Consistent with Microsoft: they stop optimising below 30 conversions per 30 days, and the PMax tROAS advice is to add it after ≥30 conversions in 30 days. — [O-API Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies); [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- **microsoftAds.ts guardrails:** "Brug sæsonjustering (≤14 dage) eller dataudelukkelse (≤7 dage)".
  - Essentially confirmed. Precise version: data exclusions allow up to 14 days, with 7 days or less recommended, and the strategy must have been active for at least 30 days. — [O-Help Data exclusions](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_dataexclusions); [O-Help Seasonality adjustments](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_seasonalityadjustments)
- **microsoftAds.ts guardrails:** "Mål-CPA/-ROAS: ±10–15 % pr. skridt, mindst 2 uger mellem ændringer".
  - Consistent with Microsoft's PMax advice: wait two weeks after each target change and start less restrictive. — [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- **microsoftAds.ts navigation:** "Performance Max: Rapportering → Ydeevne → Søgetermindsigt" and "Performance Max: Opret → mål → Performance Max".
  - Confirmed: Reporting > Performance > Search terms insights, and Create → Drive conversions / Sell products → Performance Max. — [O-Help Search terms insights](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutsearchtermsinsights); [O-Help About audience signals](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_audiencesignals)

**Contradicted**
- **prompt.ts** (line ~187): "When the campaign uses bids (Enhanced/Manual CPC, **and every Shopping campaign**) … ask for the missing bids first".
  - **Contradicted.** Shopping campaigns can run Maximize clicks, Maximize conversion value (±tROAS) or Maximize conversions (±tCPA), where product-group bids are ignored. — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
  - It also conflicts with prompt.ts line ~146: "Under Maksimér konverteringsværdi no bid is needed".
  - Nuance: the API and Bulk still require a bid value on biddable Unit nodes when they are added, documented as "only applicable for campaigns with Enhanced CPC" ([O-API Bulk Ad Group Product Partition](https://learn.microsoft.com/en-us/advertising/bulk-service/ad-group-product-partition)). The tool may need a placeholder, but the user shouldn't be asked for a bid under automated bidding.
- **prompt.ts** (line ~192): "excluding 'Alle produkter' / 'alt andet' (everythingElse: exclude)".
  - **Partly contradicted.** Excluding "alt andet" is fine. Excluding "Alle produkter" (the root) conflicts with the docs' definition of the root as a *BiddableAdGroupCriterion*. To stop everything, pause the ad group or asset group, or subdivide and exclude all leaves. — [O-API ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
  - For PMax listing groups this is not documented either way; test it.
- **prompt.ts** (line ~210): "Microsoft stops optimising below **15** conversions in 30 days; the playbook wants at least 30".
  - **Contradicted.** Microsoft's API guide says Maximize conversions, Target CPA and Target ROAS stop optimising below **30** conversions in any 30-day period, and Target ROAS also needs non-zero revenue. — [O-API Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
  - I found no source for 15.
- **prompt.ts** (line ~210): "Manual CPC only for Audience campaigns (Microsoft silently turns it into Enhanced CPC elsewhere)".
  - **Imprecise.** Since May 2024, Manual CPC remains only for audience *display and video* (not native) and for lodging/hotel. Elsewhere, including Shopping, it is silently set to Enhanced CPC. — [O-API Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
  - The Sponsored Products exception (ManualCpc) applies only in the US and UK.
- **prompt.ts** (line ~210) bid-strategy list: Enhanced CPC, Maximize clicks, Maximize conversions (opt tCPA), Maximize conversion value (opt tROAS).
  - **Missing for Shopping:** Cost per sale (CPS). — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
  - **Missing:** Max CPC can no longer be added to non-portfolio campaigns using MaxClicks, MaxConversions or MaxConversionValue (error 611274); existing caps can only be edited or removed. — [O-API Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)
  - **Impact:** the playbook's lever "the max CPC cap" (prompt.ts line ~174) cannot be *added* to a non-portfolio campaign.
- **Implicit belief** (prompt.ts line ~154 and the general framing) that priority settles overlap with Performance Max.
  - **Outdated since May 2025:** PMax and Standard Shopping on the same products compete on Ad Rank. Exact-match Search keywords beat PMax. — [O-Blog June 2025](https://about.ads.microsoft.com/en/blog/post/june-2025/new-custom-report-builder-and-other-product-updates-for-june); [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax)

**Missing rules worth adding**
- **Feed freshness:** Merchant Center offers, feeds and GMC imports expire after 30 days. New or updated feeds can take up to about 72 hours to become eligible. "Product offers not found" should be diagnosed in order: store, feed (publishing on, country), product status, filters. — [O-Help feed files](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog); [O-Help "Product offers not found"](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bsc_error)
- **Immutable settings:** a Shopping campaign's store and country of sale cannot be changed after creation, and neither can a PMax campaign's store. — [O-Help Product ad best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productadbestpractices); [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax)
- **Tree limits:** UI 5 levels, API 7; 20,000 nodes; 5,000 actions per call. Changing a node from bid to excluded means delete plus re-add with a new id, which resets per-node history. — [O-API ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- **Minimum bid:** 0.01, but bids under 0.05 serve only on the Shopping tab. The DKK value is unverified. — [O-Help Minimum bid](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_productads_minbid)
- **Maximize clicks in Shopping:** keep the campaign at the highest priority, and don't overlap products across Maximize-clicks Shopping campaigns. — [O-Help Bid strategies](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bidstrategy)
- **Negative keywords:** they work in Shopping. One account-level list (up to 1,000) applies to Search, Shopping and PMax. — [O-Help negatives](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_aboutnegativekeywords)
- **PMax constraints** — [O-API PMax guide](https://learn.microsoft.com/en-us/advertising/guides/performance-max); [O-Help Create PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_createpmax); [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices); [O-Help About PMax](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_aboutpmax):
  - No shared budget.
  - Only Maximize conversion value or Maximize conversions; with no conversion goal it falls back to Maximize clicks.
  - Up to 100 asset groups and 300 PMax campaigns per account.
  - Search themes: max 50 per asset group, 80 characters each.
  - Brand exclusions may not be enabled on the account.
  - Website exclusions only at account level.
  - Recommended budget up to 2–3× that of the campaigns it replaces.
- **PMax reporting:** search term insights and reporting, landing page reporting and the publisher URL report exist. Auction insights were only "coming soon" as of May 2026. Don't exclude placements or queries on thin data. — [O-Blog May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/providing-more-transparency-for-your-performance-max-campaigns); [O-Help PMax best practices](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_pmaxbestpractices)
- **Item id casing:** compare and copy item ids exactly as Merchant Center has them; mismatched casing can create duplicates. — [O-API Managing your Products](https://learn.microsoft.com/en-us/advertising/shopping-content/manage-products)
- **Feed values:**
  - Availability must be `in stock`, `out of stock` or `preorder`.
  - product_type and adwords_labels are matched as one whole string.
  - excluded_destination is ignored.
  - Price and availability must match the landing-page microdata.
  - robots.txt must allow Bing's crawler and adixbot.
  - Source: [O-Help attributes](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcgoogleattributes); [O-Help Troubleshoot errors](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcerrormessages)
- **Sponsored Products and Shopping campaigns for brands** exist only in the US and UK. Don't propose them for a Danish account. — [O-API Product Ads guide](https://learn.microsoft.com/en-us/advertising/guides/product-ads)

### Inferences
- The fastest fixes in the app are:
  1. Change "every Shopping campaign" to "Shopping campaigns on Enhanced CPC".
  2. Change 15 to 30 conversions.
  3. Stop offering to exclude the Shopping root; offer pausing the ad group instead.
  4. Add the May 2025 Ad Rank rule for PMax vs Standard Shopping next to the priority rule.
  5. Note that a max CPC cap can't be added to a non-portfolio automated campaign.
- The playbook's manual-bid guardrail ("±20 % pr. søgeord pr. uge") has no Shopping counterpart. A matching product-group bid step rule would be a team choice; Microsoft gives no number.

### Gaps
- **Not verified in the app's rules:**
  - "Performance Max-søgetemaer: SearchInsightPerformanceReport", which I could not confirm in the reporting docs.
  - The correct target ROAS unit (300 % vs 3.0) in the UI or API.
- **Not documented by Microsoft:**
  - Whether a Shopping root or PMax listing-group root can be excluded through the API. Needs a live API test.
  - DKK minimum bids for Shopping.
