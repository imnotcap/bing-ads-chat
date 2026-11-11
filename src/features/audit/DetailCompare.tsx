/**
 * Inside one campaign: what Google Ads does that Microsoft Advertising does not – excluded
 * products, negative keywords, ad groups and keywords, search terms and ads. One tab at a
 * time, and a tab only reads when it is opened (compare.ts does the comparing).
 *
 * Fixes go to Microsoft only: through the assistant, which shows every change for approval
 * first – or, where it cannot change something yet (product groups), as a list to copy.
 */
import { useMemo, useState } from 'react';
import { Check, Copy, Loader2, Minus, MessageSquare, RefreshCw, TriangleAlert } from '@/components/icons';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { copyText } from '@/components/ui/contextMenu';
import { fmtMoney, fmtNumber, fmtRelative, type DateRange } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/startChat';
import { refreshDetail, useAuditUi, useBingAdGroups, useBingDetail, useBingShown, useGoogleDetail, type CompareTab } from './data';
import { byShown, compareAds, compareExclusions, compareKeywords, compareNegatives, compareSearchTerms, type Condition } from './compare';
import { compareProductTrees, stateText, type GroupDiff, type ItemDiff, type ItemDiffKind, type ItemState } from './productMirror';
import { SHOWN_DAYS, dimensionLabel, type DetailPart, type MatchKind } from './detail';
import type { AuditRow } from './model';
import { googleBidsByHand } from './settings';

/* ---------------------------------- labels ---------------------------------- */

const MATCH: Record<MatchKind, string> = { exact: 'Eksakt', phrase: 'Sætning', broad: 'Bred' };

export const TAB_LABEL: Record<CompareTab, string> = {
  products: 'Produktgrupper',
  negatives: 'Negative søgeord',
  keywords: 'Annoncegrupper og søgeord',
  searchterms: 'Søgetermer',
  ads: 'Annoncer',
};

/** The comparisons that make sense for a kind of campaign. */
export function tabsFor(type: string): CompareTab[] {
  if (type === 'Shopping') return ['products'];
  if (type === 'PerformanceMax') return ['products', 'negatives'];
  if (type === 'Search') return ['negatives', 'keywords', 'searchterms', 'ads'];
  return [];
}

/** Which tab holds the data for an audit step (steps.ts ids). */
export const STEP_TAB: Partial<Record<string, CompareTab>> = {
  shopping: 'products',
  pmax: 'products',
  negatives: 'negatives',
  adgroups: 'keywords',
  keywords: 'keywords',
  searchterms: 'searchterms',
  ads: 'ads',
  landing: 'ads',
};

const pathText = (path: Condition[]) => (path.length ? path.map((c) => `${dimensionLabel(c.dim)}: ${c.value || 'alt andet'}`).join(' › ') : 'Alle produkter');

/* ---------------------------------- parts ---------------------------------- */

function useBoth<P extends DetailPart>(row: AuditRow, part: P, range: DateRange, enabled: boolean) {
  const pmax = row.bing.type === 'PerformanceMax';
  const googleId = row.audit?.googleId ?? null;
  const google = useGoogleDetail(googleId, part, range, pmax, enabled);
  const bing = useBingDetail(row.bing.id, part, range, pmax, enabled);
  return { google, bing, pmax, googleId };
}

function Status({ google, bing }: { google: { isPending: boolean; error: unknown; data?: { error?: string } }; bing: { isPending: boolean; error: unknown } }) {
  const errors = [
    google.error ? `Google Ads: ${errorMessage(google.error)}` : google.data?.error ? `Google Ads (viser seneste kopi): ${google.data.error}` : null,
    bing.error ? `Microsoft Advertising: ${errorMessage(bing.error)}` : null,
  ].filter(Boolean);
  return (
    <>
      {(google.isPending || bing.isPending) && !google.error && !bing.error && (
        <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-muted">
          <Loader2 className="size-3.5 animate-spin" /> Henter fra {google.isPending && bing.isPending ? 'Google og Microsoft' : google.isPending ? 'Google (kun læsning)' : 'Microsoft'} …
        </p>
      )}
      {errors.map((e) => (
        <p key={e} className="flex gap-2 px-4 py-3 text-[13px] leading-relaxed text-negative">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {e}
        </p>
      ))}
    </>
  );
}

/** Most lines one request to the assistant holds – and a line saying so, when there are more (never cut without a word). */
const MAX_IN_ASK = 300;
const capped = <T,>(items: T[], line: (item: T) => string): string[] => [
  ...items.slice(0, MAX_IN_ASK).map(line),
  ...(items.length > MAX_IN_ASK ? [`(Listen er kortet: ${items.length - MAX_IN_ASK} flere er ikke med her. Tag dem i en ny runde bagefter.)`] : []),
];

const ads = (n: number) => `${n} ${n === 1 ? 'annonce' : 'annoncer'}`;

/** The opening line of every request to the assistant: which campaigns, and that Google is not to be touched. */
const intro = (row: AuditRow) =>
  `Audit af Microsoft-kampagnen "${row.bing.name}" (id ${row.bing.id}) mod Google Ads-kampagnen "${row.google?.name ?? ''}". Google Ads er kun læst – der må ikke ændres noget i Google.`;

/* ------------------------------ one table for every tab ------------------------------ */

/** What one platform has: there (✓, with what) or not (–, with why). */
interface Side {
  has: boolean;
  text: string;
  sub?: string;
}

/** fix = Microsoft should change · check = look at it · none = nothing to do. */
type Tone = 'fix' | 'check' | 'none';

interface Line {
  item: string;
  /** Under the item: where (ad group) or its numbers. */
  sub?: string;
  google: Side;
  microsoft: Side;
  todo: string;
}

interface Section {
  id: string;
  /** The filter button: "Mangler i Microsoft". */
  label: string;
  tone: Tone;
  lines: Line[];
  /** The request to the assistant for this section's lines. */
  ask?: () => string;
}

const TONE_CHIP: Record<Tone, string> = {
  fix: 'bg-negative-bg text-negative',
  check: 'bg-warning-bg text-warning',
  none: 'bg-line-2 text-muted',
};

function SideCell({ side }: { side: Side }) {
  return (
    <td className="px-3 py-2 align-top">
      <div className={cn('flex items-start gap-1.5', side.has ? 'text-ink' : 'text-subtle')}>
        {side.has ? <Check className="mt-[3px] size-3 shrink-0 text-positive" /> : <Minus className="mt-[3px] size-3 shrink-0" />}
        <span className="min-w-0 [overflow-wrap:anywhere]">{side.text}</span>
      </div>
      {side.sub && <div className="mt-0.5 pl-[18px] text-[11.5px] leading-snug text-subtle [overflow-wrap:anywhere]">{side.sub}</div>}
    </td>
  );
}

/**
 * The comparison as one table: the item, what Google has, what Microsoft has, and what
 * should happen – with a button per kind of difference that shows only those.
 */
function CompareTable({ sections, same, note }: { sections: Section[]; same?: string; note?: string }) {
  const go = useUi((s) => s.go);
  const withLines = sections.filter((s) => s.lines.length);
  const [picked, setPicked] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const active = withLines.find((s) => s.id === picked) ?? null;
  const shown = active ? [active] : withLines;
  const lines = shown.flatMap((s) => s.lines.map((l) => ({ ...l, tone: s.tone })));
  const FIRST = 15;
  const visible = all ? lines : lines.slice(0, FIRST);
  // Under "Alle": the request, when the sections with something to ask share one.
  const asks = [...new Set(withLines.map((s) => s.ask).filter((a): a is () => string => !!a))];
  const ask = active ? active.ask : asks.length === 1 ? asks[0] : undefined;

  return (
    <div className="pb-2">
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pt-3.5">
        {withLines.length > 1 && (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className={cn('h-7 rounded-full px-3 text-[12px] font-medium transition-colors', !active ? 'bg-ink text-white' : 'bg-line-2 text-ink-2 hover:bg-black/10')}
          >
            Alle <span className="tabular opacity-80">{withLines.reduce((n, s) => n + s.lines.length, 0)}</span>
          </button>
        )}
        {withLines.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setPicked(s.id === picked ? null : s.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors',
              active?.id === s.id ? 'bg-ink text-white' : cn(TONE_CHIP[s.tone], 'hover:brightness-95'),
            )}
          >
            {s.label} <span className="tabular opacity-80">{s.lines.length}</span>
          </button>
        ))}
        {same && <span className="px-1 text-[12px] text-subtle">{same}</span>}
        <span className="flex-1" />
        {lines.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              copyText(lines.map((l) => [l.item, l.google.has ? l.google.text : '–', l.microsoft.has ? l.microsoft.text : '–', l.todo].join('\t')).join('\n'));
              toast.success('Listen er kopieret');
            }}
          >
            <Copy /> Kopiér
          </Button>
        )}
        {ask && (
          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              go('chat');
              startChat(ask(), [], { fresh: true });
            }}
          >
            <MessageSquare /> Bed assistenten rette Microsoft
          </Button>
        )}
      </div>
      {!lines.length ? (
        <p className="flex items-center gap-2 px-4 pb-3 text-[13px] text-ink-2">
          <Check className="size-3.5 text-positive" /> Ingen forskelle.
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-line-2">
          <table className="w-full min-w-[720px] text-[13px]" data-selectable>
            <thead>
              <tr className="bg-[#fafafb] text-left text-[11.5px] font-semibold text-muted">
                <th className="w-[32%] px-4 py-1.5" />
                <th className="w-[22%] px-3 py-1.5">Google</th>
                <th className="w-[22%] px-3 py-1.5">Microsoft</th>
                <th className="px-3 py-1.5">Hvad skal ske</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l, i) => (
                <tr key={i} className="border-t border-line-2">
                  <td className="px-4 py-2 align-top">
                    <div className="font-medium text-ink [overflow-wrap:anywhere]">{l.item}</div>
                    {l.sub && <div className="mt-0.5 text-[11.5px] leading-snug text-subtle [overflow-wrap:anywhere]">{l.sub}</div>}
                  </td>
                  <SideCell side={l.google} />
                  <SideCell side={l.microsoft} />
                  <td className="px-3 py-2 align-top">
                    <span className={cn('inline-block rounded-md px-1.5 py-0.5 text-[12px] font-medium leading-snug', TONE_CHIP[l.tone])}>{l.todo}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lines.length > FIRST && (
        <button type="button" onClick={() => setAll((v) => !v)} className="px-4 py-2 text-[12.5px] font-medium text-brand hover:underline">
          {all ? 'Vis færre' : `Vis alle ${lines.length}`}
        </button>
      )}
      {note && <p className="px-4 pb-2 pt-2 text-[11.5px] leading-relaxed text-subtle">{note}</p>}
    </div>
  );
}

/* ---------------------------------- products ---------------------------------- */

const STATUS_WORD: Record<string, string> = { active: 'Aktiv', paused: 'Pauset' };

/**
 * Shopping: the product groups ad group by ad group – which ad groups exist on one side only,
 * and for every item id what really applies on each side (bid or excluded, on its own or via
 * "alt andet"). The same result reached another way is not a difference.
 */
function ShoppingProductsTab({ row, range, currency }: { row: AuditRow; range: DateRange; currency: string }) {
  const { google, bing } = useBoth(row, 'products', range, true);
  const adGroups = useBingAdGroups(row.bing.id, true);
  const bids = googleBidsByHand(row.google?.bidStrategy);
  const groups = useMemo(
    () =>
      google.data && bing.data && !adGroups.isPending
        ? compareProductTrees(google.data.data, bing.data, { bids, bingGroups: adGroups.data?.map((g) => ({ name: g.name, status: g.status, cpcBid: g.cpcBid ?? null })) })
        : null,
    [google.data, bing.data, adGroups.isPending, adGroups.data, bids],
  );
  if (!groups) return <Status google={google} bing={bing} />;
  const compared = groups.filter((g) => g.status === 'compared');
  const where = (g: GroupDiff) => g.bingGroup ?? g.googleGroup ?? '';
  const side = (s: ItemState) => ({ has: s.via !== 'none', ...stateText(s, currency) });
  const lines = (kind: ItemDiffKind, todo: (d: ItemDiff) => string) =>
    compared.flatMap((g) =>
      g.diffs.filter((d) => d.kind === kind).map((d) => ({ item: d.label, sub: where(g), google: side(d.google), microsoft: side(d.bing), todo: todo(d) })),
    );
  const ask = () =>
    [
      intro(row),
      'Ret produktgrupperne i Microsoft, så de svarer til Google, annoncegruppe for annoncegruppe:',
      ...groups.flatMap((g) => {
        if (g.status === 'missing') return [`- Annoncegruppen "${g.googleGroup}" mangler i Microsoft.`];
        if (g.status === 'empty') return [`- Annoncegruppen "${g.bingGroup}" har ingen produktgrupper i Microsoft (Google har dem).`];
        return [
          ...(g.defaultBid ? [`- ${where(g)}: standardbud – Google ${fmtMoney(g.defaultBid.google, currency, 2)}, Microsoft ${fmtMoney(g.defaultBid.bing, currency, 2)}`] : []),
          ...g.diffs.map((d) => `- ${where(g)}: ${d.label} – Google: ${stateText(d.google, currency).text}, Microsoft: ${stateText(d.bing, currency).text}`),
        ];
      }),
      'Brug match_product_groups_to_google til produktgrupperne (den læser begge træer og bruger Googles bud) – eller edit_product_groups, hvis træet er delt op efter andet end varenummer – og opret manglende annoncegrupper med create_ad_group (på pause). Vis ændringerne til godkendelse, før noget sker.',
    ].join('\n');
  const statusDiffs = compared.filter((g) => g.googleStatus && g.bingStatus && g.googleStatus !== g.bingStatus);
  const split = groups.filter((g) => g.splits);
  return (
    <>
      <Status google={google} bing={bing} />
      {adGroups.error && <p className="px-4 pt-3 text-[12px] text-subtle">Kunne ikke læse Microsofts annoncegrupper – tomme annoncegrupper er ikke talt med.</p>}
      <CompareTable
        same={`${compared.length} annoncegrupper parret · ${compared.reduce((n, g) => n + g.same, 0)} ens`}
        sections={[
          {
            id: 'missing',
            label: 'Annoncegruppe mangler',
            tone: 'fix',
            lines: [
              ...groups
                .filter((g) => g.status === 'missing')
                .map((g) => ({ item: g.googleGroup!, google: { has: true, text: 'Annoncegruppe', sub: STATUS_WORD[g.googleStatus ?? ''] }, microsoft: { has: false, text: 'Mangler' }, todo: 'Opret i Microsoft' })),
              ...groups
                .filter((g) => g.status === 'empty')
                .map((g) => ({ item: g.bingGroup!, google: { has: true, text: 'Produktgrupper' }, microsoft: { has: false, text: 'Ingen produktgrupper', sub: 'viser intet' }, todo: 'Opret produktgrupper som i Google' })),
            ],
            ask,
          },
          { id: 'exclude', label: 'Udelukket i Google, vises i Microsoft', tone: 'fix', lines: lines('exclude', () => 'Udeluk i Microsoft'), ask },
          { id: 'bid_on', label: 'Vises i Google, ikke i Microsoft', tone: 'fix', lines: lines('bid_on', (d) => (d.google.bid ? `Byd ${fmtMoney(d.google.bid, currency, 2)}` : 'Byd på den')), ask },
          { id: 'bid', label: 'Andet bud', tone: 'fix', lines: lines('bid', (d) => `Sæt bud til ${fmtMoney(d.google.bid!, currency, 2)}`), ask },
          {
            id: 'default',
            label: 'Andet standardbud',
            tone: 'check',
            lines: compared
              .filter((g) => g.defaultBid)
              .map((g) => ({
                item: where(g),
                google: { has: true, text: fmtMoney(g.defaultBid!.google, currency, 2) },
                microsoft: { has: true, text: fmtMoney(g.defaultBid!.bing, currency, 2) },
                todo: `Sæt standardbud til ${fmtMoney(g.defaultBid!.google, currency, 2)}`,
              })),
          },
          {
            id: 'status',
            label: 'Anden status',
            tone: 'check',
            lines: statusDiffs.map((g) => ({
              item: where(g),
              google: { has: true, text: STATUS_WORD[g.googleStatus!] ?? g.googleStatus! },
              microsoft: { has: true, text: STATUS_WORD[g.bingStatus!] ?? g.bingStatus! },
              todo: g.googleStatus === 'active' ? 'Aktivér i Microsoft' : 'Sæt på pause i Microsoft',
            })),
          },
          {
            id: 'split',
            label: 'Delt op forskelligt',
            tone: 'check',
            lines: split.map((g) => ({ item: where(g), google: { has: true, text: 'Produktgrupper' }, microsoft: { has: true, text: 'Produktgrupper' }, todo: `${g.splits} Sammenlignet produkt for produkt ovenfor.` })),
          },
          {
            id: 'unsupported',
            label: 'Sammenlign selv',
            tone: 'check',
            lines: groups.filter((g) => g.status === 'unsupported').map((g) => ({ item: where(g), google: { has: true, text: 'Produktgrupper' }, microsoft: { has: true, text: 'Produktgrupper' }, todo: g.reason ?? '' })),
          },
          {
            id: 'extra',
            label: 'Kun i Microsoft',
            tone: 'none',
            lines: groups
              .filter((g) => g.status === 'extra')
              .map((g) => ({ item: g.bingGroup!, google: { has: false, text: 'Findes ikke' }, microsoft: { has: true, text: 'Annoncegruppe', sub: [STATUS_WORD[g.bingStatus ?? ''], g.reason].filter(Boolean).join(' · ') || undefined }, todo: 'Tjek – findes ikke i Google' })),
          },
        ]}
        note={`Pr. annoncegruppe og produkt (varenummer, mærke, produkttype – på alle niveauer): det, der faktisk gælder hver side – eget bud, udelukket, eller via "Alt andet". Bud er produktgruppens eget, ellers annoncegruppens standardbud. Det samme resultat nået på en anden måde er ikke en forskel.${bids ? '' : ' Google byder automatisk i denne kampagne, så buddene sammenlignes ikke.'}`}
      />
    </>
  );
}

function ProductsTab({ row, range }: { row: AuditRow; range: DateRange }) {
  const { google, bing } = useBoth(row, 'products', range, true);
  const shown = useBingShown(row.bing.id, true);
  const r = useMemo(() => (google.data && bing.data ? compareExclusions(google.data.data, bing.data) : null), [google.data, bing.data]);
  // Item ids Microsoft has not shown in the campaign: excluding them changes nothing.
  const split = useMemo(() => (r && shown.data ? byShown(r.missingInBing, shown.data) : null), [r, shown.data]);
  const missing = split?.matter ?? r?.missingInBing ?? [];
  const where = (groups: string[]) => (groups.length ? groups.join(', ') : undefined);
  return (
    <>
      <Status google={google} bing={bing} />
      {shown.isPending && <p className="px-4 pt-3 text-[12px] text-subtle">Tjekker, hvilke produkter Microsoft har vist …</p>}
      {shown.error && <p className="px-4 pt-3 text-[12px] text-subtle">Kunne ikke tjekke, hvilke produkter Microsoft har vist – alle manglende er talt med.</p>}
      {r && (
        <CompareTable
          same={r.covered ? `${r.covered} er ens` : undefined}
          sections={[
            {
              id: 'missing',
              label: 'Mangler i Microsoft',
              tone: 'fix',
              lines: missing.map((g) => ({
                item: pathText(g.path),
                sub: where(g.groups),
                google: { has: true, text: 'Udelukket' },
                microsoft: { has: false, text: 'Ikke udelukket' },
                todo: 'Udeluk i Microsoft',
              })),
            },
            {
              id: 'unshown',
              label: `Vises ikke i Microsoft`,
              tone: 'none',
              lines: (split?.unshown ?? []).map((g) => ({
                item: pathText(g.path),
                sub: where(g.groups),
                google: { has: true, text: 'Udelukket' },
                microsoft: { has: false, text: 'Ikke udelukket', sub: `Ikke vist de seneste ${SHOWN_DAYS} dage` },
                todo: 'Intet – vises ikke',
              })),
            },
            {
              id: 'only',
              label: 'Kun udelukket i Microsoft',
              tone: 'check',
              lines: r.onlyInBing.map((g) => ({
                item: pathText(g.path),
                sub: where(g.groups),
                google: { has: false, text: 'Ikke udelukket' },
                microsoft: { has: true, text: 'Udelukket' },
                todo: 'Tjek – bør den vises?',
              })),
            },
          ]}
          note="Sammenlignet på tværs af annoncegrupper. Shopping: assistenten retter produktgrupperne via Spørg assistenten om 1:1 matchup. Performance Max rettes i Microsoft Advertising."
        />
      )}
    </>
  );
}

/* -------------------------------- negative keywords -------------------------------- */

/** "Microsoft-annoncegruppen X" / "kampagnen" – where a negative belongs in Microsoft. */
const targetText = (t: { kind: 'campaign' } | { kind: 'adgroup'; group: string | null }) =>
  t.kind === 'campaign' ? 'kampagnen' : t.group ? `annoncegruppen "${t.group}"` : 'ingen tilsvarende annoncegruppe i Microsoft';

function NegativesTab({ row, range }: { row: AuditRow; range: DateRange }) {
  const { google, bing } = useBoth(row, 'negatives', range, true);
  const r = useMemo(() => (google.data && bing.data ? compareNegatives(google.data.data, bing.data) : null), [google.data, bing.data]);
  return (
    <>
      <Status google={google} bing={bing} />
      {r && (
        <CompareTable
          same={`${r.covered} er ens${r.weaker ? ` (${r.weaker} som sætning i Microsoft, bred i Google)` : ''}`}
          sections={[
            {
              id: 'missing',
              label: 'Mangler i Microsoft',
              tone: 'fix',
              lines: r.missingInBing.map((n) => ({
                item: n.text,
                google: { has: true, text: MATCH[n.matchType], sub: n.sources.join(' · ') },
                microsoft: { has: false, text: 'Mangler' },
                todo: n.target.kind === 'adgroup' && !n.target.group ? 'Spørg: ingen tilsvarende gruppe' : `Tilføj som ${MATCH[n.suggested].toLowerCase()} på ${targetText(n.target)}`,
              })),
              ask: () =>
                [
                  intro(row),
                  `Disse ${r.missingInBing.length} negative søgeord findes i Google, men mangler i Microsoft-kampagnen. Hvert er med den matchtype og den placering i Microsoft, det skal have – brug præcis dem, og flyt ikke søgeord til en anden annoncegruppe:`,
                  ...capped(r.missingInBing, (n) => `- "${n.text}" – ${MATCH[n.suggested].toLowerCase()} på ${targetText(n.target)} (Google: ${MATCH[n.matchType].toLowerCase()}, ${n.sources.join(', ')})`),
                  'Findes en placering ikke i Microsoft ("ingen tilsvarende annoncegruppe"), så spørg mig, hvor den skal være, i stedet for at gætte. Tjek, at de ikke blokerer søgetermer, der konverterer i Microsoft. Vis ændringerne til godkendelse, før noget sker.',
                ].join('\n'),
            },
            {
              id: 'only',
              label: 'Kun i Microsoft',
              tone: 'none',
              lines: r.onlyInBing.map((n) => ({
                item: n.text,
                google: { has: false, text: 'Mangler' },
                microsoft: { has: true, text: MATCH[n.matchType], sub: n.sources.join(' · ') },
                todo: 'Intet – Microsoft udelukker mere',
              })),
            },
          ]}
          note="Et negativt søgeord på en annoncegruppe er ens, når Microsoft har det på en gruppe med samme eller næsten samme navn. Microsoft har ikke brede negative søgeord – Googles brede foreslås som sætning."
        />
      )}
    </>
  );
}

/* ------------------------------- ad groups and keywords ------------------------------- */

/** `currency`: Google's – the keyword numbers are Google's. */
function KeywordsTab({ row, range, currency }: { row: AuditRow; range: DateRange; currency: string }) {
  const { google, bing } = useBoth(row, 'structure', range, true);
  const bids = googleBidsByHand(row.google?.bidStrategy);
  const r = useMemo(() => (google.data && bing.data ? compareKeywords(google.data.data, bing.data, { bids }) : null), [google.data, bing.data, bids]);
  const status = (s: string) => (s === 'active' ? 'aktivt' : s === 'paused' ? 'pauset' : s);
  const numbers = (m: { clicks: number; conversions: number; spend: number } | null | undefined) =>
    m && (m.clicks > 0 || m.conversions > 0) ? `${fmtNumber(m.clicks)} klik · ${fmtNumber(m.conversions, 1)} konv. · ${fmtMoney(m.spend, currency)}` : undefined;
  return (
    <>
      <Status google={google} bing={bing} />
      {r && (
        <CompareTable
          same={`${r.pairs.filter((p) => p.google && p.bing).length} annoncegrupper parret`}
          sections={[
            {
              id: 'groups',
              label: 'Annoncegruppe mangler',
              tone: 'fix',
              lines: r.pairs
                .filter((p) => p.google && !p.bing)
                .map((p) => ({ item: p.google!.name, google: { has: true, text: 'Annoncegruppe' }, microsoft: { has: false, text: 'Mangler' }, todo: 'Opret i Microsoft' })),
            },
            {
              id: 'missing',
              label: 'Søgeord mangler',
              tone: 'fix',
              lines: r.missingInBing.map((k) => ({
                item: k.text,
                sub: numbers(k.metrics) && `Google: ${numbers(k.metrics)}`,
                google: { has: true, text: MATCH[k.matchType], sub: k.googleGroup },
                microsoft: { has: false, text: 'Mangler' },
                todo: k.bingGroup ? `Tilføj i "${k.bingGroup}"` : 'Spørg: ingen tilsvarende gruppe',
              })),
              ask: () =>
                [
                  intro(row),
                  `Disse ${r.missingInBing.length} aktive søgeord findes i Google, men er ikke i Microsoft-kampagnen i nogen annoncegruppe (mest konverterende først):`,
                  ...capped(
                    r.missingInBing,
                    (k) =>
                      `- "${k.text}" (${MATCH[k.matchType].toLowerCase()}) – Google-gruppe "${k.googleGroup}"${k.bingGroup ? `, læg den i Microsoft-gruppen "${k.bingGroup}"` : ', ingen tilsvarende gruppe i Microsoft'}${k.metrics ? ` – ${fmtNumber(k.metrics.clicks)} klik, ${fmtNumber(k.metrics.conversions, 1)} konv. i Google` : ''}`,
                  ),
                  'Foreslå hvilke der skal tilføjes i Microsoft og med hvilket bud – begrund ud fra Google-tallene og Microsofts egne søgetal. Brug den angivne Microsoft-gruppe; findes den ikke, så spørg mig. Vis ændringerne til godkendelse, før noget sker.',
                ].join('\n'),
            },
            {
              id: 'elsewhere',
              label: 'Anden gruppe eller pauset',
              tone: 'check',
              lines: r.elsewhereInBing.map((k) => ({
                item: k.text,
                google: { has: true, text: 'Aktivt', sub: k.googleGroup },
                microsoft: { has: true, text: k.found.map((f) => `${f.group} (${status(f.status)})`).join(', ') },
                todo: k.found.every((f) => f.status === 'paused') ? 'Aktivér i Microsoft' : 'Tjek gruppen',
              })),
            },
            {
              id: 'bids',
              label: 'Andet bud',
              tone: 'fix',
              lines: r.bidDiffs.map((d) => ({
                item: d.text,
                sub: `${MATCH[d.matchType]} · ${d.bingGroup}`,
                google: { has: true, text: fmtMoney(d.google, currency, 2) },
                microsoft: { has: true, text: fmtMoney(d.bing, currency, 2) },
                todo: `Sæt bud til ${fmtMoney(d.google, currency, 2)}`,
              })),
              ask: () =>
                [
                  intro(row),
                  'Disse søgeord har et andet CPC-bud i Microsoft end i Google (samme annoncegruppe og matchtype):',
                  ...capped(r.bidDiffs, (d) => `- "${d.text}" (${MATCH[d.matchType].toLowerCase()}) i "${d.bingGroup}": Google ${fmtMoney(d.google, currency, 2)}, Microsoft ${fmtMoney(d.bing, currency, 2)}`),
                  'Foreslå de nye bud i Microsoft (Googles bud, medmindre Microsofts egne tal taler imod). Vis ændringerne til godkendelse, før noget sker.',
                ].join('\n'),
            },
            {
              id: 'pausedgoogle',
              label: 'Pauset i Google, aktivt i Microsoft',
              tone: 'fix',
              lines: r.pausedInGoogle.map((k) => ({
                item: k.text,
                sub: k.bingGroup,
                google: { has: true, text: 'Pauset', sub: MATCH[k.matchType] },
                microsoft: { has: true, text: 'Aktivt' },
                todo: 'Sæt på pause i Microsoft?',
              })),
            },
            {
              id: 'groupstatus',
              label: 'Annoncegruppe med anden status',
              tone: 'check',
              lines: r.pairs
                .filter((p) => p.google && p.bing && p.google.status !== p.bing.status)
                .map((p) => ({
                  item: p.bing!.name,
                  google: { has: true, text: STATUS_WORD[p.google!.status] ?? p.google!.status },
                  microsoft: { has: true, text: STATUS_WORD[p.bing!.status] ?? p.bing!.status },
                  todo: p.google!.status === 'active' ? 'Aktivér i Microsoft' : 'Sæt på pause i Microsoft',
                })),
            },
            {
              id: 'match',
              label: 'Anden matchtype',
              tone: 'check',
              lines: r.matchTypeDiffs.map((d) => ({
                item: d.text,
                google: { has: true, text: d.google.map((m) => MATCH[m]).join(', ') },
                microsoft: { has: true, text: d.bing.map((m) => MATCH[m]).join(', '), sub: d.bingGroup },
                todo: 'Tjek matchtypen',
              })),
            },
            {
              id: 'only',
              label: 'Kun i Microsoft',
              tone: 'none',
              lines: [
                ...r.pairs
                  .filter((p) => !p.google && p.bing)
                  .map((p) => ({ item: p.bing!.name, google: { has: false, text: 'Mangler' }, microsoft: { has: true, text: 'Annoncegruppe' }, todo: 'Intet' })),
                ...r.onlyInBing.map((k) => ({ item: k.text, google: { has: false, text: 'Mangler' }, microsoft: { has: true, text: MATCH[k.matchType], sub: k.bingGroup }, todo: 'Intet' })),
              ],
            },
          ]}
          note={`Aktive søgeord sammenlignes: findes de, matchtype, bud${bids ? '' : ' (ikke her – Google byder automatisk)'} og status. Bud er søgeordets eget, ellers annoncegruppens. Tallene er Googles for perioden. Grupper parres efter navn – en omdøbt gruppe står som manglende, og dens søgeord under Anden gruppe.`}
        />
      )}
    </>
  );
}

/* ---------------------------------- search terms ---------------------------------- */

function SearchTermsTab({ row, range, bingCurrency, googleCurrency }: { row: AuditRow; range: DateRange; bingCurrency: string; googleCurrency: string }) {
  const currency = bingCurrency;
  const terms = useBoth(row, 'searchterms', range, true);
  const negatives = useBoth(row, 'negatives', range, true);
  const ready = terms.google.data && terms.bing.data && negatives.google.data && negatives.bing.data;
  const r = useMemo(
    () => (ready ? compareSearchTerms(terms.google.data!.data, terms.bing.data!, negatives.google.data!.data.negatives, negatives.bing.data!.negatives) : null),
    [ready, terms.google.data, terms.bing.data, negatives.google.data, negatives.bing.data],
  );
  return (
    <>
      <Status google={terms.google} bing={terms.bing} />
      <Status google={negatives.google} bing={negatives.bing} />
      {r && (
        <CompareTable
          sections={[
            {
              id: 'paid',
              label: 'Betalt i Microsoft, udelukket i Google',
              tone: 'fix',
              lines: r.excludedInGoogleOnly.map((t) => ({
                item: t.term,
                google: { has: true, text: 'Udelukket', sub: `"${t.negative.text}" (${MATCH[t.negative.matchType].toLowerCase()})` },
                microsoft: { has: true, text: fmtMoney(t.spend, currency), sub: `${fmtNumber(t.clicks)} klik · ${fmtNumber(t.conversions, 1)} konv.` },
                todo: t.conversions > 0 ? 'Tjek – konverterer i Microsoft' : 'Udeluk i Microsoft',
              })),
              ask: () =>
                [
                  intro(row),
                  `Disse søgetermer har kostet penge i Microsoft i perioden ${range.from} – ${range.to}, men Google udelukker dem med et negativt søgeord, som Microsoft ikke har:`,
                  ...capped(r.excludedInGoogleOnly, (t) => `- "${t.term}": ${fmtMoney(t.spend, currency)}, ${fmtNumber(t.clicks)} klik, ${fmtNumber(t.conversions, 1)} konv. – Google-negativ "${t.negative.text}" (${MATCH[t.negative.matchType].toLowerCase()})`),
                  'Foreslå de negative søgeord, Microsoft-kampagnen skal have for at stoppe dem – men ikke for termer, der konverterer i Microsoft. Vis ændringerne til godkendelse, før noget sker.',
                ].join('\n'),
            },
            {
              id: 'converting',
              label: 'Konverterer kun i Google',
              tone: 'check',
              lines: r.convertingOnlyInGoogle.map((t) => ({
                item: t.term,
                google: { has: true, text: `${fmtNumber(t.conversions, 1)} konv.`, sub: `${fmtMoney(t.revenue, googleCurrency)} · ${fmtNumber(t.clicks)} klik` },
                microsoft: { has: false, text: 'Ikke i rapporten' },
                todo: 'Overvej som søgeord',
              })),
              ask: () =>
                [
                  intro(row),
                  `Disse søgetermer gav konverteringer i Google i perioden ${range.from} – ${range.to}, men står ikke i Microsofts søgetermsrapport for kampagnen. Det betyder ikke nødvendigvis, at annoncerne ikke blev vist – Microsoft skjuler søgetermer med meget lav volumen, og Google gør det samme:`,
                  ...capped(r.convertingOnlyInGoogle, (t) => `- "${t.term}": ${fmtNumber(t.conversions, 1)} konv., ${fmtMoney(t.revenue, googleCurrency)} i værdi, ${fmtNumber(t.clicks)} klik i Google`),
                  'Vurdér hvilke der bør blive søgeord i Microsoft (matchtype og annoncegruppe), og tjek Microsofts søgetal for dem. Vis ændringerne til godkendelse, før noget sker.',
                ].join('\n'),
            },
          ]}
          note={`Perioden ${range.from} – ${range.to}. Begge platforme skjuler søgetermer med meget lav volumen – "ikke i rapporten" betyder ikke, at annoncerne ikke blev vist.`}
        />
      )}
    </>
  );
}

/* ------------------------------------- ads ------------------------------------- */

function AdsTab({ row, range }: { row: AuditRow; range: DateRange }) {
  const { google, bing } = useBoth(row, 'ads', range, true);
  const diffs = useMemo(() => (google.data && bing.data ? compareAds(google.data.data, bing.data) : null), [google.data, bing.data]);
  const worth = diffs?.filter((d) => !d.bingGroup || !d.googleGroup || (d.googleAds && !d.bingAds) || d.missingHeadlines.length || d.missingDescriptions.length || d.onlyBingHeadlines.length || d.onlyBingDescriptions.length || d.urlsOnlyGoogle.length || d.urlsOnlyBing.length) ?? [];
  const ask = () =>
    [
      intro(row),
      'Forskelle i annoncerne pr. annoncegruppe (kun aktive annoncer):',
      ...capped(worth, (d) =>
        [
          `- Google "${d.googleGroup ?? '–'}" / Microsoft "${d.bingGroup ?? 'mangler'}": ${ads(d.googleAds)} i Google, ${ads(d.bingAds)} i Microsoft.`,
          d.missingHeadlines.length ? `  Overskrifter kun i Google: ${d.missingHeadlines.map((h) => `"${h}"`).join(', ')}` : '',
          d.missingDescriptions.length ? `  Beskrivelser kun i Google: ${d.missingDescriptions.map((h) => `"${h}"`).join(', ')}` : '',
          d.onlyBingHeadlines.length ? `  Overskrifter kun i Microsoft: ${d.onlyBingHeadlines.map((h) => `"${h}"`).join(', ')}` : '',
          d.onlyBingDescriptions.length ? `  Beskrivelser kun i Microsoft: ${d.onlyBingDescriptions.map((h) => `"${h}"`).join(', ')}` : '',
          d.urlsOnlyGoogle.length ? `  Landingssider kun i Google: ${d.urlsOnlyGoogle.join(', ')}` : '',
          d.urlsOnlyBing.length ? `  Landingssider kun i Microsoft: ${d.urlsOnlyBing.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      ),
      'Foreslå hvordan Microsoft-annoncerne skal opdateres (overskrifter, beskrivelser, landingssider) – Microsofts tegngrænser gælder. Vis ændringerne til godkendelse, før noget sker.',
    ].join('\n');
  const group = (d: (typeof worth)[number]) => d.bingGroup ?? d.googleGroup ?? '';
  return (
    <>
      <Status google={google} bing={bing} />
      {diffs && (
        <CompareTable
          sections={[
            {
              id: 'groups',
              label: 'Annoncegruppe mangler',
              tone: 'fix',
              lines: [
                ...worth
                  .filter((d) => !d.bingGroup)
                  .map((d) => ({ item: d.googleGroup ?? '', google: { has: true, text: ads(d.googleAds) }, microsoft: { has: false, text: 'Ingen gruppe' }, todo: 'Opret annoncegruppen' })),
                ...worth
                  .filter((d) => d.bingGroup && d.googleGroup && d.googleAds && !d.bingAds)
                  .map((d) => ({ item: group(d), google: { has: true, text: ads(d.googleAds) }, microsoft: { has: false, text: 'Ingen aktive annoncer' }, todo: 'Opret eller aktivér en annonce' })),
              ],
              ask,
            },
            {
              id: 'texts',
              label: 'Tekster kun i Google',
              tone: 'fix',
              lines: worth
                .filter((d) => d.bingGroup)
                .flatMap((d) => [
                  ...d.missingHeadlines.map((h) => ({ item: h, sub: group(d), google: { has: true, text: 'Overskrift' }, microsoft: { has: false, text: 'Mangler' }, todo: 'Tilføj overskrift' })),
                  ...d.missingDescriptions.map((h) => ({ item: h, sub: group(d), google: { has: true, text: 'Beskrivelse' }, microsoft: { has: false, text: 'Mangler' }, todo: 'Tilføj beskrivelse' })),
                ]),
              ask,
            },
            {
              id: 'bingtexts',
              label: 'Tekster kun i Microsoft',
              tone: 'check',
              lines: worth
                .filter((d) => d.googleGroup)
                .flatMap((d) => [
                  ...d.onlyBingHeadlines.map((h) => ({ item: h, sub: group(d), google: { has: false, text: 'Bruges ikke' }, microsoft: { has: true, text: 'Overskrift' }, todo: 'Tjek – ikke i Google' })),
                  ...d.onlyBingDescriptions.map((h) => ({ item: h, sub: group(d), google: { has: false, text: 'Bruges ikke' }, microsoft: { has: true, text: 'Beskrivelse' }, todo: 'Tjek – ikke i Google' })),
                ]),
              ask,
            },
            {
              id: 'onlybing',
              label: 'Kun i Microsoft',
              tone: 'none',
              lines: worth
                .filter((d) => !d.googleGroup)
                .map((d) => ({ item: d.bingGroup ?? '', google: { has: false, text: 'Findes ikke' }, microsoft: { has: true, text: ads(d.bingAds) }, todo: 'Tjek – findes ikke i Google' })),
            },
            {
              id: 'urls',
              label: 'Anden landingsside',
              tone: 'check',
              lines: worth.flatMap((d) => [
                ...d.urlsOnlyGoogle.map((u) => ({ item: u, sub: group(d), google: { has: true, text: 'Landingsside' }, microsoft: { has: false, text: 'Bruges ikke' }, todo: 'Brug samme side?' })),
                ...d.urlsOnlyBing.map((u) => ({ item: u, sub: group(d), google: { has: false, text: 'Bruges ikke' }, microsoft: { has: true, text: 'Landingsside' }, todo: 'Tjek siden' })),
              ]),
              ask,
            },
          ]}
          note="Kun aktive annoncer. Landingssider sammenlignes uden sporingsparametre."
        />
      )}
    </>
  );
}

/* ---------------------------------- the card ---------------------------------- */

const PART_OF: Record<CompareTab, DetailPart[]> = { products: ['products'], negatives: ['negatives'], keywords: ['structure'], searchterms: ['searchterms', 'negatives'], ads: ['ads'] };

export function DetailCompare({ row, range, bingCurrency, googleCurrency }: { row: AuditRow; range: DateRange; bingCurrency: string; googleCurrency: string }) {
  const tabs = tabsFor(row.bing.type);
  const picked = useAuditUi((s) => s.tab);
  const setTab = useAuditUi((s) => s.setTab);
  const tab = picked && tabs.includes(picked) ? picked : tabs[0];
  const [refreshing, setRefreshing] = useState(false);
  const google = useGoogleDetail(row.audit?.googleId, tab ? PART_OF[tab][0]! : 'negatives', range, row.bing.type === 'PerformanceMax', !!tab);

  if (!tabs.length) return null;
  const matched = !!row.audit?.googleId && !!row.google;

  const refresh = async () => {
    setRefreshing(true);
    try {
      for (const part of PART_OF[tab!]) await refreshDetail(row.audit?.googleId, row.bing.id, part, range, row.bing.type === 'PerformanceMax');
    } catch (e) {
      toast.error('Kunne ikke hente igen', { description: errorMessage(e) });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div id="audit-compare" className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[14px] font-medium text-ink">Sammenlign indholdet</h3>
        {google.data && <span className="text-[12px] text-subtle">Google hentet {fmtRelative(google.data.fetchedAt)}</span>}
        <span className="flex-1" />
        {matched && (
          <Button variant="ghost" size="xs" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && 'animate-spin')} /> Hent igen
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line-2 px-3 py-2.5">
          <Segmented layoutId="audit-compare-tab" size="sm" value={tab!} onChange={(t: CompareTab) => setTab(t)} options={tabs.map((t) => ({ value: t, label: TAB_LABEL[t] }))} />
        </div>
        {!matched ? (
          <p className="px-4 py-4 text-[13px] text-muted">Vælg kampagnens Google-modpart ovenfor for at sammenligne indholdet.</p>
        ) : tab === 'products' ? (
          row.bing.type === 'Shopping' ? (
            <ShoppingProductsTab key={row.bing.id} row={row} range={range} currency={bingCurrency} />
          ) : (
            <ProductsTab key={row.bing.id} row={row} range={range} />
          )
        ) : tab === 'negatives' ? (
          <NegativesTab key={row.bing.id} row={row} range={range} />
        ) : tab === 'keywords' ? (
          <KeywordsTab key={row.bing.id} row={row} range={range} currency={googleCurrency} />
        ) : tab === 'searchterms' ? (
          <SearchTermsTab key={row.bing.id} row={row} range={range} bingCurrency={bingCurrency} googleCurrency={googleCurrency} />
        ) : (
          <AdsTab key={row.bing.id} row={row} range={range} />
        )}
      </div>
    </div>
  );
}
