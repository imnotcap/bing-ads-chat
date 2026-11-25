/**
 * Dashboard → Microsoft Ads → Målretning: a campaign's – or one ad group's – ad schedule
 * (a week grid like Microsoft's), devices, locations, ages and genders with their bid
 * adjustments, next to what each segment spent and earned in the last 30 days, and where to
 * lower or raise (analysis.ts). For each kind it says whether it lives on the campaign or on
 * ad groups – an ad group's own targets replace the campaign's for that ad group (Microsoft).
 *
 * Changes are made here directly: listed for confirmation, sent to Microsoft, read back and
 * logged like every other change the user makes.
 */
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, Loader2, Plus, RefreshCw, Sparkles, Trash2, TrendingDown, TrendingUp } from '@/components/icons';
import { pageTransition } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Input, NumberInput } from '@/components/ui/input';
import { Dialog, Select, Tooltip } from '@/components/ui/overlays';
import { getBackend } from '@/bing/backend';
import type { CampaignTargets, Metrics, ReportRow } from '@/bing/types';
import { useCampaigns } from '@/hooks/useAdsData';
import { addDays, fmtMoney, fmtNumber, today } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { cn, errorMessage } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import {
  AGES,
  AGE_LABEL,
  DAY_SHORT,
  DEVICES,
  DEVICE_LABEL,
  GENDERS,
  GENDER_LABEL,
  MIN_ADJ,
  REGION_LABEL,
  WEEK,
  applyScheduleSuggestion,
  bySpendAtStake,
  regionKey,
  scheduleAdjustment,
  segmentsOf,
  sourceOf,
  suggestAdjustments,
  targetLevels,
  weekGrid,
  type Segment,
  type Suggestion,
  type TargetDim,
} from './analysis';
import { changesOf, draftOf, fmtAdj, type Draft } from './changes';
import { REPORT_DAYS, useSegmentReport, useTargets } from './useTargeting';

type Tab = 'schedule' | 'device' | 'location' | 'demo';
const TAB_DIMS: Record<Tab, TargetDim[]> = { schedule: ['schedule'], device: ['device'], location: ['location'], demo: ['age', 'gender'] };
const DIM_LABEL: Record<TargetDim, string> = { schedule: 'Tidsplan', device: 'Enheder', location: 'Lokationer', age: 'Alder', gender: 'Køn' };
const EMPTY: CampaignTargets = { devices: [], schedule: [], locations: [], ages: [], genders: [] };
const AUTOMATED = new Set(['MaxConversions', 'MaxConversionValue', 'TargetCpa', 'TargetRoas', 'MaxClicks', 'TargetImpressionShare']);
const BRUSHES: (number | null)[] = [null, -90, -50, -25, 0, 10, 25, 50];

const sum = (rows: Partial<Metrics>[]): Metrics =>
  rows.reduce<Metrics>((t, r) => ({ impressions: t.impressions + (r.impressions ?? 0), clicks: t.clicks + (r.clicks ?? 0), spend: t.spend + (r.spend ?? 0), conversions: t.conversions + (r.conversions ?? 0), revenue: t.revenue + (r.revenue ?? 0) }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });
const roasOf = (m: Metrics) => (m.spend > 0 ? m.revenue / m.spend : null);

/** The draft parts of one kind, copied from another draft (for inherited kinds). */
function withDims(base: Draft, from: Draft, dims: TargetDim[]): Draft {
  const d = { ...base };
  for (const dim of dims) {
    if (dim === 'schedule') d.schedule = from.schedule;
    if (dim === 'device') d.devices = from.devices;
    if (dim === 'location') d.locations = from.locations.map(({ id: _id, ...l }) => l);
    if (dim === 'age') d.ages = from.ages;
    if (dim === 'gender') d.genders = from.genders;
  }
  return d;
}

/** A cell's colour from its adjustment: none = hatched, below 0 red, above 0 green. */
function adjColor(v: number | null): React.CSSProperties {
  if (v === null) return { background: 'repeating-linear-gradient(135deg,#f0f0f3 0 4px,#fafafb 4px 8px)' };
  if (v === 0) return { background: '#eef6f1' };
  if (v < 0) return { background: `rgb(229 72 77 / ${0.12 + Math.min(1, -v / 90) * 0.55})` };
  return { background: `rgb(34 160 107 / ${0.18 + Math.min(1, v / 100) * 0.55})` };
}

export function TargetingPage() {
  const account = useCurrentAccount();
  const currency = account?.currency ?? 'DKK';
  const accountId = useConnection((s) => s.accountId);
  const mode = useConnection((s) => s.mode);
  const range = useMemo(() => ({ from: addDays(today(), -REPORT_DAYS), to: addDays(today(), -1) }), []);
  const campaigns = useCampaigns(range);
  const usable = (campaigns.data ?? []).filter((c) => c.status !== 'Deleted' && ['Search', 'Shopping', 'PerformanceMax', 'Audience'].includes(c.type));
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [adGroupId, setAdGroupId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('schedule');
  useEffect(() => {
    if (!campaignId && usable.length) setCampaignId(usable[0]!.id);
  }, [campaignId, usable]);
  const campaign = usable.find((c) => c.id === campaignId) ?? null;

  const targets = useTargets(campaignId);
  const hourly = useSegmentReport('adgrouphourly', campaignId);
  const device = useSegmentReport('adgroupdevice', campaignId);
  const ageGender = useSegmentReport('adgroupagegender', campaignId);
  const geo = useSegmentReport('adgroupgeo', campaignId);

  const data = targets.data;
  const group = data?.groups.find((g) => g.id === adGroupId) ?? null;
  const own = adGroupId ? (group?.targets ?? EMPTY) : (data?.campaign ?? EMPTY);
  const levels = data ? targetLevels(data.campaign, data.groups) : null;
  const dims: TargetDim[] = ['schedule', 'device', 'location', 'age', 'gender'];
  const inherited = (dim: TargetDim) => !!adGroupId && !!data && sourceOf(dim, data.campaign, group?.targets ?? null) !== 'adgroup';

  // The draft: for an ad group, the kinds it doesn't have itself start from the campaign's.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState<Set<TargetDim>>(new Set());
  useEffect(() => {
    if (!data) return setDraft(null);
    const base = draftOf(own);
    setDraft(adGroupId ? withDims(base, draftOf(data.campaign), dims.filter(inherited)) : base);
    setTouched(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, adGroupId]);
  const edit = (dim: TargetDim, fn: (d: Draft) => Draft) => {
    setDraft((d) => (d ? fn(d) : d));
    setTouched((t) => new Set(t).add(dim));
  };

  // What is sent: an inherited kind only when it was changed here (then the ad group gets its own).
  const diff = useMemo(() => {
    if (!draft) return null;
    const untouchedInherited = dims.filter((d) => inherited(d) && !touched.has(d));
    const toSend = withDims(draft, draftOf(own), untouchedInherited);
    const scope = adGroupId ? `${group?.name ?? 'Annoncegruppe'} · ` : '';
    return changesOf(own, toSend, scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, touched, own, adGroupId]);
  const count = diff ? diff.lines.length : 0;

  // The rows for the selection (one ad group, or the whole campaign).
  const pick = (rows: ReportRow[] | undefined) => (rows ?? []).filter((r) => !adGroupId || r.adGroupId === adGroupId);
  const segs = useMemo(
    () => ({
      schedule: segmentsOf('schedule', pick(hourly.data)),
      device: segmentsOf('device', pick(device.data)),
      age: segmentsOf('age', pick(ageGender.data)),
      gender: segmentsOf('gender', pick(ageGender.data)),
      location: segmentsOf('location', pick(geo.data)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hourly.data, device.data, ageGender.data, geo.data, adGroupId],
  );
  const grid = useMemo(() => weekGrid(pick(hourly.data)), [hourly.data, adGroupId]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = sum(pick(device.data));

  const currentOf = (s: Segment): number | null => {
    if (!draft) return null;
    if (s.dim === 'schedule') return scheduleAdjustment(draft.schedule, s.key);
    if (s.dim === 'device') return draft.devices[s.key as keyof Draft['devices']] ?? null;
    if (s.dim === 'age') return draft.ages[s.key as keyof Draft['ages']] ?? null;
    if (s.dim === 'gender') return draft.genders[s.key as keyof Draft['genders']] ?? null;
    return draft.locations.find((l) => regionKey(l.name) === s.key)?.adjustment ?? null;
  };
  const suggestions = useMemo(() => {
    if (!draft) return [];
    return dims
      .flatMap((d) =>
        suggestAdjustments(segs[d], currentOf).filter(
          // A region can only be adjusted when it is targeted on its own; hours without ads have nothing to adjust.
          (s) => (s.dim !== 'location' || draft.locations.some((l) => regionKey(l.name) === s.key)) && (s.dim !== 'schedule' || draft.schedule.none || s.current !== null),
        ),
      )
      .sort(bySpendAtStake);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segs, draft]);
  const apply = (s: Suggestion) =>
    edit(s.dim, (d) => {
      if (s.dim === 'schedule') return { ...d, schedule: applyScheduleSuggestion(d.schedule, s) };
      if (s.dim === 'device') return { ...d, devices: { ...d.devices, [s.key]: s.suggested } };
      if (s.dim === 'age') return { ...d, ages: { ...d.ages, [s.key]: s.suggested } };
      if (s.dim === 'gender') return { ...d, genders: { ...d.genders, [s.key]: s.suggested } };
      return { ...d, locations: d.locations.map((l) => (regionKey(l.name) === s.key ? { ...l, adjustment: s.suggested } : l)) };
    });

  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!diff || !accountId || !campaignId) return;
    setSaving(true);
    const summary = `Målretning · ${campaign?.name ?? ''}${group ? ` › ${group.name}` : ''}`;
    try {
      const backend = await getBackend();
      if (!backend.applyTargets) throw new Error('Målretning kan ikke ændres for denne forbindelse.');
      const res = await backend.applyTargets(accountId, { campaignId, adGroupId }, diff.changes);
      const failed = res.failed ?? [];
      useActivity.getState().add({
        source: 'user',
        mode,
        accountId,
        tool: 'set_campaign_targeting',
        summary,
        changes: diff.lines,
        status: failed.length && failed.length >= diff.changes.add.length + diff.changes.update.length + diff.changes.delete.length ? 'failed' : 'success',
        error: failed.length ? failed.map((f) => f.message).join(' · ') : undefined,
        campaignIds: [campaignId],
      });
      await queryClient.invalidateQueries({ queryKey: ['targeting'] });
      if (failed.length) toast.warning(`${failed.length} af ændringerne blev afvist af Microsoft`, { description: failed.slice(0, 3).map((f) => f.message).join(' · ') });
      else toast.success('Målretningen er gemt i Microsoft');
      setConfirm(false);
    } catch (e) {
      toast.error('Kunne ikke gemme målretningen', { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const loading = targets.isLoading || !draft;
  return (
    <motion.div {...pageTransition} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-8 pb-28 pt-7">
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">Målretning</h1>
            <p className="mt-1 text-[14px] text-muted">Tidsplan, enheder, lokationer, alder og køn for en kampagne eller annoncegruppe – med hvad hvert segment har kostet og tjent de seneste {REPORT_DAYS} dage, og hvor I bør sænke eller hæve.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['targeting'] });
              void queryClient.invalidateQueries({ queryKey: ['targeting-report'] });
            }}
          >
            <RefreshCw className={cn((targets.isFetching || hourly.isFetching) && 'animate-spin')} /> Opdatér
          </Button>
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Select
            aria-label="Kampagne"
            value={campaignId}
            onChange={(v) => {
              setCampaignId(v);
              setAdGroupId(null);
            }}
            options={usable.map((c) => ({ value: c.id, label: c.name, description: c.metrics ? `${fmtMoney(c.metrics.spend ?? 0, currency, 0)} · ${c.type}` : c.type }))}
            placeholder={campaigns.isLoading ? 'Henter kampagner …' : 'Vælg kampagne'}
          />
          <Select
            aria-label="Annoncegruppe"
            value={adGroupId ?? 'all'}
            onChange={(v) => setAdGroupId(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'Hele kampagnen' },
              ...(data?.groups ?? []).map((g) => {
                const ownDims = dims.filter((d) => g.targets && (d === 'schedule' ? g.targets.schedule.length : d === 'device' ? g.targets.devices.length : d === 'location' ? g.targets.locations.length : d === 'age' ? g.targets.ages?.length : g.targets.genders?.length));
                return { value: g.id, label: g.name, description: [g.status !== 'Active' ? 'Pauset' : '', ownDims.length ? `Egen ${ownDims.map((d) => DIM_LABEL[d].toLowerCase()).join(', ')}` : ''].filter(Boolean).join(' · ') || undefined };
              }),
            ]}
          />
        </div>

        {targets.error ? (
          <div className="card mt-5 p-6 text-[13px] text-negative">{errorMessage(targets.error)}</div>
        ) : loading ? (
          <div className="card mt-5 flex items-center gap-2 p-6 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin" /> Henter målretningen for kampagnen og dens annoncegrupper …
          </div>
        ) : (
          <>
            {/* Which level each kind lives on */}
            {levels && (
              <div className="mt-4 flex flex-wrap gap-2">
                {dims.map((d) => {
                  const l = levels[d];
                  const src = adGroupId ? sourceOf(d, data!.campaign, group?.targets ?? null) : null;
                  const text = adGroupId
                    ? src === 'adgroup'
                      ? 'annoncegruppens egen'
                      : src === 'campaign'
                        ? 'arvet fra kampagnen'
                        : 'ikke sat'
                    : [l.campaign ? 'kampagneniveau' : '', l.groups.length ? `${l.groups.length} ${l.groups.length === 1 ? 'annoncegruppe har' : 'annoncegrupper har'} egen` : ''].filter(Boolean).join(' · ') || 'ikke sat';
                  return (
                    <Tooltip key={d} content={l.groups.length && !adGroupId ? `Egen ${DIM_LABEL[d].toLowerCase()}: ${l.groups.map((g) => g.name).join(', ')} – den erstatter kampagnens for de annoncegrupper.` : `${DIM_LABEL[d]}: ${text}`}>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]', (adGroupId ? src === 'adgroup' : l.groups.length > 0) ? 'border-warning/40 bg-warning-bg text-warning' : 'border-line bg-surface text-ink-2')}>
                        <span className="font-medium">{DIM_LABEL[d]}</span> {text}
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            )}
            {campaign && AUTOMATED.has(campaign.bidStrategy.type) && (
              <p className="mt-3 flex items-start gap-2 text-[12.5px] text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" /> Kampagnen byder automatisk – budjusteringer er signaler, ikke faste gange-faktorer. −100 % på en enhed udelukker den altid, og tidsplanen styrer, hvornår der vises annoncer.
              </p>
            )}

            {/* Where the money goes, and what to change */}
            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.15fr]">
              <MoneyCard segs={segs} total={total} currency={currency} loading={device.isLoading || hourly.isLoading} />
              <SuggestionCard suggestions={suggestions} onApply={apply} loading={hourly.isLoading || device.isLoading || ageGender.isLoading || geo.isLoading} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Segmented
                layoutId="targeting-tab"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'schedule', label: 'Tidsplan' },
                  { value: 'device', label: 'Enheder' },
                  { value: 'location', label: 'Lokationer' },
                  { value: 'demo', label: 'Alder og køn' },
                ]}
              />
              {TAB_DIMS[tab].some(inherited) && (
                <span className="text-[12.5px] text-warning">
                  {TAB_DIMS[tab].filter(inherited).map((d) => DIM_LABEL[d]).join(' og ')} er arvet fra kampagnen – ændrer du her, får annoncegruppen sin egen, som erstatter kampagnens.
                </span>
              )}
            </div>

            <div className="card mt-3 p-5">
              {tab === 'schedule' && draft && <ScheduleEditor draft={draft} grid={grid} currency={currency} onChange={(schedule) => edit('schedule', (d) => ({ ...d, schedule }))} />}
              {tab === 'device' && draft && (
                <SegmentTable
                  rows={DEVICES.map((k) => ({ key: k, label: DEVICE_LABEL[k], m: segs.device.find((s) => s.key === k)?.m ?? null, value: draft.devices[k] }))}
                  min={MIN_ADJ.device}
                  total={total}
                  currency={currency}
                  note="Microsoft sender altid alle tre enheder samlet. −100 % udelukker enheden."
                  onChange={(k, v) => edit('device', (d) => ({ ...d, devices: { ...d.devices, [k]: v } }))}
                />
              )}
              {tab === 'location' && draft && (
                <LocationEditor
                  draft={draft}
                  segs={segs.location}
                  total={total}
                  currency={currency}
                  onChange={(locations) => edit('location', (d) => ({ ...d, locations }))}
                />
              )}
              {tab === 'demo' && draft && (
                <div className="grid gap-6">
                  <SegmentTable
                    title="Alder"
                    rows={AGES.map((k) => ({ key: k, label: AGE_LABEL[k], m: segs.age.find((s) => s.key === k)?.m ?? null, value: draft.ages[k] }))}
                    min={MIN_ADJ.age}
                    total={total}
                    currency={currency}
                    removable
                    onChange={(k, v) => edit('age', (d) => ({ ...d, ages: { ...d.ages, [k]: v } }))}
                  />
                  <SegmentTable
                    title="Køn"
                    rows={[...GENDERS, 'Unknown' as const].map((k) => ({ key: k, label: GENDER_LABEL[k], m: segs.gender.find((s) => s.key === k)?.m ?? null, value: draft.genders[k] }))}
                    min={MIN_ADJ.gender}
                    total={total}
                    currency={currency}
                    removable
                    onChange={(k, v) => edit('gender', (d) => ({ ...d, genders: { ...d.genders, [k]: v } }))}
                  />
                  <p className="text-[12px] text-muted">Alder og køn kendes kun for en del af de søgende (Microsoft-konti med profil) – "Ukendt" er resten.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save bar */}
      {count > 0 && diff && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-brand/30 bg-surface px-4 py-3 shadow-pop">
            <span className="text-[13.5px] text-ink">
              <b>{count}</b> {count === 1 ? 'ændring' : 'ændringer'} {group ? `i ${group.name}` : `i ${campaign?.name ?? ''}`}
            </span>
            {diff.errors.length > 0 && <span className="text-[12.5px] text-negative">{diff.errors[0]}</span>}
            <Button variant="ghost" size="sm" onClick={() => data && (setDraft(adGroupId ? withDims(draftOf(own), draftOf(data.campaign), dims.filter(inherited)) : draftOf(own)), setTouched(new Set()))}>
              Fortryd
            </Button>
            <Button variant="gradient" size="sm" disabled={diff.errors.length > 0} onClick={() => setConfirm(true)}>
              <Check /> Gem i Microsoft
            </Button>
          </div>
        </div>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Gem målretningen i Microsoft?"
        description={group ? `Annoncegruppen "${group.name}" – dens egne indstillinger erstatter kampagnens for den.` : `Kampagnen "${campaign?.name ?? ''}" – gælder alle annoncegrupper uden deres egne.`}
        className="w-[min(640px,calc(100vw-32px))]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Annullér
            </Button>
            <Button variant="positive" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />} Gem {count} {count === 1 ? 'ændring' : 'ændringer'}
            </Button>
          </>
        }
      >
        <ul className="grid max-h-[50vh] gap-1 overflow-y-auto text-[13px]">
          {diff?.lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line-2 py-1.5">
              <span className="text-ink-2">{l.field}</span>
              <span className="text-right">
                <span className="text-muted line-through decoration-black/20">{String(l.before ?? '–')}</span> → <span className="font-medium text-ink">{String(l.after ?? '–')}</span>
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
    </motion.div>
  );
}

/* --------------------------------- where the money goes --------------------------------- */

function MoneyCard({ segs, total, currency, loading }: { segs: Record<TargetDim, Segment[]>; total: Metrics; currency: string; loading: boolean }) {
  const avg = roasOf(total);
  const groups: { title: string; list: Segment[] }[] = [
    { title: 'Tidspunkt', list: segs.schedule.filter((s) => s.key.startsWith('hours:')) },
    { title: 'Ugedag', list: segs.schedule.filter((s) => s.key.startsWith('day:')) },
    { title: 'Enhed', list: segs.device },
    { title: 'Region', list: segs.location },
    { title: 'Alder', list: segs.age },
  ];
  return (
    <section className="card p-5">
      <h2 className="text-[14.5px] font-semibold text-ink">Hvor går pengene hen?</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        {REPORT_DAYS} dage: {fmtMoney(total.spend, currency, 0)} brugt · ROAS {avg !== null ? fmtNumber(avg, 2) : '–'} i alt. Rødt = under gennemsnittet.
      </p>
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <Loader2 className="size-4 animate-spin" /> Henter rapporterne …
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => {
            const base = g.list.reduce((n, s) => n + s.m.spend, 0) || 1;
            return (
              <div key={g.title}>
                <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-subtle">{g.title}</div>
                {g.list.slice(0, 4).map((s) => {
                  const r = roasOf(s.m);
                  const weak = avg !== null && r !== null && r < avg * 0.8;
                  return (
                    <div key={s.key} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 py-0.5 text-[12.5px]">
                      <span className="truncate text-ink-2">{s.label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-line-2">
                        <span className={cn('block h-full rounded-full', weak ? 'bg-negative/70' : 'bg-brand/60')} style={{ width: `${(s.m.spend / base) * 100}%` }} />
                      </span>
                      <span className={cn('tabular', weak ? 'text-negative' : 'text-muted')}>
                        {Math.round((s.m.spend / base) * 100)} % · {r !== null ? fmtNumber(r, 1) : '–'}
                      </span>
                    </div>
                  );
                })}
                {!g.list.length && <div className="text-[12px] text-subtle">Ingen data</div>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SuggestionCard({ suggestions, onApply, loading }: { suggestions: Suggestion[]; onApply: (s: Suggestion) => void; loading: boolean }) {
  const [all, setAll] = useState(false);
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
        <Sparkles className="size-4 text-brand" /> Hvor bør I sænke eller hæve?
      </h2>
      <p className="mt-0.5 text-[12.5px] text-muted">Kun segmenter med mindst 30 konverteringer eller 300 klik · højst ±20 point ad gangen · Anvend ændrer kun kladden – intet sendes, før du gemmer.</p>
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <Loader2 className="size-4 animate-spin" /> Regner …
        </p>
      ) : suggestions.length ? (
        <ul className="mt-3 grid gap-1.5">
          {suggestions.slice(0, all ? undefined : 6).map((s) => (
            <li key={`${s.dim}:${s.key}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-[13px]">
              {s.delta < 0 ? <TrendingDown className="size-4 shrink-0 text-negative" /> : <TrendingUp className="size-4 shrink-0 text-positive" />}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">
                  {DIM_LABEL[s.dim]} · {s.label}: {fmtAdj(s.current ?? 0)} → {fmtAdj(s.suggested)}
                </div>
                <div className="truncate text-[12px] text-muted" title={s.why}>
                  {s.why}
                </div>
              </div>
              <Button size="xs" variant="secondary" onClick={() => onApply(s)}>
                Anvend
              </Button>
            </li>
          ))}
          {suggestions.length > 6 && (
            <li>
              <Button size="xs" variant="ghost" onClick={() => setAll((a) => !a)}>
                {all ? 'Vis færre' : `Vis alle ${suggestions.length}`}
              </Button>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Intet segment skiller sig nok ud – eller der er for lidt data endnu.</p>
      )}
    </section>
  );
}

/* --------------------------------------- the schedule --------------------------------------- */

function ScheduleEditor({ draft, grid, currency, onChange }: { draft: Draft; grid: Record<string, Metrics[]>; currency: string; onChange: (m: Draft['schedule']) => void }) {
  const [brush, setBrush] = useState<number | null>(0);
  const [custom, setCustom] = useState<number | null>(null);
  const [painting, setPainting] = useState(false);
  const [show, setShow] = useState<'adj' | 'spend'>('adj');
  const map = draft.schedule;
  const maxSpend = Math.max(1, ...WEEK.flatMap((d) => grid[d]!.map((m) => m.spend)));
  useEffect(() => {
    const up = () => setPainting(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const paint = (day: (typeof WEEK)[number], h: number) => {
    const days = { ...map.days, [day]: map.days[day].map((v, i) => (i === h ? brush : v)) };
    // Painting into "no schedule" makes one: the other hours keep 0 % (ads shown).
    onChange({ none: false, days, rounded: map.rounded });
  };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">Pensel:</span>
        {BRUSHES.map((b) => (
          <button
            key={String(b)}
            type="button"
            onClick={() => setBrush(b)}
            className={cn('h-7 rounded-lg border px-2 text-[12px] font-medium', brush === b ? 'border-brand ring-2 ring-brand/20' : 'border-line')}
            style={adjColor(b)}
          >
            {b === null ? 'Ingen annoncer' : fmtAdj(b)}
          </button>
        ))}
        <NumberInput value={custom} onChange={(v) => (setCustom(v), v !== null && setBrush(Math.max(-90, Math.min(900, v))))} min={-90} placeholder="Andet %" className="w-28" aria-label="Egen budjustering" />
        <div className="ml-auto">
          <Segmented size="sm" layoutId="schedule-show" value={show} onChange={setShow} options={[{ value: 'adj', label: 'Budjustering' }, { value: 'spend', label: 'Forbrug' }]} />
        </div>
      </div>
      {map.none && <p className="text-[12.5px] text-muted">Ingen tidsplan i dag – annoncerne vises hele døgnet med 0 %. Mal i gitteret for at lave en; timer, du maler "Ingen annoncer", får ingen visninger.</p>}
      {map.rounded && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-warning">
          <AlertTriangle className="size-3.5" /> Tidsplanen har kvarterer – gitteret viser hele timer, og gemmer du, rundes de af.
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[760px] select-none" onMouseLeave={() => setPainting(false)}>
          <div className="grid grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-px text-center text-[10.5px] text-subtle">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h}>{String(h).padStart(2, '0')}</span>
            ))}
          </div>
          {WEEK.map((d) => (
            <div key={d} className="mt-px grid grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-px">
              <span className="pr-2 text-right text-[12px] font-medium leading-8 text-ink-2">{DAY_SHORT[d]}</span>
              {map.days[d].map((v, h) => {
                const m = grid[d]![h]!;
                const r = roasOf(m);
                return (
                  <Tooltip key={h} content={`${DAY_SHORT[d]} kl. ${String(h).padStart(2, '0')}: ${v === null ? 'ingen annoncer' : fmtAdj(v)} · ${fmtMoney(m.spend, currency, 0)}, ${fmtNumber(m.conversions, 1)} konv., ROAS ${r !== null ? fmtNumber(r, 1) : '–'}`}>
                    <button
                      type="button"
                      aria-label={`${d} ${h}`}
                      onMouseDown={() => (setPainting(true), paint(d, h))}
                      onMouseEnter={() => painting && paint(d, h)}
                      className="relative h-8 rounded-[3px] text-[9.5px] font-medium text-ink/70"
                      style={show === 'adj' ? adjColor(v) : { background: `rgb(109 92 246 / ${0.06 + (m.spend / maxSpend) * 0.7})` }}
                    >
                      {show === 'adj' ? (v !== null && v !== 0 ? (v > 0 ? `+${v}` : v) : '') : m.spend >= maxSpend * 0.5 ? Math.round(m.spend) : ''}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-muted">Klik eller træk i gitteret med den valgte pensel. Microsoft tillader højst 7 tidsrum pr. dag, og budjusteringer i tidsplanen går fra −90 % til +900 %. Tiderne følger kontoens tidszone.</p>
    </div>
  );
}

/* ---------------------------------- devices, ages, genders ---------------------------------- */

function SegmentTable<K extends string>({
  title,
  rows,
  min,
  total,
  currency,
  note,
  removable = false,
  onChange,
}: {
  title?: string;
  rows: { key: K; label: string; m: Metrics | null; value: number | null }[];
  min: number;
  total: Metrics;
  currency: string;
  note?: string;
  removable?: boolean;
  onChange: (k: K, v: number | null) => void;
}) {
  const avg = roasOf(total);
  return (
    <div>
      {title && <h3 className="mb-2 text-[13px] font-semibold text-ink">{title}</h3>}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[11.5px] font-semibold text-muted">
            <th className="border-b border-line py-2">Segment</th>
            <th className="border-b border-line px-2 py-2 text-right">Forbrug</th>
            <th className="border-b border-line px-2 py-2 text-right">Andel</th>
            <th className="border-b border-line px-2 py-2 text-right">Konv.</th>
            <th className="border-b border-line px-2 py-2 text-right">ROAS</th>
            <th className="border-b border-line py-2 pl-2 text-right">Budjustering</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const roas = r.m ? roasOf(r.m) : null;
            const weak = avg !== null && roas !== null && roas < avg * 0.8;
            return (
              <tr key={r.key}>
                <td className="border-b border-line-2 py-2 font-medium text-ink">{r.label}</td>
                <td className="border-b border-line-2 px-2 py-2 text-right tabular text-ink-2">{r.m ? fmtMoney(r.m.spend, currency, 0) : '–'}</td>
                <td className="border-b border-line-2 px-2 py-2 text-right tabular text-muted">{r.m && total.spend ? `${Math.round((r.m.spend / total.spend) * 100)} %` : '–'}</td>
                <td className="border-b border-line-2 px-2 py-2 text-right tabular text-ink-2">{r.m ? fmtNumber(r.m.conversions, 1) : '–'}</td>
                <td className={cn('border-b border-line-2 px-2 py-2 text-right tabular', weak ? 'text-negative' : 'text-ink-2')}>{roas !== null ? fmtNumber(roas, 2) : '–'}</td>
                <td className="border-b border-line-2 py-1.5 pl-2">
                  <div className="ml-auto flex w-40 items-center gap-1">
                    <NumberInput value={r.value} onChange={(v) => onChange(r.key, v === null ? (removable ? null : 0) : Math.max(min, Math.min(900, v)))} min={min} suffix="%" placeholder="Ikke sat" aria-label={`Budjustering ${r.label}`} />
                    {removable && r.value !== null && (
                      <Button size="icon-xs" variant="ghost" aria-label={`Fjern ${r.label}`} onClick={() => onChange(r.key, null)}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {note && <p className="mt-2 text-[12px] text-muted">{note}</p>}
    </div>
  );
}

/* ---------------------------------------- locations ---------------------------------------- */

function LocationEditor({ draft, segs, total, currency, onChange }: { draft: Draft; segs: Segment[]; total: Metrics; currency: string; onChange: (l: Draft['locations']) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const accountId = useConnection((s) => s.accountId);
  const add = async () => {
    if (!name.trim() || !accountId) return;
    setBusy(true);
    try {
      const backend = await getBackend();
      const found = backend.findLocations ? await backend.findLocations(accountId, [name.trim()]) : [];
      if (!found.length) toast.error(`Fandt ikke "${name.trim()}"`, { description: 'Brug det engelske navn fra Microsofts lokationsfil, fx "Region Zealand" eller "Aarhus".' });
      else if (draft.locations.some((l) => l.locationId === found[0]!.locationId)) toast('Lokationen er der allerede');
      else {
        onChange([...draft.locations, { locationId: found[0]!.locationId, name: found[0]!.name, adjustment: 0 }]);
        setName('');
      }
    } catch (e) {
      toast.error('Kunne ikke slå lokationen op', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  // Region figures for the targeted regions; a country gets the whole campaign's.
  const metricsOf = (n: string): Metrics | null => {
    const k = regionKey(n);
    const s = segs.find((x) => x.key === k);
    if (s) return s.m;
    return /^denmark/i.test(n) ? total : null;
  };
  return (
    <div className="grid gap-4">
      <SegmentTable
        rows={draft.locations.map((l) => ({ key: l.id ?? `new:${l.locationId}`, label: REGION_LABEL[regionKey(l.name)] ?? l.name.split('|')[0]!, m: metricsOf(l.name), value: l.adjustment }))}
        min={-90}
        total={total}
        currency={currency}
        removable
        onChange={(k, v) => onChange(v === null ? draft.locations.filter((l) => (l.id ?? `new:${l.locationId}`) !== k) : draft.locations.map((l) => ((l.id ?? `new:${l.locationId}`) === k ? { ...l, adjustment: v } : l)))}
      />
      {!draft.locations.length && <p className="text-[12.5px] text-muted">Ingen lokationer – annoncerne kan vises i alle lande, kampagnen tillader.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} placeholder='Tilføj lokation, fx "Region Zealand" eller "Aarhus"' className="max-w-sm" />
        <Button size="sm" variant="secondary" disabled={busy || !name.trim()} onClick={() => void add()}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />} Tilføj
        </Button>
      </div>
      <p className="text-[12px] text-muted">Overlappende lokationer lægges ikke sammen – den mest specifikke gælder. En annoncegruppes egne lokationer erstatter kampagnens.</p>
    </div>
  );
}

