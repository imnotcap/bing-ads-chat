/**
 * What a failed tool call means and what to do instead – added to the error the assistant
 * gets (the user sees Microsoft's own message). Known Microsoft Advertising errors that the
 * assistant otherwise answers with a retry or a wrong follow-up suggestion.
 */
const HINTS: [RegExp, string][] = [
  [/AdGroupExpired|expired ad group/i, 'The ad group has passed its end date: it shows nothing and nothing in it can be changed. Do not retry and do not propose pausing, deleting or cleaning it up – there is nothing to fix. Only if the user wants to reuse it: set_campaign_period with a new end date.'],
  [/\((105|106)\)|InvalidCredentials|UserIsNotAuthorized/i, 'The connection was refused. Stop: tell the user to check the Microsoft connection under Indstillinger → Forbindelser. Retrying will not help.'],
  [/\((117|207|4204)\)|CallRateExceeded|ConcurrentRequestOverLimit/i, 'Microsoft is throttling. Wait and try this call once more later in the turn; if it fails again, tell the user to try in a few minutes.'],
  [/\(1542\)|Duplicate(Keyword|Entity)|already exists/i, 'It already exists. Nothing to add – read the current list and continue with what is missing.'],
  [/EntityNotExist|InvalidId|does not exist|findes ikke/i, 'The id is not valid (deleted, or from another campaign). Read the list again (find_campaigns_and_ad_groups / list_* tools) and use the id from that result – never guess one.'],
  [/BidAmountsLessThanFloorPrice|BidsAmountsGreaterThanCeilingPrice|below the minimum|floor price/i, 'The bid is outside what Microsoft allows. Use the minimum bid from the spending rules or the value Microsoft names.'],
  [/Editorial|Disapproved|policy/i, 'Microsoft\'s editorial rules stopped it. Rewrite the text or keyword to avoid the term Microsoft names – the same text will be refused again.'],
  [/BLOCKED by the user's spending rules|REJECTED this change/i, ''],
];

export function errorHint(message: string): string {
  for (const [pattern, hint] of HINTS) if (pattern.test(message)) return hint;
  return 'Do not repeat the same call unchanged: explain to the user what failed in plain Danish and propose what does work.';
}

/** The error as the assistant gets it: Microsoft's message, then what it means. */
export function withHint(message: string): string {
  const hint = errorHint(message);
  return hint && !message.includes(hint) ? `${message}\n\nWhat this means: ${hint}` : message;
}

/** One call, as a key: the same tool with the same input. */
export function callKey(name: string, input: unknown): string {
  return `${name}:${JSON.stringify(input)}`;
}
