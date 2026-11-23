# Microsoft Advertising API v13 (REST): behaviours, limits and error codes that decide whether an AI assistant's changes succeed

Research date: 23 November 2026. Sources: Microsoft Learn pages downloaded 20–23 Nov 2026. The "updated" date after each source is the page's own "Last updated on" stamp. All URLs are under `https://learn.microsoft.com/en-us/advertising/` unless noted. Page text was treated as data.

## 1. Entity limits, batch sizes per call and string lengths

### Takeaway
The account-level limits are generous (10,000 campaigns, 20,000 ad groups per campaign, 20,000 keywords per ad group). The limits that actually break an assistant's calls are the per-call batch sizes: 100 for campaign criterions, ad extensions and extension associations; 1,000 for keywords and ad group updates; 5,000 for product-tree and listing-group actions. Some per-entity rules also break calls: at most 3 active RSAs per ad group, 2–20 callouts, exactly 3 device criterions, and at most 7 day-time blocks per day.

### Cited Findings
- **Account/campaign/ad group.** Each account can have up to 10,000 campaigns (experiment campaigns included). Each campaign can have up to 20,000 ad groups. A campaign name can be up to 400 characters and a campaign description up to 1,000. An ad group name can be up to 256 characters and must be unique among active ad groups in the campaign. Tracking templates can be up to 2,048 characters. — [Entity Limits (updated 2026-11-19)](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Ads.** An ad group can hold 1–100 ads of all types combined, active and paused. It can have at most **3 active responsive search ads**, and 3 active (5 total) multimedia ads. An account can have up to 4 million ads and a customer up to 20 million. — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **RSA text.**
  - 3–15 headlines and 2–4 descriptions, each with at least one word.
  - Input can be up to 1,000 characters including dynamic text. No more than **30 final characters per headline** and **90 per description** after substitution. Double-width characters (CJK, emoji) count against lower limits of 15/45.
  - No newline characters. IF functions are allowed.
  - Path1 and Path2: 15 final characters each. They cannot contain "/", and a space is shown as "_". Path2 is only allowed when Path1 is set.
  - The domain plus the paths must not exceed 67 characters, or the ad fails or falls back to default text.
  - The display URL domain comes from FinalUrls.
  - — [ResponsiveSearchAd (updated 2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad); [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Keywords.** 20,000 per ad group, 5,000,000 per account and 50,000,000 per customer. Keyword text can be up to 100 characters. Param1 can be up to 1,022 characters and Param2/Param3 up to 70. — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Negative keywords.**
  - Up to 20,000 per campaign and 20,000 per ad group, each up to 100 characters, with an account cap of 5,000,000.
  - At most 20 negative keyword lists per account, 5,000 keywords per list, and 50,000 campaign-to-list associations per account.
  - Campaign-level and ad-group-level negatives are both applied, so an ad group can effectively have 140,000.
  - — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Targets.**
  - Day-time: up to 49 criterions per campaign or ad group, no overlaps, and **at most 7 per day**.
  - Device: up to 3, and you must have all three (Computers, Smartphones, Tablets) or none.
  - Location: up to 10,000 location plus negative-location criterions combined.
  - Radius: up to 2,000.
  - Location intent: exactly 1.
  - Up to 50,000,000 target criteria per customer.
  - — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Ad extensions.**
  - An account can have up to 200,000 sitelinks plus 150,000 extensions of all other types.
  - Association limits per entity: sitelink, promotion, callout, price, structured snippet, action, review and flyer **20**; image 25; call 1; logo 1.
  - Callouts need between 2 and 20 per entity. With one or fewer, no callout text serves.
  - Call extensions can only be associated with campaigns. Location extensions cannot be associated with ad groups.
  - — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Ad extension string lengths.**
  - Sitelink DisplayText: **25 characters if Description1/2 are set, otherwise 35**. Description1 and Description2: 35 each.
  - Callout text: 25. Structured snippet values: 25.
  - Promotion: PromotionCode 15, PromotionTarget (PromotionItem) **20**.
  - — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits); [SitelinkAdExtension (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension); [PromotionAdExtension (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension)
- **Shopping and Performance Max.**
  - A product partition tree can have at most 20,000 nodes per ad group.
  - A Performance Max campaign can have up to **100 asset groups**, and each asset group up to 20,000 listing groups.
  - A campaign product scope can have up to 7 conditions.
  - — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits); [Product Ads guide (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- **Shared budgets.** Up to 11,000 per account. A shared budget can serve up to 10,000 campaigns, and a campaign can have one budget. — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Batch sizes per call.** These limits are each documented on their own operation's page.

  | Operation | Limit per call | Source (page updated) |
  |---|---|---|
  | AddKeywords | 1,000 keywords to one ad group | [AddKeywords](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addkeywords) (2026-01-22) |
  | UpdateAdGroups | 1,000 AdGroup objects, all in one campaign | [UpdateAdGroups](https://learn.microsoft.com/en-us/advertising/campaign-management-service/updateadgroups) (2026-02-06) |
  | AddCampaignCriterions / UpdateCampaignCriterions | 100 campaign criterions, one CriterionType value per call | [AddCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions) (2026-01-22); [UpdateCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/updatecampaigncriterions) (2026-09-23) |
  | AddAdExtensions | 100 extensions | [AddAdExtensions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addadextensions) (2026-01-22) |
  | SetAdExtensionsAssociations | 100 associations, one entity type (AssociationType) per call | [SetAdExtensionsAssociations](https://learn.microsoft.com/en-us/advertising/campaign-management-service/setadextensionsassociations) (2026-02-06) |
  | ApplyProductPartitionActions | 5,000 actions, all for the same ad group | [ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions) (2026-01-22) |
  | ApplyAssetGroupListingGroupActions | 5,000 actions, all for the same asset group | [ApplyAssetGroupListingGroupActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions) (2026-01-22) |

- **Conflict on UpdateAdGroups.** The Product Ads guide says "with the Campaign Management Service you can only update 100 ad groups per call". This contradicts the 1,000 on the UpdateAdGroups reference. — [Product Ads guide (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/product-ads), contradicted by [UpdateAdGroups (2026-02-06)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/updateadgroups)

### Inferences
- An assistant should chunk keyword adds and ad group updates at 1,000 and criterion, extension and association calls at 100. A cautious client could use 100 for ad group updates as well, given the conflicting guide.
- Before adding an RSA, count the ad group's active RSAs, because the cap is 3. Before associating sitelinks or promotions, count the existing associations, because the cap is 20 per entity.

### Gaps
- No documented per-call limit was checked for UpdateKeywords, AddAds or UpdateCampaigns.

## 2. Status semantics, editing restrictions and dates

### Takeaway
- Campaign status can only be set to Active or Paused. BudgetPaused, BudgetAndManualPaused and Suspended are set by the system.
- An Expired ad group can't be updated, but its EndDate can be extended to revive it.
- An ad group's StartDate is frozen once it has arrived.
- An EndDate can only be removed by setting it to 2 Jan 2050 or later.
- Dates are `{Day, Month, Year}` integers, inclusive, and interpreted in the campaign's time zone.

### Cited Findings
- **CampaignStatus values: Active, BudgetAndManualPaused, BudgetPaused, Deleted, Paused, Suspended.**
  - BudgetPaused is set by the service when the budget is depleted and goes back to Active when budget is restored.
  - BudgetAndManualPaused results when a user pauses a campaign that was already BudgetPaused.
  - Suspended means suspected suspicious activity. No ads are eligible, and the advertiser must contact support.
  - Deleted is internal only. Get operations never return deleted objects.
  - — [CampaignStatus (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaignstatus)
- **Campaign.Status on add/update.** Only Active and Paused can be set. The default on Add is **Paused**. "The service will automatically pause the campaign if the budget is depleted." Experiment campaigns cannot set Budget, BudgetType, Status or TimeZone; these are inherited from the base campaign. — [Campaign (2025-08-18)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **AdGroupStatus values: Active, Deleted, Expired, Paused.** Expired is set when the end date passes and **is read-only**. On Paused: "Ads and keywords that you add in this state are subject to editorial review." The default on Add is **Paused**. — [AdGroupStatus (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroupstatus); [AdGroup (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
- **Expired ad groups: error codes.** 1215 `CampaignServiceCannotUpdateAdGroupInExpiredState` means "An ad group that has expired cannot be updated." 1231 `CampaignServiceAdGroupExpired` means "The operation is not valid for an ad group that is expired." — [Operation error codes (2026-08-10)](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Expired ad groups can still be revived.** "The end date can be extended to make an ad group's ads eligible for delivery, even after the ad group expires." — [AdGroup.EndDate](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
- **Ad group StartDate.**
  - The start date is inclusive (12:00 AM on that date) and uses the time zone set at campaign level.
  - On Add, it defaults to today.
  - On Update: "The start date cannot be updated after the ad group is submitted i.e., once the start date has arrived." The related error is 1216 `CampaignServiceCannotUpdateAdGroupInSubmittedState`: "Some ad group properties such as start date cannot be updated once the ad group has been submitted with Active status."
  - If the campaign is "campaign managed", StartDate is set to the campaign's start date.
  - — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Ad group EndDate.**
  - The end date is inclusive: the ads expire at 11:59 PM, in the campaign time zone.
  - On Add, setting it to null means no end date.
  - On Update, omitting it means no change. **To remove an existing end date, set it to January 2, 2050 or later.** It then reads back as nil.
  - Error 1204: end date must be later than start date. Errors 1232/1233: invalid start/end date.
  - — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Campaign Start/EndDate** apply only to Audience campaigns. EndDate can be removed by setting it to January 1, 2050 or later. A lifetime-budget campaign requires an EndDate no more than a year after the start. — [Campaign (2025-08-18)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Date object.** `{"Day": int, "Month": int, "Year": int}`. All three are required on Add and on Update. Error 113 is `InvalidDateObject`. — [Date (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/date); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Campaign time zone.**
  - Campaign.TimeZone is "used for reporting and applying the start and end date of an ad group". It is required on Add.
  - It "may not [be updated] if the campaign contains or has ever contained ad groups in the Active or Paused state". Error 1131 is `CampaignServiceCannotChangeTimezoneOrStartDateWithActiveAdGroups`.
  - The same page now prefixes the field with "This column is deprecated."
  - — [Campaign (2025-08-18)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Fields fixed after creation.**
  - CampaignType: "Update: Not allowed". Error 1155 is `CampaignServiceCampaignTypeImmutable`.
  - Shopping StoreId and SalesCountryCode are immutable (errors 1156/1157).
  - Campaign SubType is read-only on update.
  - — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Shared budgets.** DailyBudget and BudgetType are read-only on a campaign that uses a shared budget. Updating them returns `CampaignServiceCannotUpdateSharedBudget` (1159). Set BudgetId to 0 together with a DailyBudget to move the campaign to its own budget. — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Campaign criterion status.** Values are Active, Deleted and Paused. Gets don't return deleted criterions. — [CampaignCriterionStatus (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaigncriterionstatus)
- **Ad extension editorial status.** Values are Active, ActiveLimited, Disapproved and Inactive.
  - ActiveLimited: approved in some markets and pending in others.
  - Inactive: "One or more elements of the ad extension is undergoing editorial review."
  - — [AdExtensionEditorialStatus (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adextensioneditorialstatus)
- **Read-only fields.** Editorial status of ads and keywords is read-only (errors 1383/1532). Ad extension Status is read-only and must be null (3800). Error 1010 `CampaignServiceSystemInReadOnlyMode` means only Get operations are accepted. — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)

### Inferences
- An assistant should never write Expired, BudgetPaused, BudgetAndManualPaused or Suspended as a status.
- To pause a BudgetPaused campaign, send Paused. The status will read back as BudgetAndManualPaused.
- To revive an Expired ad group, the only documented route is a later EndDate. Other updates to the ad group itself return 1215/1231.
- Date handling must be done in the campaign's time zone, not UTC.

### Gaps
- I found no official list of which child operations (AddKeywords, AddAds, ad group criterions, product partitions) return 1231 for an expired ad group. The error text says "the operation is not valid", but the docs don't enumerate operations.
- What the "This column is deprecated" note on Campaign.TimeZone means in practice was not explained anywhere I found.

## 3. Silent no-ops and update semantics (null, empty and "delete")

### Takeaway
Microsoft documents a number of settings that are "ignored without error". Most update fields follow the rule "not set = no change", but there are important exceptions:
- an empty string deletes the value;
- a special date deletes an end date;
- zeros delete promotion dates;
- `Amount: null` deletes a keyword bid;
- leaving out Sitelink Description1 on update removes it.

### Cited Findings
- **Bid strategy on ad groups and keywords.** "As of April 2021, you cannot set any bid strategies for ad groups or keywords. If you attempt to set bid strategies for ad groups or keywords, the request will be ignored without error. Ad groups and keywords will inherit their campaign's bid strategy." — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup); [Keyword (2026-09-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword)
- **Manual CPC.** "As of May 2024 … You can only use manual CPC for audience display and video campaigns, and for lodging campaigns … If you attempt to set manual CPC for any other campaign type, the request will be ignored without error and the bid strategy will be set to enhanced CPC." Audience native campaigns were converted to Enhanced CPC. — [ManualCpcBiddingScheme (2026-09-23)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme); [Budget and Bid Strategies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
- **Standalone Target CPA / Target ROAS.** Since **August 4, 2025**, TargetCpa and TargetRoas strategies are "silently converted" to MaxConversions or MaxConversionValue with the target value. Existing campaigns are unaffected. — [TargetRoasBiddingScheme (2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Bids and ad rotation under automated strategies.** "For some bid strategy types your bid and ad rotation settings are ignored." RotateAdsEvenly "will be ignored if you use an automated bid strategy i.e., MaxClicks, MaxConversions, TargetCpa, or TargetRoas." — [Campaign.BiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign); [AdGroup.AdRotation](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
- **Bid multipliers under automated strategies.** Under MaxClicks, MaxConversions, TargetCpa or TargetRoas, "the multiplier will inform rather than directly modify or override the automated bid." — [BidMultiplier (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier)
- **Location intent bid.** "You cannot bid on a location intent criterion. The service will ignore the multiplier without returning any error." On BiddableCampaignCriterion, the bid "is not applicable for LocationIntentCriterion and ProductScope (The service will not return any error and the bid will be ignored)". Using the wrong CriterionBid type (FixedBid vs BidMultiplier) means "your requested bid will be ignored". — [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier); [BiddableCampaignCriterion (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddablecampaigncriterion)
- **Product partitions.**
  - The Status element "is always ignored". To pause a product group you must pause the ad group.
  - CriterionBid and DestinationUrl are ignored on Subdivision nodes.
  - EditorialStatus "has no significant meaning".
  - — [ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- **DeviceCriterion.OSName.** "Reserved for internal use. If you specify this element the add and update operations will not fail, but the OS names will not be set." — [DeviceCriterion (2026-11-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion)
- **Deprecated location intent value.** "PeopleSearchingForOrViewingPages is deprecated as of April 2024. If you try to set IntentOption to PeopleSearchingForOrViewingPages, it will be set to PeopleInOrSearchingForOrViewingPages instead." — [IntentOption (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/intentoption)
- **Budget type.** Since January 2020, budget type is read-only for Search, Shopping and DSA campaigns and for shared budgets. "Any budget type value that you attempt to set will be ignored without returning an error." — [Release notes (2026-11-15)](https://learn.microsoft.com/en-us/advertising/guides/release-notes)
- **Audience ads bid adjustment.** UpdateAdGroups ignores AudienceAdsBidAdjustment unless `UpdateAudienceAdsBidAdjustment` is true. The default is false. — [UpdateAdGroups](https://learn.microsoft.com/en-us/advertising/campaign-management-service/updateadgroups)
- **Ad group Language.** On Dynamic Search Ads (DSA) campaigns, campaign and ad group Language settings "are ignored in favor of the website domain language". — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
- **The general rule.** Almost every field says "Update: Optional. If no value is set for the update, this setting is not changed." — e.g. [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup), [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Exceptions to the rule.** All are documented on the field's own page:
  - **Empty string ("") deletes:** TrackingUrlTemplate, FinalUrlSuffix, RSA Path1/Path2, PromotionCode, Sitelink Description2. Ad group Language set to "" removes it, so the campaign languages apply. — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup); [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad); [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension); [SitelinkAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension)
  - **Sitelink Description1 asymmetry:** "Update: Optional. If no value is set for the update, the prior setting is removed." DisplayText is *required* on update. — [SitelinkAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension)
  - **Keyword bid:** "To delete the keyword bid and use the AdGroup default match type bid, set the Amount element of the Bid object to null." — [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword)
  - **Ad group EndDate:** a date of 2050-01-02 or later removes it. Campaign EndDate (Audience): 2050-01-01 or later. — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
  - **Promotion start/end dates:** set Day, Month and Year to 0 to remove them. OrdersOverAmount set to 0 deletes it. — [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension)
  - **Ad extension Schedule:** an update replaces the whole schedule.
    - DayTimeRanges set to null removes all ranges.
    - UseSearcherTimeZone left null resets to false.
    - EndDate or StartDate set to null removes it.
    - — [Schedule (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/schedule)
  - **RSA Headlines/Descriptions:** nil keeps the existing assets. Setting them replaces *all* existing headlines or descriptions. — [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad)
  - **Campaign Languages:** the update replaces the list (does not append), and you cannot delete all languages. — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
  - **UrlCustomParameters:** null or empty keeps the existing parameters. Setting Parameters to null or empty removes all of them. — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
  - **BudgetId or BidStrategyId set to 0** detaches the campaign from a shared budget or portfolio strategy. — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
  - **MaxCpc on TargetRoas:** "The MaxCpc setting is cleared if the update value is empty." — [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme)
- **Get with an invalid id.** A Get operation with an invalid id succeeds, and "the response element that corresponds to the invalid request identifier will be nil". — [Services protocol (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/services-protocol)

### Inferences
- A read-back after every write is the only reliable way to detect the silent cases: bid strategy conversion, Manual CPC turning into Enhanced CPC, ignored multipliers, and the deprecated intent value.
- An update sends only the changed fields. One exception: for sitelinks, the client must resend Description1, DisplayText and the full Schedule each time.

### Gaps
- I did not find documentation of what happens to a keyword or ad group CpcBid written while an automated strategy is active. It is stored or ignored for serving, but the docs say only "ignored".

## 4. Campaign criterions: location, intent, device, day-time, radius, multipliers

### Takeaway
- Target criterions (age, DayTime, device, gender, location, location intent, radius) must be added, updated and deleted with `CriterionType: "Targets"`, but read one type at a time.
- Location intent defaults to PeopleInOrSearchingForOrViewingPages and cannot be deleted.
- Day-time blocks use whole hours plus minute values of 0, 15, 30 or 45. They cannot be edited, only deleted and re-added.
- Multipliers range from −90 to 900 (devices −100 to 900).
- Ad-group-level targets *replace* campaign-level ones; they are not combined.

### Cited Findings
- **CriterionType = Targets.** "To add, delete, or update target criterions i.e., age, day and time, device, gender, location, location intent, and radius criterions, you must specify the CriterionType value as Targets … To retrieve these target criterions via GetCampaignCriterionsByIds you must request the specific type individually i.e., Age, DayTime, Device, Gender, Location, LocationIntent, and Radius." — [AddCampaignCriterions (2026-01-22)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions); [DeleteCampaignCriterions (2026-01-22)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/deletecampaigncriterions); [CampaignCriterionType (2026-11-05)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaigncriteriontype)
- **IntentOption values.**
  - PeopleIn: physical presence.
  - PeopleInOrSearchingForOrViewingPages: the **default**.
  - PeopleSearchingForOrViewingPages: deprecated April 2024 and auto-converted to the default.
  - — [IntentOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/intentoption); [LocationIntentCriterion (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationintentcriterion)
- **One intent criterion per campaign or ad group.**
  - Only one LocationIntentCriterion is allowed per campaign or ad group.
  - It is "added automatically with the default IntentOption" when the first criterion is created.
  - It can be added or updated whether or not other criterions exist.
  - It **cannot be deleted**: error 2965 `CampaignServiceLocationIntentCriterionCannotBeDeleted`. Error 2966 is an invalid intent option.
  - — [LocationCriterion (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Ad group overrides campaign for geo targets.**
  - "If ad group level location criterions are specified (positive or negative), the campaign level location criterions are ignored for that ad group."
  - Location, negative location and radius criterions are one geo set. If the ad group has any of them, none of the campaign's geo criterions are inherited.
  - The ad group's intent is used only when its own geo criterions are used.
  - The same override rule applies to DayTime, Device and Radius: "not applied as a union".
  - — [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion); [DayTimeCriterion (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion); [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion); [RadiusCriterion (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/radiuscriterion)
- **Negative location criterions.** LocationCriterion can be used in NegativeCampaignCriterion and NegativeAdGroupCriterion. They count toward the 10,000 combined location limit. — [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion); [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Performance Max negatives.** Performance Max is the only campaign type that accepts campaign-level negative DeviceCriterion; other types return `CriterionTypeNotAllowed`. Device targeting for Performance Max is in pilot, and at least one device must stay un-excluded. — [AddCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions); [DeviceCriterion (2026-11-15)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion); [NegativeCampaignCriterion (2026-09-11)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/negativecampaigncriterion)
- **DayTimeCriterion.**
  - FromHour 0–23. ToHour 0–24, and ToHour 24 requires ToMinute Zero.
  - FromMinute/ToMinute use the Minute enum: Zero, Fifteen, Thirty, FortyFive.
  - Day, FromHour, FromMinute, ToHour and ToMinute cannot be updated: "you must delete the criterion and add a new criterion". If they are included in an update, they must match the existing values.
  - Related errors: overlap 2951, invalid interval 2946, invalid bid adjustment 2952.
  - — [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion); [Minute (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/minute); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **DeviceCriterion.**
  - DeviceName is Computers, Smartphones or Tablets.
  - On Add, all three should be sent in the same request. "If you do not add individual device criterions representing each of the three device types, no device criterions will be added." The same page also says the missing ones "will be added with the default bid adjustment of zero"; both statements are on one page.
  - DeviceName cannot be updated.
  - — [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion)
- **Bid multiplier ranges.**
  - Most criterion types: −90 to 900 (percent). Use whole integers "for parity with the web application".
  - DeviceCriterion: −100 to 900. −100 excludes the device.
  - A multiplier is required on Update for Age, DayTime, Device, Gender, Location, Profile and Radius. On Add it is optional and defaults to 0. Error 4519 is `CampaignCriterionBidMultiplierValueNotSet`.
  - — [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier); [BiddableCampaignCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/biddablecampaigncriterion); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **RadiusCriterion.**
  - Radius is an integer: 1–500 miles or 1–800 km.
  - Latitude must be between −85 and 85, and longitude between −180 and 180.
  - Name can be up to 50 characters.
  - Radius, latitude and longitude cannot be updated.
  - — [RadiusCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/radiuscriterion)
- **Criterion ids on Add.** A campaign criterion id must be null on Add (error 4505). Duplicate criteria are rejected (error 807, and 1408–1463 for duplicate targets). — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)

### Inferences
- "Presence only" = `IntentOption: "PeopleIn"`, written through `CriterionType: "Targets"` with an *update* (PUT) of the existing auto-created intent criterion.
- If campaign-level targets are changed while the ad group has its own geo, device or schedule criterions, the change has no effect on that ad group. The assistant should check ad group criterions first.

### Gaps
- It was not verified whether `CriterionType: "LocationIntent"` on Add/Update is actually rejected. The docs only say "Targets" is required.
- I found no source that confirms whether Microsoft accepts fractional multipliers such as 12.5.

## 5. Ad extensions: AddAdExtensions, associations, Sitelink and Promotion

### Takeaway
- Extensions live in an account library and serve only after SetAdExtensionsAssociations at Account, Campaign or AdGroup level.
- Higher-level extensions can serve *alongside* lower-level ones of the same type; there is no strict override.
- AddAdExtensions is all-or-nothing, while associations support partial success.
- PercentOff is in percent units: 10.0 = 10 %.

### Cited Findings
- **Library, association and precedence.** Extensions are stored in an account-level shared library, and "you must also explicitly associate it with the account or one or more campaigns or ad groups … for the extension to become eligible for delivery." "When ad extensions from higher levels in your account are predicted to improve your performance, they are eligible to serve alongside extensions of the same type from lower levels." — [Ad Extensions guide (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions)
- **Which levels are allowed.** AssociationType values are Account, AdGroup and Campaign. Call extensions cannot be associated with an account, and Call and Location extensions cannot be associated with ad groups. Each SetAdExtensionsAssociations call covers one entity type, with at most 100 associations. — [AssociationType (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/associationtype); [SetAdExtensionsAssociations](https://learn.microsoft.com/en-us/advertising/campaign-management-service/setadextensionsassociations)
- **Partial success.** "Partial success is not supported when adding, updating, and deleting ad extensions. For example if you submit 10 ad extensions and 2 fail, the entire batch will fail. Partial success is supported for GetAdExtensionsAssociations and SetAdExtensionsAssociations." — [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions)
- **Editorial review.** "When you associate an ad extension with a campaign or ad group, the extension goes through an initial editorial review." Editorial status is Active, ActiveLimited, Disapproved or Inactive (= under review). — [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions); [AdExtensionEditorialStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adextensioneditorialstatus)
- **Sitelink serving.** Ads can show up to 10 sitelinks, and links earlier in the list get higher priority. — [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions)
- **SitelinkAdExtension fields.**
  - DisplayText is required on Add *and* Update: max 25 characters with descriptions, otherwise 35.
  - Description1 and Description2: max 35 each. "If you specify Description1 then Description2 is required", and vice versa.
  - FinalUrls is required. Up to 10 items are accepted, but only the first is used. URLs can be up to 2,048 characters.
  - Duplicate sitelinks in one extension return error 3827.
  - — [SitelinkAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **PromotionAdExtension fields.**
  - **PercentOff: "For example, 10.0 represents a 10% discount."** You must set either PercentOff or MoneyAmountOff, not both (errors 6615/6616). Neither can be negative (6618).
  - PromotionItem: required, max 20 characters.
  - Language: required. Supported values are Danish, Dutch, English, Finnish, French, German, Italian, Norwegian, Portuguese, Spanish, Swedish and TraditionalChinese. The extension always serves in this language.
  - CurrencyCode: "only applicable if you set MoneyAmountOff or OrdersOverAmount". It is required in those cases (error 6621). DKK and EUR are supported.
  - PromotionCode (max 15) and OrdersOverAmount cannot both be set (6617).
  - DiscountModifier: None (default) or UpTo.
  - FinalUrls: required.
  - — [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Promotion dates.**
  - PromotionStartDate must be on or before PromotionEndDate (error 6620 `PromotionDatesInvalid`).
  - These dates only "inform the promotion date or dates that will be displayed". They do not override delivery. Delivery is set by PromotionOccasion plus Scheduling.
  - "If the end date has already passed for the current year, then each start and end date must be set for dates during the following year."
  - — [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **PromotionOccasion.**
  - The default is None (runs anytime within Scheduling).
  - Occasion windows are fixed. Examples: BlackFriday and CyberMonday 15 Oct–15 Dec; Christmas 1 Nov–15 Jan; NewYears 1 Dec–28 Feb; BoxingDay 15 Dec–15 Jan; ValentinesDay 15 Jan–28 Feb; Easter 1 Mar–30 Apr; Halloween 1 Oct–15 Nov; SinglesDay 15 Oct–30 Nov.
  - EndOfSeason, SpringSale, SummerSale, FallSale, WinterSale, MothersDay, FathersDay, BackToSchool and YearEndGift run anytime.
  - When updating PromotionOccasion, PromotionStartDate and PromotionEndDate must also be sent.
  - — [PromotionOccasion (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionoccasion); [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension)
- **Scheduling (Schedule object).**
  - StartDate and EndDate are inclusive (12:00 AM and 11:59 PM). Without an end date, the extension keeps delivering.
  - DayTimeRanges use StartHour/StartMinute/EndHour/EndMinute with the Minute enum.
  - UseSearcherTimeZone defaults to false, meaning the account time zone.
  - Error 3937: UseSearcherTimeZone must be null when all dates and ranges are null. Errors 3933–3936 cover invalid or overlapping schedules.
  - — [Schedule](https://learn.microsoft.com/en-us/advertising/campaign-management-service/schedule); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **ImageAdExtension V2 (May 2026).** ImageAdExtension moved to a V2 model (AssetLink[] Images). V1 writes are auto-converted. — [Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)

### Inferences
- An account-level sitelink will normally keep showing next to campaign or ad group sitelinks. Associating new ones at a lower level does not suppress it.
- PercentOff must be sent as 10, not 0.10. A value of 0.10 would advertise "0.1 % off".

### Gaps
- The editorial status of the *association* returned by GetAdExtensionsAssociations was not separately documented beyond the extension's own status values.

## 6. Product partitions (Shopping) and listing groups (Performance Max)

### Takeaway
- Both trees are all-or-nothing per call and limited to one ad group or one asset group per call.
- Each tree needs a root of `Operand "All"` with Attribute null.
- Depth is up to 7 levels and size up to 20,000 nodes, at 5,000 actions per call.
- Every subdivision needs an "everything else" leaf.
- Every biddable Shopping unit needs a bid. No exception is documented for automated bidding.
- Conditions and include/exclude can't be updated; you delete and re-add.
- The Performance Max field is `AssetGroupListingType`.

### Cited Findings
- **ApplyProductPartitionActions rules.**
  - Root: Operand "All", Attribute null, ParentCriterionId null. The root is level 0, and branches can be up to 7 levels deep.
  - Up to 5,000 actions per call and 20,000 nodes per tree. All actions must have the same AdGroupId.
  - "If any action fails, all remaining actions … will also fail." "All actions in one call must result in a complete tree structure."
  - "Every Unit must have a bid, unless the node is a NegativeAdGroupCriterion."
  - "Every subdivision must have at least one leaf node that bids on the remainder", meaning the same operand with Attribute null.
  - A child must come after its parent in the list. New parents are referenced by negative temporary ids, which are valid only within the call.
  - Changing Condition or Attribute, or switching biddable↔negative, requires delete + add, and the node gets a new id.
  - Deleting a parent deletes all of its descendants. Duplicate conditions in a branch are not allowed.
  - For a Delete action, only Id and AdGroupId are needed.
  - — [ApplyProductPartitionActions (2026-01-22)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions)
- **Update action.** "For the Update action, only the CriterionBid and DestinationUrl elements of the AdGroupCriterion are mutable." — [AdGroupCriterionAction (2024-11-13)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroupcriterionaction)
- **No partial success.** "The ApplyProductPartitionActions operation includes PartialErrors in the response; however, partial success is not supported." — [Handle service errors (2026-11-02)](https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions)
- **Product partition error codes.**
  - 4123 invalid partition type; 4126 partition limit exceeded; 4127 invalid hierarchy.
  - 4128 `RemainingProductsNodeMissingInProductPartition` (missing "everything else").
  - 4130 siblings must share an operand; 4131 tree height exceeded; 4132 root already exists.
  - 4133 children only under a subdivision; 4134 parent id invalid; 4135 criterion immutable.
  - 4150 `RelatedProductPartitionActionError`: another action in the same call failed.
  - 1515: bid below the floor.
  - — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Reading and setting up the tree.**
  - Read: GetAdGroupCriterionsByIds with AdGroupCriterionIds null returns all partitions. The root is the node with ParentCriterionId null.
  - Each ad group has one product group.
  - At least one ProductAd is required in the ad group.
  - ApplyProductPartitionActions doesn't validate conflicts with the campaign ProductScope.
  - Partition data in the Reporting service lags the web UI by up to an hour.
  - — [Product Ads guide (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/product-ads)
- **ApplyAssetGroupListingGroupActions (Performance Max).**
  - Same tree rules: root "All", 7 levels, 5,000 per call, 20,000 per asset group, one AssetGroupId per call, all-or-nothing, complete tree, remainder leaf per subdivision.
  - There is no bid.
  - Exclusion is `IsExcluded`. Changing a condition or switching between included and excluded requires delete + add.
  - "Update is not supported for listing group."
  - To pause, pause the asset group.
  - — [ApplyAssetGroupListingGroupActions (2026-01-22)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions); [AssetGroupListingGroupAction (2024-12-03)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/assetgrouplistinggroupaction)
- **AssetGroupListingGroup JSON.**
  - Fields: `AssetGroupId`, **`AssetGroupListingType`** (Subdivision or Unit), `Dimension` {Attribute, Operand, Operator}, `Id`, `IsExcluded`, `ListingGroupPath` (read-only, added July 2025) and `ParentListingGroupId` (null for the root).
  - AssetGroupListingType is "Add: Required".
  - The REST request template on the operation page uses the same names.
  - The official Python REST SDK aliases the field as `"AssetGroupListingType"`.
  - — [AssetGroupListingGroup (2025-05-12)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/assetgrouplistinggroup); [ApplyAssetGroupListingGroupActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions); [BingAds-Python-SDK asset_group_listing_group.py (GitHub)](https://github.com/BingAds/BingAds-Python-SDK/blob/main/openapi_client/models/campaign/asset_group_listing_group.py)

### Inferences
- An assistant should always submit a whole subtree in one call: the subdivision, every leaf and the "everything else" node.
- To change only bids, it can use Action "Update" for Shopping units. That keeps node ids, unlike delete + add.

### Gaps
- No document says bids are optional on Shopping units under automated bidding (Maximize conversion value or Maximize clicks on Shopping). The rule as written still requires a bid on every biddable Unit.
- The maximum number of children per subdivision was not found.

## 7. Bidding schemes in the API

### Takeaway
- Search and Shopping campaigns default to Enhanced CPC.
- Performance Max accepts only MaxConversions (with an optional TargetCpa) and MaxConversionValue (with an optional TargetRoas).
- TargetRoas is a ratio: 1.0 = 100 %, so 3.0 = 300 %. The range is 0.01–1,000.
- Standalone TargetCpa and TargetRoas have been converted silently since 4 Aug 2025.
- A new MaxCpc cannot be added to non-portfolio campaigns (error 611274).

### Cited Findings
- **Supported strategies per campaign type.**
  - Search and DSA: default EnhancedCpc.
  - Most Shopping campaigns: default EnhancedCpc. Smart shopping supports only MaxConversions and MaxConversionValue.
  - Audience: EnhancedCpc, ManualCpc, ManualCpm, TargetCpa.
  - Performance Max: "MaxConversionsBiddingScheme (with optional TCPA) and MaxConversionValueBiddingScheme (with optional TROAS)".
  - — [Campaign.BiddingScheme (2025-08-18)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **MaxConversionValue coverage.** "Search campaigns, Shopping campaigns, Smart shopping campaigns, and Performance Max campaigns use the Maximize Conversion Value bid strategy … with an option to define return on ad spend (ROAS) targets." — [MaxConversionValueBiddingScheme (2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionvaluebiddingscheme). The older bid-strategy table lists MaxConversionValue only for smart shopping and Performance Max; this conflicts with the newer page. — [Budget and Bid Strategies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
- **TargetRoas units.** "The supported target ROAS values range from 0.01 (1 percent) to 1,000.00 (100,000 percent)." TargetRoas is required on Add. MaxConversionValueBiddingScheme.TargetRoas is described only as "the target return on ad spend". — [TargetRoasBiddingScheme (2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme); [MaxConversionValueBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionvaluebiddingscheme)
- **The 2025 consolidation.** "Starting August 4, 2025, the BiddingScheme in the Campaign object will no longer support TargetCpaBiddingScheme and TargetRoasBiddingScheme."
  - Target CPA is silently converted to Maximize Conversions with the TargetCpa value.
  - Target ROAS is silently converted to Maximize Conversion Value with the TargetRoas value.
  - Existing campaigns are unaffected. SA360 is not affected.
  - — [TargetCpaBiddingScheme (2026-10-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetcpabiddingscheme); [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme)
- **Max CPC restriction (current breaking change).** "You can no longer add a Max CPC value to non-portfolio campaigns" using MaxClicks, MaxConversions, MaxConversionValue, TargetCpa or TargetRoas. Doing so returns `MaxCpcCannotBeAdded (611274)`. An existing value can still be edited or removed. Portfolio strategies still support MaxCpc. — [Release notes (2026-11-15)](https://learn.microsoft.com/en-us/advertising/guides/release-notes); [MaxConversionValueBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/maxconversionvaluebiddingscheme)
- **Reading the bidding scheme.** The BiddingScheme "will be nil or empty by default if the campaign uses the MaxConversionValueBiddingScheme or TargetImpressionShareBiddingScheme" unless those names are sent in ReturnAdditionalFields. — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Portfolio strategies.** BidStrategyId > 0 means the campaign uses a portfolio strategy; set it to 0 to use the campaign's own strategy. Portfolio strategies are not supported for smart shopping or Performance Max. — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Conversion requirements.** Maximize Conversions, Target CPA and Target ROAS require a UET tag plus a conversion goal. "If your campaign falls below 30 conversions over any 30-day period, [the strategy] will stop optimizing your bids." Target ROAS also needs non-zero revenue in the last 30 days. — [Budget and Bid Strategies (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies)
- **Errors when setting up Maximize conversion value.** 1166 `CustomerHasNoUETForMaxConversionValueBiddingScheme` and 1167 `AccountHasNoRevenueConversionGoalForMaxConversionValueBiddingScheme`.
  - Other bid-strategy errors: 4700/4701 strategy not enabled or unsupported; 4716/4717 not enough conversions; 4724/4725 strategy and shared budget mutually exclusive; 4726/4727 not enabled for the locations; 4703/4710 MaxCpc or TargetCpa above the monthly budget.
  - — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **REST "Type" discriminator.** The official REST SDK maps both short and long names: for example 'TargetCpa' and 'TargetCpaBiddingScheme', 'MaxClicks' and 'MaxClicksBiddingScheme', 'EnhancedCpc' and 'EnhancedCpcBiddingScheme'. MaxConversionValue and TargetImpressionShare exist only as long names ('MaxConversionValueBiddingScheme', 'TargetImpressionShareBiddingScheme'). The docs' JSON templates show both forms ("TargetCpa", "MaxConversionValueBiddingScheme"). — [BingAds-Python-SDK bidding_scheme.py (GitHub)](https://github.com/BingAds/BingAds-Python-SDK/blob/main/openapi_client/models/campaign/bidding_scheme.py); [TargetCpaBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetcpabiddingscheme)
- **Newer scheme fields.** MaxCpc was added to MaxConversionValueBiddingScheme in July 2025. TargetCpmBiddingScheme got SDK coverage in November 2026 (API revision 2026-11-09). — [Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)

### Inferences
- An app or user target of "300 %" should be sent as `TargetRoas: 3.0`. This follows from the TargetRoasBiddingScheme definition; I assume MaxConversionValue uses the same unit because it is the same double field and Target ROAS converts into it.
- After writing any strategy, read the campaign back with ReturnAdditionalFields. Otherwise a MaxConversionValue campaign appears to have no strategy.

### Gaps
- Microsoft's help pages about a 15-conversion threshold could not be verified. A search pointed to a 2018 blog post that mentions 15 conversions to enable the strategy and a later post that removes the minimum; neither was fetched.
- Units of MaxConversionValue.TargetRoas are not stated explicitly on its own page.

## 8. Reporting API

### Takeaway
- Reports are asynchronous: you submit, poll, then download a ZIP within 5 minutes of getting the URL. The request id is valid for 2 days.
- Hourly aggregation only accepts Today, Yesterday or a custom range. Hourly data is kept 6 months (1 month for search terms, 14 days for geographic).
- Impression-share columns cannot be combined with hourly aggregation (error 2053) or with DeviceOS, Goal, GoalType or TopVsOther.
- Click data needs up to about 2 hours and conversions about 3 hours. ReportTimeZone defaults to Pacific.

### Cited Findings
- **Request flow.**
  - "Call the PollGenerateReport operation in a loop while the status is Pending." Success means done; any other status means the report failed.
  - "Polling at two to 15-minute intervals should be appropriate for most cases." If polling exceeds 60 minutes, save the id and retry later.
  - The ReportRequestId is valid for two days.
  - After getting the URL, "you have five minutes to download the report". After that, poll again for a new URL.
  - The file is compressed (ZIP).
  - Submit and Poll must use the same user credentials.
  - When using a custom date range, PredefinedTime must not be set.
  - — [Request and Download a Report (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/request-download-report)
- **Aggregation vs time periods.**

  | Aggregation | Allowed time periods |
  |---|---|
  | Daily | Today, Yesterday, LastSevenDays, ThisMonth, LastMonth, custom range |
  | DayOfWeek | Today, Yesterday, LastSevenDays, ThisMonth, LastMonth, LastThreeMonths, LastSixMonths |
  | **Hourly** | **Today, Yesterday, custom range** |
  | HourOfDay | as DayOfWeek |
  | Monthly | ThisMonth, LastMonth, LastThreeMonths, LastSixMonths, ThisYear, LastYear, custom range |
  | Summary | as Daily |
  | Weekly | ThisWeek, LastWeek, LastFourWeeks, ThisMonth, LastMonth, ThisYear, LastYear, custom range |
  | Yearly | ThisYear, LastYear, custom range |

  Error 2007 is an invalid aggregation for the time period. — [Reporting Service Model (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/reports); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Custom date range.** CustomDateRangeEnd "cannot be later than today's date", and the start must be on or before the end. ReportTimeZone "determines the time zone that is used to establish today's date"; the default is PacificTimeUSCanadaTijuana. — [ReportTime (2025-06-11)](https://learn.microsoft.com/en-us/advertising/reporting-service/reporttime); [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports)
- **UTC in downloaded data.** "The downloaded report data is always relative to UTC time. For example an hourly report might attribute 5 clicks to hour 7 … between 07:00 and 08:00 UTC." — [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports)
- **Data latency and completeness.**
  - "It can take up to two hours for the system to process the click (3 hours for conversions)… Data is generally considered complete with books closed after 3 hours."
  - Invalid-traffic adjustments can take a week or more.
  - With ReturnOnlyCompleteData=true, the service returns 2004 `NoCompleteDataAvaliable` if data isn't complete. With multiple campaign time zones, data is complete only when all of them have closed.
  - — [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Column restrictions.**
  - Impression-share columns are mutually exclusive with these attributes: DeviceOS, Goal, GoalType and TopVsOther (Account and AdGroup reports). Campaign reports add BudgetAssociationStatus, BudgetName and BudgetStatus to that list.
  - The impression-share columns include ImpressionSharePercent, ImpressionLostToBudgetPercent, ImpressionLostToRankAggPercent, the AbsoluteTop… columns, ClickSharePercent, ExactMatchImpressionSharePercent and RelativeCtr.
  - Audience IS columns and RelativeCtr also exclude CustomerId, CustomerName and DeliveredMatchType.
  - Error 2053 `InvalidGrainForImpressionShareColumns`: "The impression share columns are not available for the specified report aggregation."
  - — [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Headers, footers and formats.**
  - The report header, column headers and footer are included by default. ExcludeReportHeader, ExcludeColumnHeaders and ExcludeReportFooter turn them off.
  - Columns appear in the requested order.
  - Format can be Csv (default), Tsv or Xml. FormatVersion 2.0 changes formats such as percentage fields.
  - The service doesn't de-duplicate requests.
  - Duplicate columns return 2016.
  - — [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Rows with zero impressions.** Rows can have zero impressions when a click or conversion falls in the period but the impression doesn't. — [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports)
- **Retention, in months: hourly / daily and longer.**
  - Account, Campaign, Ad Group, Ad, Keyword: 6 / 36.
  - **Search Query: 1 / 36.** Product Search Query: 1 / 36.
  - Product Dimension and Product Partition: 6 / 36.
  - **Geographic and User Location: 14 days hourly** / 36.
  - Share of Voice: no hourly / 6.
  - Budget Summary: daily 24.
  - Change History: 6.
  - — [Reporting Data Retention Time Periods (2026-09-01)](https://learn.microsoft.com/en-us/advertising/guides/report-data-retention-time-periods)
- **New report types since 2025.**
  - BidStrategyReport: December 2025.
  - MSClickIdPerformanceReport: May 2026.
  - SearchTermLandingPageReportRequest: August 2026. It maps AI Max search terms to landing pages and excludes rows with zero clicks.
  - ConversionDelay column: December 2025.
  - — [Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)
- **AI Max matching.** AI Max search-term matching uses a Microsoft-managed "AIOptimized" system keyword. It isn't returned as a Keyword object and can't be added, updated or deleted. It appears in reporting as the delivered match type "AIOptimized". — [Keyword (2026-09-29)](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword)

### Inferences
- A per-day time series combined with impression share must use Daily, Weekly or Monthly aggregation, never Hourly or HourOfDay.
- "Yesterday" figures can still shift for conversions credited back to the click date. This is a separate effect from the 3-hour processing time.

### Gaps
- I found no official statement of the 14–18 hour delay for impression-share data or the once-a-day quality-score update; both are in the app's prompt.
- The DayOfWeek numbering (1 = Sunday) was not confirmed in the pages read.
- I found no hard concurrency number for report requests; Microsoft calls the limits "internal and subject to change".

## 9. Error codes, throttling and retry practice

### Takeaway
- 117 (CallRateExceeded, Campaign Management and Ad Insight) means "wait 60 seconds".
- 207 means "wait until your earlier reports finish" in Reporting, but in Customer Management the same number means an address error.
- 4204 is Bulk-only and means wait up to 15 minutes.
- Error 0 (InternalError) is transient and can be retried later.
- Most batch errors come back as PartialErrors, indexed by item position, and need per-item handling.

### Cited Findings
- **Throttling by service.**
  - Campaign Management and Ad Insight: limits are per user per minute, using a sliding 60-second window at customer level. Exceeding them returns **117 CallRateExceeded**. "When you observe this error, you can resubmit the request under the limit after waiting 60 seconds."
  - Reporting: **207 ConcurrentRequestOverLimit**. "Wait until the previous reports are completed and then try to submit a new request."
  - Bulk: **4204 BulkServiceNoMoreCallsPermittedForTheTimePeriod**. The error text says "you can resubmit your request after waiting up to 15 minutes". The Bulk upload limit is 100 MB / 4 million rows.
  - Exact limits are "internal and subject to change".
  - — [Services protocol (2025-06-26)](https://learn.microsoft.com/en-us/advertising/guides/services-protocol); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **207 is ambiguous.** The error-code page lists 207 twice: "Not applicable — The Address Line3 property is invalid" (Customer Management) and "ConcurrentRequestOverLimit" (Reporting). — [Operation error codes (2026-08-10)](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Authentication and authorization codes.**
  - 105 InvalidCredentials: AccountInactive, InvalidAccessToken or UserNotFound.
  - 106 UserIsNotAuthorized.
  - 109 AuthenticationTokenExpired: renew the token.
  - 1001: user not authorized.
  - 1029: CustomerId header required.
  - 1100/1102/1201: invalid campaign, account or ad group id.
  - 1044 `CampaignServiceEntityDoesNotExist` (see ReasonCode).
  - 517 entity id invalid; 4100/4151 ad group criterion id invalid or missing.
  - — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Keyword errors.**
  - 1542 `KeywordAndMatchTypeCombinationAlreadyExists`.
  - **1545 `KeywordMatchTypeChangeNotAllowedInUpdate`**.
  - 1517 duplicate keyword; 1503 invalid keyword text.
  - 1544 zero bid not allowed; 1515 bid below floor; 1516 bid above ceiling or budget.
  - — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Negative keyword errors.** 1007 negative matches a keyword; 1032/1033 limit exceeded; 4335/4338 duplicate; 4340 invalid match type; 4329 "Cannot modify a deleted negative keyword". — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Editorial errors.**
  - 1042 `CampaignServiceEditorialValidationError`: "see the ReasonCode element".
  - 1376–1381: editorial errors in title, text, display URL, destination URL, business name and phone.
  - 1397 generic editorial error.
  - 1710–1712: appeal quotas and "already appealed".
  - — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Reporting errors.** 2004 no complete data; 2005 complete data impossible for the period; 2007 invalid aggregation; 2008 invalid time selection; 2100/2101 invalid or unknown report id; 2016 duplicate columns; 2053 impression share vs aggregation. — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **InternalError (0).** "This is a temporary system issue … try again later." Retry if the same call has worked before; contact support if it persists. Fault objects carry a TrackingId that support needs. — [Handle service errors (2026-11-02)](https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions)
- **Partial success.**
  - For most Campaign Management operations, "For each list index where an entity was not added, the corresponding element will be null. The PartialErrors element represents an array of BatchError objects…" Some operations return NestedPartialErrors, a 2-D list of BatchErrorCollection.
  - Bulk doesn't support all-or-nothing.
  - ApplyProductPartitionActions is all-or-nothing.
  - — [Handle service errors](https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions)
- **SOAP to REST.** The SOAP API "is scheduled for full deprecation on January 31, 2027". SOAP integrations keep access to features through that date, which is an updated, more lenient plan. The Python and PHP SDK users must move to the new `msads` package. — [Migrate to REST API (2026-09-30)](https://learn.microsoft.com/en-us/advertising/guides/migrate-to-rest)
- **REST endpoint.** `https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/<Entity>/<Action>`, for example `/AssetGroupListingGroupActions/Apply`. — [ApplyAssetGroupListingGroupActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions)
- **API revisions.** The current revision is 2026-11-09 (SDK 13.0.31, 11 Nov 2026). Some Campaign fields are marked "Get: Available since revision 2026-08-17": BusinessName and MarketingObjective. — [Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)

### Inferences
- A retry policy that fits the documentation:
  - 117: back off at least 60 seconds.
  - 207 from Reporting: wait for running reports, or re-poll existing ones.
  - 4204: back off minutes, not seconds.
  - 0: one delayed retry.
  - 105, 106, 1001, editorial and validation errors: never retry.
- Check the service before treating 207 as throttling.

### Gaps
- I found no documented HTTP status mapping for the REST endpoints (for example whether throttling returns 429 or 400 with error 117).
- I found no documented Retry-After header.

## 10. Against the current rules and code

### Takeaway
Most statements in the prompt's "Documented Microsoft Advertising rules" section are confirmed. Two are contradicted and should change: the conversion threshold (Microsoft's API guide says 30, not 15) and the API-error advice for 117/207. Seven things are missing: TargetRoas units, PercentOff units, intent values, product-tree rules, end-date removal, the MaxCpc 611274 restriction and target-override inheritance.

In the code there are three concrete defects:
- The Performance Max listing groups use a wrong field name (`ListingGroupType` instead of `AssetGroupListingType`).
- Location intent is written with `CriterionType: "LocationIntent"` instead of `"Targets"`.
- Sitelinks are sent with `Description2: ''`.

There are also risks around MaxCpc and the retry timing.

### Cited Findings

**`src/ai/prompt.ts`: Documented Microsoft Advertising rules**

- **RSA rule: confirmed.** 3–15 headlines and 2–4 descriptions with at least one word; 30/90 final characters after dynamic-text substitution; Path1/Path2 15 each; Path2 only with Path1; display URL from the final URL domain.
  - Missing: max **3 active RSAs per ad group**; 100 ads per ad group; domain + paths ≤ 67 characters; no "/" or newline in paths.
  - — [ResponsiveSearchAd](https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad); [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **Keywords: max 100 characters, match type can't be changed: confirmed.** See error 1545 `KeywordMatchTypeChangeNotAllowedInUpdate`, though the Keyword page lists MatchType as "Update: Optional".
  - "Duplicates that only differ in case, accents or punctuation are rejected" was **not verified**. Only the generic duplicate errors 1542 and 1517 were found.
  - — [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes); [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword)
- **Negative keywords.** Confirmed: 100 characters; 20,000 per campaign or ad group; lists are separate (20 lists per account, 5,000 per list). Not verified: "Exact or Phrase only" and "cannot be edited". Error 4340 (invalid match type) exists. — [Entity Limits](https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits)
- **New ad groups paused; no CPC bid gives the currency minimum: confirmed.** — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
- **Campaign type, time zone, shared budgets, experiments: confirmed.** Campaign type is immutable. Time zone can't be updated once the campaign contains or has *ever* contained Active or Paused ad groups. Shared budgets return error 1159. Experiments inherit budget, status and time zone.
  - Add to the prompt that the Campaign page now marks TimeZone as "This column is deprecated".
  - — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Budget rule: confirmed.**
  - The monthly formula = month-to-date spend + daily × days left including today.
  - Overspend is "usually … less than 100% above your daily limit", i.e. under 2×.
  - Changes take effect "within an hour or so".
  - — [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies); [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Statuses: incomplete.** The prompt is missing `BudgetAndManualPaused`, which appears when a BudgetPaused campaign is paused by the user, and should say that Expired is read-only.
  - The editorial meaning "Inactive = under review" is confirmed for ad extensions. It was not verified for ads and keywords.
  - — [CampaignStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaignstatus); [AdExtensionEditorialStatus](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adextensioneditorialstatus)
- **Reports: partly confirmed, partly contradicted.**
  - Confirmed: impression share can't be combined with hourly data (error 2053).
  - Partly contradicted: "the newest 1–3 days are incomplete". Microsoft says clicks need up to 2 hours and conversions 3 hours, and books close after about 3 hours. Late conversions credited to the click date are a separate, undocumented effect.
  - Not verified: "14–18 hours" for impression share and "1 = Sunday".
  - Missing: hourly data is kept only 6 months (search terms 1 month, geographic 14 days); downloaded data is in UTC; ReportTimeZone defaults to Pacific.
  - — [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports); [Reporting Data Retention](https://learn.microsoft.com/en-us/advertising/guides/report-data-retention-time-periods)
- **API errors: the advice for 117 and 207 is contradicted in its precision.**
  - 105/106 and 1542/2053: confirmed.
  - 117: Microsoft says wait **60 seconds**, not just "wait and try again".
  - 207: this means concurrent *report* requests (wait for running reports to finish), and the same number in Customer Management means "Address Line3 invalid".
  - Missing: 1545 (match type change), 1215/1231 (expired ad group), 1216 (start date passed), 611274 (MaxCpc cannot be added), 1159 (shared budget), 2965 (location intent can't be deleted), 4128 (missing "everything else" node), 1042 editorial (see ReasonCode), 0 InternalError (retry later).
  - — [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Bid strategies (prompt line ~210): mostly confirmed, two corrections.**
  - Confirmed: since 4 August 2025, TargetCpa and TargetRoas are silently converted to MaxConversions and MaxConversionValue.
  - Correction 1: Manual CPC is allowed only for Audience *display and video* campaigns, plus lodging, not Audience campaigns in general. Audience native was converted to Enhanced CPC in May 2024.
  - Correction 2: "Microsoft stops optimising below 15 conversions in 30 days" is **contradicted** by the API guide, which says **30 conversions over any 30-day period** for MaxConversions, TargetCpa and TargetRoas. Target ROAS also needs non-zero revenue.
  - — [ManualCpcBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/manualcpcbiddingscheme); [Budget and Bid Strategies](https://learn.microsoft.com/en-us/advertising/guides/budget-bid-strategies); [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme)
- **Silent no-ops (prompt line ~164): confirmed.**
  - Ad group and keyword *bid strategies* are ignored. Bids and ad rotation are ignored under automated strategies. Manual CPC becomes Enhanced CPC.
  - "Activating a keyword in a paused campaign" is not documented as a silent no-op. It just doesn't serve.
  - Missing from the list:
    - location intent multipliers are ignored;
    - PeopleSearchingForOrViewingPages is converted;
    - OSName is ignored;
    - BudgetType is ignored for Search and Shopping;
    - AudienceAdsBidAdjustment is ignored without `UpdateAudienceAdsBidAdjustment: true`;
    - multipliers only "inform" automated bids.
  - — [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier); [IntentOption](https://learn.microsoft.com/en-us/advertising/campaign-management-service/intentoption); [UpdateAdGroups](https://learn.microsoft.com/en-us/advertising/campaign-management-service/updateadgroups); [Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes)
- **Expired ad groups (prompt line ~120): mostly confirmed.** Errors 1215/1231 back it up. But "Microsoft refuses every change inside them" is too absolute: the EndDate *can* be extended to revive the ad group. The prompt already offers that route. — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **"Mål-ROAS 300 % → 3,0" (prompt line ~140): confirmed** by "0.01 (1 percent) to 1,000.00 (100,000 percent)". — [TargetRoasBiddingScheme](https://learn.microsoft.com/en-us/advertising/campaign-management-service/targetroasbiddingscheme)
- **Start dates (prompt line ~141): confirmed.** "Microsoft holds the ads back until the start date" is right. Add that the StartDate cannot be changed once it has arrived (error 1216). — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
- **"Presence" = PeopleIn: confirmed.** The default is PeopleInOrSearchingForOrViewingPages. — [LocationIntentCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationintentcriterion)
- **Missing rules worth adding to the prompt:**
  - PercentOff is in percent units: 10.0 = 10 %.
  - PromotionItem has a 20-character limit; PromotionCode 15.
  - Sitelink DisplayText is 25 characters with descriptions and 35 without; Description1 and Description2 must come together.
  - At most 20 sitelinks or promotions per entity.
  - Higher-level extensions serve *alongside* lower-level ones.
  - Ad group targets (geo, device, schedule) *replace* campaign targets; they are not combined.
  - Day-time blocks: at most 7 per day, minutes 0/15/30/45.
  - Multipliers −90…900, devices −100…900.
  - Device criterions: all three or none.
  - Product trees: all-or-nothing per ad group; root "All"; an "everything else" leaf in each subdivision; ≤7 levels; every biddable unit needs a bid; condition changes = delete + add.
  - Ad group EndDate removal = a date ≥ 2050-01-02.
  - A new MaxCpc on a non-portfolio automated campaign returns 611274.

**`src/bing/live.ts` and `client.ts`: API usage**

- **Contradicted: `listingGroupActionJson` and `listAssetGroupListingGroups` field name.** The code writes `ListingGroupType: 'Subdivision' | 'Unit'` and reads `l.ListingGroupType ?? l.GroupNodeListingType`. Both the docs and the official REST SDK name the field **`AssetGroupListingType`**, and it is "Add: Required". Adds will probably fail or create wrongly typed nodes, and reads will return `unit: null`. — [AssetGroupListingGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/assetgrouplistinggroup); [ApplyAssetGroupListingGroupActions REST template](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions); [BingAds-Python-SDK](https://github.com/BingAds/BingAds-Python-SDK/blob/main/openapi_client/models/campaign/asset_group_listing_group.py)
- **Contradicted: `setLocationIntent` criterion type.** The code POSTs or PUTs with `CriterionType: 'LocationIntent'`. The docs say target criterions, location intent included, must be added, updated and deleted with **`CriterionType: "Targets"`**; the specific type is only for reads. The POST branch is also normally unnecessary, because an intent criterion is created automatically when the first criterion is added. `applyCampaignTargets` correctly uses `Targets`. — [AddCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions); [CampaignCriterionType](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaigncriteriontype); [LocationCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/locationcriterion)
- **Risk: `addAdExtensions` sends `Description2: ''` when only Description1 is given.** The docs say "If you specify Description1 then Description2 is required", so an empty Description2 will likely be rejected. Because AddAdExtensions has no partial success, one bad sitelink fails the whole batch.
  - DisplayText must be 25 characters or fewer when descriptions are set.
  - The 100-per-call limit is not enforced; there is no chunking.
  - — [SitelinkAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension); [Ad Extensions guide](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions); [AddAdExtensions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addadextensions)
- **Promotion: correct, with two notes.** Using `PercentOff` or `MoneyAmountOff` as exclusive alternatives is correct. Two notes:
  - `PercentOff: e.percentOff` must be in percent units (10 = 10 %). Check that the tool schema doesn't send 0.10.
  - `CurrencyCode` is always sent. It is only applicable with MoneyAmountOff or OrdersOverAmount. Error 6621's wording suggests it is tolerated with PercentOff, so this is low risk.
  - `PromotionOccasion` is never set, so it defaults to None (anytime), which is correct for custom dates.
  - — [PromotionAdExtension](https://learn.microsoft.com/en-us/advertising/campaign-management-service/promotionadextension); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Risk: `fromBidStrategy` writes `MaxCpc` whenever `b.maxCpc` is set,** both in `createCampaign` and in `updateCampaigns`. For non-portfolio campaigns on MaxClicks, MaxConversions or MaxConversionValue, a *new* MaxCpc returns **611274**. Only an existing value can be edited or removed.
  - `Type: '<X>BiddingScheme'` is accepted by the REST discriminator; the SDK maps both forms.
  - Writing `TargetCpaBiddingScheme` or `TargetRoasBiddingScheme` is silently converted. The read-back is needed and is done.
  - — [Release notes](https://learn.microsoft.com/en-us/advertising/guides/release-notes); [BingAds-Python-SDK bidding_scheme.py](https://github.com/BingAds/BingAds-Python-SDK/blob/main/openapi_client/models/campaign/bidding_scheme.py)
- **Confirmed: `CAMPAIGN_FIELDS`.** Requesting `MaxConversionValueBiddingScheme,TargetImpressionShareBiddingScheme` in ReturnAdditionalFields matches the documented requirement. — [Campaign](https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign)
- **Missing: `updateAdGroups`.**
  - `if (p.endDate)` offers no way to remove an end date. Microsoft requires sending a date of 2050-01-02 or later.
  - Sending a new `StartDate` after the start has passed returns 1216.
  - Updates to Expired ad groups return 1215.
  - Batch limit 1,000 (OK).
  - — [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Confirmed: date handling.** `msDate` and `isoDate` produce `{Day, Month, Year}` correctly. The dates are interpreted in the campaign time zone, and `createCampaign` defaults to `BrusselsCopenhagenMadridParis`, which is consistent. — [Date](https://learn.microsoft.com/en-us/advertising/campaign-management-service/date); [AdGroup](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroup)
- **Confirmed and limited: `applyCampaignTargets`.**
  - Chunks of 100 match the documented limit.
  - Deleting before adding is right, because DayTime fields can't be updated.
  - `FromMinute`/`ToMinute: 'Zero'` restricts the app to whole hours, although Microsoft allows 15/30/45.
  - Device additions must contain all three devices in the same request, or none are added. The code does not enforce this.
  - Multiplier ranges are −90…900 (device −100…900) and are not validated client-side.
  - Negative location criterions are filtered out on read and can't be written.
  - Campaign-level changes don't affect ad groups that have their own geo, device or schedule criterions.
  - — [AddCampaignCriterions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigncriterions); [DayTimeCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/daytimecriterion); [DeviceCriterion](https://learn.microsoft.com/en-us/advertising/campaign-management-service/devicecriterion); [BidMultiplier](https://learn.microsoft.com/en-us/advertising/campaign-management-service/bidmultiplier)
- **Confirmed: `applyProductPartitionActions`.**
  - The checks for a single ad group, at most 5,000 actions and all-or-nothing handling all match the docs.
  - A subdivision with `CriterionBid: null` and Status being ignored also match.
  - `Amount: a.bid ?? null` on a biddable Unit will fail. "Every Unit must have a bid" applies even under automated bidding, as far as the docs say.
  - Bid-only changes could use `Action: "Update"` (only CriterionBid and DestinationUrl are mutable), which keeps node ids.
  - — [ApplyProductPartitionActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyproductpartitionactions); [AdGroupCriterionAction](https://learn.microsoft.com/en-us/advertising/campaign-management-service/adgroupcriterionaction)
- **`addKeywords`: one risk, one confirmed.** There is no chunking at the 1,000-keyword per-call limit (risk). `Bid: null` when none is given (the ad group bid applies) is correct.
- **`updateKeywords`: correct, but watch null bids.** `Bid: {Amount: p.bid}` is correct. Note that `p.bid === null` *deletes* the keyword bid, which falls back to the ad group default; that is not "no change". — [AddKeywords](https://learn.microsoft.com/en-us/advertising/campaign-management-service/addkeywords); [Keyword](https://learn.microsoft.com/en-us/advertising/campaign-management-service/keyword)
- **Contradicted: retry timing in `client.ts` / `msErrors.ts`.** The code retries on 429/117/207/4204 after 2 seconds and then 4 seconds, and gives up after 3 attempts.
  - 117: Microsoft says wait **60 seconds**.
  - 207: wait until running reports complete.
  - 4204: wait **up to 15 minutes**, and it is Bulk-only.
  - The 2–4 second retries will almost always fail again.
  - `isThrottled` also matches 207 from Customer Management, where it means "Address Line3 invalid".
  - — [Services protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol); [Operation error codes](https://learn.microsoft.com/en-us/advertising/guides/operation-error-codes)
- **Reporting in `reports.ts` / `live.ts`: confirmed, with polling notes.**
  - `ReportTimeZone: 'BrusselsCopenhagenMadridParis'` fixes "today" as documented; without it the default is Pacific.
  - `ExcludeColumnHeaders: false`, `ExcludeReportHeader/Footer: true`, `FormatVersion '2.0'` and `ReturnOnlyCompleteData: false` are all valid.
  - Polling every 2 seconds × 40 (≈80 s), or × 90 for products, is faster than Microsoft's suggested 2–15-minute interval. That is acceptable for small reports, but 207 can occur when many are queued.
  - The download URL expires 5 minutes after it is issued, which the code respects by downloading immediately.
  - Hourly aggregation must use a custom range or Today/Yesterday, and is limited to the 6-month retention.
  - — [Request and Download a Report](https://learn.microsoft.com/en-us/advertising/guides/request-download-report); [Reporting Service Model](https://learn.microsoft.com/en-us/advertising/guides/reports)
- **Confirmed: `batchResult` handling.** Reading PartialErrors by Index, NestedPartialErrors, and null ids as failures matches the documented partial-success model. Treating ApplyProductPartitionActions and listing-group PartialErrors as all-or-nothing also matches. — [Handle service errors](https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions)
- **Confirmed: REST endpoints.** `https://campaign.api.bingads.microsoft.com/CampaignManagement/v13` matches the documented REST URL. The app is REST-only, so the SOAP deprecation on **31 January 2027** doesn't affect it. — [ApplyAssetGroupListingGroupActions](https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyassetgrouplistinggroupactions); [Migrate to REST API](https://learn.microsoft.com/en-us/advertising/guides/migrate-to-rest)

### Inferences
- Priority fixes:
  1. `AssetGroupListingType` in listing groups.
  2. `CriterionType: "Targets"` in `setLocationIntent`.
  3. Leave out empty `Description2` on sitelinks, or require both descriptions.
  4. Don't send a new MaxCpc to non-portfolio campaigns.
  5. A 60-second backoff for 117 and service-aware handling of 207.
  6. A documented way to clear an ad group EndDate (2050-01-02).
- The prompt should replace "15 conversions" with Microsoft's documented 30, and state the 60-second wait for 117.

### Gaps
- None of the code findings were tested against a live account. They are based on documentation and SDK model comparison only.
- Whether the REST service tolerates the unknown `ListingGroupType` field silently, or rejects the call, is unknown.
- Same for `CriterionType: "LocationIntent"` on writes.
