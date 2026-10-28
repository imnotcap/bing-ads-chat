/**
 * Inside one campaign: what Google Ads does that Microsoft Advertising does not – excluded
 * products, negative keywords, ad groups and keywords, search terms and ads. One tab at a
 * time, and a tab only reads when it is opened (compare.ts does the comparing).
 *
 * Fixes go to Microsoft only: through the assistant, which shows every change for approval
 * first – or, where it cannot change something yet (product groups), as a list to copy.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Copy, Loader2, MessageSquare, RefreshCw, TriangleAlert } from '@/components/icons';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Badge, Segmented } from '@/components/ui/controls';
import { copyText } from '@/components/ui/contextMenu';
import { fmtMoney, fmtNumber, fmtRelative, type DateRange } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/startChat';
import { refreshDetail, useAuditUi, useBingDetail, useGoogleDetail, type CompareTab } from './data';
import { compareAds, compareExclusions, compareKeywords, compareNegatives, compareSearchTerms, type Condition } from './compare';
import { dimensionLabel, type DetailPart, type MatchKind } from './detail';
import type { AuditRow } from './model';

/* ---------------------------------- labels ---------------------------------- */

const MATCH: Record<MatchKind, string> = { exact: 'Eksakt', phrase: 'Sætning', broad: 'Bred' };

export const TAB_LABEL: Record<CompareTab, string> = {
  products: 'Udelukkede produkter',
  negatives: 'Negative søgeord',
  keywords: 'Annoncegrupper og søgeord',
  searchterms: 'Søgetermer',
  ads: 'Annoncer',
};

/** The comparisons that make sense for a kind of campaign. */
export function tabsFor(type: string): CompareTab[] {
  if (type === 'Shopping') return ['products', 'negatives', 'searchterms'];
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

/** A heading line with the count, and the actions for the list under it. */
function ListHead({ title, count, tone = 'neutral', copy, ask }: { title: string; count: number; tone?: 'negative' | 'neutral' | 'positive'; copy?: () => string; ask?: () => string }) {
  const go = useUi((s) => s.go);
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-4">
      <h4 className="text-[13.5px] font-medium text-ink">{title}</h4>
      <Badge tone={count === 0 ? 'positive' : tone}>{count}</Badge>
      <span className="flex-1" />
      {copy && count > 0 && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            copyText(copy());
            toast.success('Listen er kopieret');
          }}
        >
          <Copy /> Kopiér
        </Button>
      )}
      {ask && count > 0 && (
        <Button
          variant="secondary"
          size="xs"
          onClick={() => {
            go('chat');
            startChat(ask());
          }}
        >
          <MessageSquare /> Bed assistenten om forslag til Microsoft
        </Button>
      )}
    </div>
  );
}

/** A list that shows its first rows and the rest on request. */
function Rows<T>({ items, render, first = 12, empty }: { items: T[]; render: (item: T, i: number) => ReactNode; first?: number; empty: string }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="px-4 pb-4 text-[12.5px] text-subtle">{empty}</p>;
  const shown = all ? items : items.slice(0, first);
  return (
    <div className="pb-2">
      <ul className="divide-y divide-line-2 border-y border-line-2">{shown.map((it, i) => render(it, i))}</ul>
      {items.length > first && (
        <button type="button" onClick={() => setAll((v) => !v)} className="px-4 py-2 text-[12.5px] font-medium text-brand hover:underline">
          {all ? 'Vis færre' : `Vis alle ${items.length}`}
        </button>
      )}
    </div>
  );
}

const ads = (n: number) => `${n} ${n === 1 ? 'annonce' : 'annoncer'}`;

const li = 'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-[13px]';

/** The opening line of every request to the assistant: which campaigns, and that Google is not to be touched. */
const intro = (row: AuditRow) =>
  `Audit af Microsoft-kampagnen "${row.bing.name}" (id ${row.bing.id}) mod Google Ads-kampagnen "${row.google?.name ?? ''}". Google Ads er kun læst – der må ikke ændres noget i Google.`;

/* ---------------------------------- products ---------------------------------- */

function ProductsTab({ row, range }: { row: AuditRow; range: DateRange }) {
  const { google, bing } = useBoth(row, 'products', range, true);
  const r = useMemo(() => (google.data && bing.data ? compareExclusions(google.data.data, bing.data) : null), [google.data, bing.data]);
  return (
    <>
      <Status google={google} bing={bing} />
      {r && (
        <>
          <p className="px-4 pt-3 text-[13px] text-ink-2">
            Google udelukker <b>{r.googleTotal}</b> {r.googleTotal === 1 ? 'produktgruppe' : 'produktgrupper'} i kampagnen. <b>{r.covered}</b> er også udelukket i Microsoft
            {r.missingInBing.length ? (
              <>
                {' '}
                – <b className="text-negative">{r.missingInBing.length} mangler</b>.
              </>
            ) : (
              '.'
            )}
          </p>
          <ListHead
            title="Udelukket i Google, ikke i Microsoft"
            count={r.missingInBing.length}
            tone="negative"
            copy={() => r.missingInBing.map((g) => `${pathText(g.path)}\t${g.groups.join(', ')}`).join('\n')}
          />
          <Rows
            items={r.missingInBing}
            empty="Alt, Google udelukker, er også udelukket i Microsoft."
            render={(g, i) => (
              <li key={i} className={li}>
                <span className="font-medium text-ink">{pathText(g.path)}</span>
                <span className="text-[12px] text-subtle">Google: {g.groups.join(', ') || '–'}</span>
                {!g.comparable && <Badge tone="warning">Tjek selv – Google angiver kategorier med nummer</Badge>}
              </li>
            )}
          />
          <ListHead title="Kun udelukket i Microsoft" count={r.onlyInBing.length} copy={() => r.onlyInBing.map((g) => pathText(g.path)).join('\n')} />
          <Rows
            items={r.onlyInBing}
            first={6}
            empty="Microsoft udelukker ikke noget, Google ikke også udelukker."
            render={(g, i) => (
              <li key={i} className={li}>
                <span className="text-ink-2">{pathText(g.path)}</span>
                <span className="text-[12px] text-subtle">Microsoft: {g.groups.join(', ')}</span>
              </li>
            )}
          />
          <p className="px-4 pb-4 text-[12px] text-subtle">
            Produktgrupper rettes i Microsoft Advertising under kampagnens produktgrupper – assistenten kan ikke ændre dem endnu. Sammenlignet på tværs af annoncegrupper.
          </p>
        </>
      )}
    </>
  );
}

/* -------------------------------- negative keywords -------------------------------- */

function NegativesTab({ row, range }: { row: AuditRow; range: DateRange }) {
  const { google, bing } = useBoth(row, 'negatives', range, true);
  const r = useMemo(() => (google.data && bing.data ? compareNegatives(google.data.data, bing.data) : null), [google.data, bing.data]);
  return (
    <>
      <Status google={google} bing={bing} />
      {r && (
        <>
          <p className="px-4 pt-3 text-[13px] text-ink-2">
            Google har <b>{r.googleTotal}</b> negative søgeord på kampagnen (inkl. annoncegrupper og delte lister). <b>{r.covered}</b> dækkes også i Microsoft
            {r.missingInBing.length ? (
              <>
                {' '}
                – <b className="text-negative">{r.missingInBing.length} mangler</b>.
              </>
            ) : (
              '.'
            )}
          </p>
          <ListHead
            title="I Google, mangler i Microsoft"
            count={r.missingInBing.length}
            tone="negative"
            copy={() => r.missingInBing.map((n) => `${n.text}\t${MATCH[n.suggested]}`).join('\n')}
            ask={() =>
              [
                intro(row),
                'Disse negative søgeord findes i Google, men mangler i Microsoft-kampagnen:',
                ...r.missingInBing.slice(0, 150).map((n) => `- "${n.text}" – tilføj som ${MATCH[n.suggested].toLowerCase()} (Google: ${MATCH[n.matchType].toLowerCase()}, ${n.sources.join(', ')})`),
                'Foreslå at tilføje dem i Microsoft – på kampagnen, eller på den tilsvarende annoncegruppe hvor de i Google kun står på en annoncegruppe. Tjek først, at de ikke blokerer søgetermer, der konverterer i Microsoft. Vis ændringerne til godkendelse, før noget sker.',
              ].join('\n')
            }
          />
          <Rows
            items={r.missingInBing}
            empty="Alle Googles negative søgeord dækkes også i Microsoft."
            render={(n, i) => (
              <li key={i} className={li}>
                <span className="font-medium text-ink">{n.text}</span>
                <span className="text-[12px] text-muted">
                  Google: {MATCH[n.matchType]} → Microsoft: {MATCH[n.suggested]}
                </span>
                <span className="text-[12px] text-subtle">{n.sources.join(' · ')}</span>
              </li>
            )}
          />
          <ListHead title="Kun i Microsoft" count={r.onlyInBing.length} copy={() => r.onlyInBing.map((n) => n.text).join('\n')} />
          <Rows
            items={r.onlyInBing}
            first={6}
            empty="Microsoft har ingen negative søgeord, Google ikke også har."
            render={(n, i) => (
              <li key={i} className={li}>
                <span className="text-ink-2">{n.text}</span>
                <span className="text-[12px] text-subtle">
                  {MATCH[n.matchType]} · {n.sources.join(' · ')}
                </span>
              </li>
            )}
          />
          <p className="px-4 pb-4 text-[12px] text-subtle">Microsoft har ikke brede negative søgeord – Googles brede foreslås som sætning, der kun stopper ordene i samme rækkefølge.</p>
        </>
      )}
    </>
  );
}

/* ------------------------------- ad groups and keywords ------------------------------- */

/** `currency`: Google's – the keyword numbers are Google's. */
function KeywordsTab({ row, range, currency }: { row: AuditRow; range: DateRange; currency: string }) {
  const { google, bing } = useBoth(row, 'structure', range, true);
  const r = useMemo(() => (google.data && bing.data ? compareKeywords(google.data.data, bing.data) : null), [google.data, bing.data]);
  const groupsOnlyGoogle = r?.pairs.filter((p) => p.google && !p.bing) ?? [];
  const groupsOnlyBing = r?.pairs.filter((p) => !p.google && p.bing) ?? [];
  return (
    <>
      <Status google={google} bing={bing} />
      {r && (
        <>
          <p className="px-4 pt-3 text-[13px] text-ink-2">
            <b>{r.pairs.filter((p) => p.google && p.bing).length}</b> annoncegrupper er parret efter navn. {groupsOnlyGoogle.length > 0 && <b className="text-negative">{groupsOnlyGoogle.length} findes kun i Google. </b>}
            {groupsOnlyBing.length > 0 && <span>{groupsOnlyBing.length} findes kun i Microsoft.</span>}
          </p>
          {groupsOnlyGoogle.length > 0 && (
            <>
              <ListHead title="Annoncegrupper kun i Google" count={groupsOnlyGoogle.length} tone="negative" copy={() => groupsOnlyGoogle.map((p) => p.google!.name).join('\n')} />
              <Rows items={groupsOnlyGoogle} first={6} empty="" render={(p, i) => <li key={i} className={li}>{p.google!.name}</li>} />
            </>
          )}
          <ListHead
            title="Aktive søgeord i Google, mangler i Microsoft"
            count={r.missingInBing.length}
            tone="negative"
            copy={() => r.missingInBing.map((k) => `${k.text}\t${MATCH[k.matchType]}\t${k.googleGroup}`).join('\n')}
            ask={() =>
              [
                intro(row),
                'Disse aktive søgeord findes i Google, men mangler i Microsoft-kampagnen (mest konverterende først):',
                ...r.missingInBing
                  .slice(0, 150)
                  .map(
                    (k) =>
                      `- "${k.text}" (${MATCH[k.matchType].toLowerCase()}) – Google-gruppe "${k.googleGroup}"${k.bingGroup ? `, Microsoft-gruppe "${k.bingGroup}"` : ', ingen tilsvarende gruppe i Microsoft'}${k.metrics ? ` – ${fmtNumber(k.metrics.clicks)} klik, ${fmtNumber(k.metrics.conversions, 1)} konv. i Google` : ''}`,
                  ),
                'Foreslå hvilke der skal tilføjes i Microsoft, i hvilken annoncegruppe og med hvilket bud – begrund ud fra Google-tallene og Microsofts egne søgetal. Vis ændringerne til godkendelse, før noget sker.',
              ].join('\n')
            }
          />
          <Rows
            items={r.missingInBing}
            empty="Microsoft har alle Googles aktive søgeord."
            render={(k, i) => (
              <li key={i} className={li}>
                <span className="font-medium text-ink">{k.text}</span>
                <span className="text-[12px] text-muted">{MATCH[k.matchType]}</span>
                <span className="text-[12px] text-subtle">
                  {k.googleGroup}
                  {k.bingGroup ? ` → ${k.bingGroup}` : ' → ingen gruppe i Microsoft'}
                </span>
                {k.metrics && (k.metrics.clicks > 0 || k.metrics.conversions > 0) && (
                  <span className="ml-auto text-[12px] tabular text-ink-2">
                    {fmtNumber(k.metrics.clicks)} klik · {fmtNumber(k.metrics.conversions, 1)} konv. · {fmtMoney(k.metrics.spend, currency)}
                  </span>
                )}
              </li>
            )}
          />
          <ListHead title="Samme søgeord, anden matchtype" count={r.matchTypeDiffs.length} copy={() => r.matchTypeDiffs.map((d) => `${d.text}\tGoogle: ${d.google.map((m) => MATCH[m]).join('/')}\tMicrosoft: ${d.bing.map((m) => MATCH[m]).join('/')}`).join('\n')} />
          <Rows
            items={r.matchTypeDiffs}
            first={8}
            empty="Matchtyperne er de samme."
            render={(d, i) => (
              <li key={i} className={li}>
                <span className="font-medium text-ink">{d.text}</span>
                <span className="text-[12px] text-muted">
                  Google: {d.google.map((m) => MATCH[m]).join(', ')} · Microsoft: {d.bing.map((m) => MATCH[m]).join(', ')}
                </span>
                <span className="text-[12px] text-subtle">{d.bingGroup}</span>
              </li>
            )}
          />
          <ListHead title="Søgeord kun i Microsoft" count={r.onlyInBing.length} copy={() => r.onlyInBing.map((k) => `${k.text}\t${MATCH[k.matchType]}\t${k.bingGroup}`).join('\n')} />
          <Rows
            items={r.onlyInBing}
            first={6}
            empty="Microsoft har ingen søgeord, Google ikke også har."
            render={(k, i) => (
              <li key={i} className={li}>
                <span className="text-ink-2">{k.text}</span>
                <span className="text-[12px] text-subtle">
                  {MATCH[k.matchType]} · {k.bingGroup}
                </span>
              </li>
            )}
          />
          <p className="px-4 pb-4 text-[12px] text-subtle">Søgeordenes tal er Googles for perioden. Pausede søgeord i Google tæller ikke med.</p>
        </>
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
    () => (ready ? compareSearchTerms(terms.google.data!.data, terms.bing.data!, negatives.google.data!.data, negatives.bing.data!) : null),
    [ready, terms.google.data, terms.bing.data, negatives.google.data, negatives.bing.data],
  );
  return (
    <>
      <Status google={terms.google} bing={terms.bing} />
      <Status google={negatives.google} bing={negatives.bing} />
      {r && (
        <>
          <ListHead
            title="Betalt i Microsoft, men udelukket i Google"
            count={r.excludedInGoogleOnly.length}
            tone="negative"
            copy={() => r.excludedInGoogleOnly.map((t) => `${t.term}\t${fmtMoney(t.spend, currency)}\t${t.negative.text}`).join('\n')}
            ask={() =>
              [
                intro(row),
                `Disse søgetermer har kostet penge i Microsoft i perioden ${range.from} – ${range.to}, men Google udelukker dem med et negativt søgeord, som Microsoft ikke har:`,
                ...r.excludedInGoogleOnly.slice(0, 150).map((t) => `- "${t.term}": ${fmtMoney(t.spend, currency)}, ${fmtNumber(t.clicks)} klik, ${fmtNumber(t.conversions, 1)} konv. – Google-negativ "${t.negative.text}" (${MATCH[t.negative.matchType].toLowerCase()})`),
                'Foreslå de negative søgeord, Microsoft-kampagnen skal have for at stoppe dem – men ikke for termer, der konverterer i Microsoft. Vis ændringerne til godkendelse, før noget sker.',
              ].join('\n')
            }
          />
          <Rows
            items={r.excludedInGoogleOnly}
            empty="Microsoft betaler ikke for søgetermer, Google udelukker."
            render={(t, i) => (
              <li key={i} className={li}>
                <span className="font-medium text-ink">{t.term}</span>
                <span className="text-[12px] text-subtle">
                  Google udelukker med "{t.negative.text}" ({MATCH[t.negative.matchType].toLowerCase()})
                </span>
                <span className="ml-auto text-[12px] tabular text-ink-2">
                  {fmtMoney(t.spend, currency)} · {fmtNumber(t.clicks)} klik · {fmtNumber(t.conversions, 1)} konv.
                </span>
              </li>
            )}
          />
          <ListHead
            title="Konverterer i Google, ses ikke i Microsoft"
            count={r.convertingOnlyInGoogle.length}
            tone="neutral"
            copy={() => r.convertingOnlyInGoogle.map((t) => `${t.term}\t${fmtNumber(t.conversions, 1)}\t${fmtMoney(t.revenue, googleCurrency)}`).join('\n')}
            ask={() =>
              [
                intro(row),
                `Disse søgetermer gav konverteringer i Google i perioden ${range.from} – ${range.to}, men viste ikke annoncer i Microsoft:`,
                ...r.convertingOnlyInGoogle.slice(0, 150).map((t) => `- "${t.term}": ${fmtNumber(t.conversions, 1)} konv., ${fmtMoney(t.revenue, googleCurrency)} i værdi, ${fmtNumber(t.clicks)} klik i Google`),
                'Vurdér hvilke der bør blive søgeord i Microsoft (matchtype og annoncegruppe), og tjek Microsofts søgetal for dem. Vis ændringerne til godkendelse, før noget sker.',
              ].join('\n')
            }
          />
          <Rows
            items={r.convertingOnlyInGoogle}
            empty="Alle søgetermer, der konverterer i Google, viser også annoncer i Microsoft."
            render={(t, i) => (
              <li key={i} className={li}>
                <span className="font-medium text-ink">{t.term}</span>
                <span className="ml-auto text-[12px] tabular text-ink-2">
                  {fmtNumber(t.conversions, 1)} konv. · {fmtMoney(t.revenue, googleCurrency)} · {fmtNumber(t.clicks)} klik i Google
                </span>
              </li>
            )}
          />
          <p className="px-4 pb-4 text-[12px] text-subtle">
            Perioden {range.from} – {range.to}. Kun negative søgeord på kampagnen og i delte lister regnes med (en søgeterm hører ikke til én annoncegruppe).
          </p>
        </>
      )}
    </>
  );
}

/* ------------------------------------- ads ------------------------------------- */

function AdsTab({ row, range }: { row: AuditRow; range: DateRange }) {
  const { google, bing } = useBoth(row, 'ads', range, true);
  const diffs = useMemo(() => (google.data && bing.data ? compareAds(google.data.data, bing.data) : null), [google.data, bing.data]);
  const worth = diffs?.filter((d) => !d.bingGroup || d.missingHeadlines.length || d.missingDescriptions.length || d.urlsOnlyGoogle.length || d.urlsOnlyBing.length) ?? [];
  return (
    <>
      <Status google={google} bing={bing} />
      {diffs && (
        <>
          <ListHead
            title="Annoncegrupper med forskelle"
            count={worth.length}
            tone="negative"
            ask={() =>
              [
                intro(row),
                'Forskelle i annoncerne pr. annoncegruppe (kun aktive annoncer):',
                ...worth.slice(0, 40).map((d) =>
                  [
                    `- Google "${d.googleGroup ?? '–'}" / Microsoft "${d.bingGroup ?? 'mangler'}": ${ads(d.googleAds)} i Google, ${ads(d.bingAds)} i Microsoft.`,
                    d.missingHeadlines.length ? `  Overskrifter kun i Google: ${d.missingHeadlines.map((h) => `"${h}"`).join(', ')}` : '',
                    d.missingDescriptions.length ? `  Beskrivelser kun i Google: ${d.missingDescriptions.map((h) => `"${h}"`).join(', ')}` : '',
                    d.urlsOnlyGoogle.length ? `  Landingssider kun i Google: ${d.urlsOnlyGoogle.join(', ')}` : '',
                    d.urlsOnlyBing.length ? `  Landingssider kun i Microsoft: ${d.urlsOnlyBing.join(', ')}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n'),
                ),
                'Foreslå hvordan Microsoft-annoncerne skal opdateres (overskrifter, beskrivelser, landingssider) – Microsofts tegngrænser gælder. Vis ændringerne til godkendelse, før noget sker.',
              ].join('\n')
            }
          />
          <Rows
            items={worth}
            first={8}
            empty="Annoncerne bruger de samme tekster og landingssider."
            render={(d, i) => (
              <li key={i} className="grid gap-1 px-4 py-2.5 text-[13px]">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium text-ink">{d.googleGroup ?? d.bingGroup}</span>
                  <span className="text-[12px] text-subtle">
                    {d.bingGroup ? `${ads(d.googleAds)} i Google · ${ads(d.bingAds)} i Microsoft` : 'Ingen tilsvarende annoncegruppe i Microsoft'}
                  </span>
                </span>
                {d.missingHeadlines.length > 0 && <span className="text-[12.5px] text-ink-2">Overskrifter kun i Google: {d.missingHeadlines.map((h) => `"${h}"`).join(', ')}</span>}
                {d.missingDescriptions.length > 0 && <span className="text-[12.5px] text-ink-2">Beskrivelser kun i Google: {d.missingDescriptions.map((h) => `"${h}"`).join(', ')}</span>}
                {d.urlsOnlyGoogle.length > 0 && <span className="text-[12.5px] text-ink-2">Landingssider kun i Google: {d.urlsOnlyGoogle.join(', ')}</span>}
                {d.urlsOnlyBing.length > 0 && <span className="text-[12.5px] text-muted">Landingssider kun i Microsoft: {d.urlsOnlyBing.join(', ')}</span>}
              </li>
            )}
          />
          <p className="px-4 pb-4 text-[12px] text-subtle">Kun aktive annoncer. Landingssider sammenlignes uden sporingsparametre.</p>
        </>
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
          <ProductsTab key={row.bing.id} row={row} range={range} />
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
