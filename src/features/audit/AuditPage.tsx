/**
 * Audit: the Microsoft Advertising campaigns held up against the Google Ads account –
 * one campaign at a time, through the team's steps (steps.ts). Google is only read
 * (cloudflare/src/googleAds.ts); everything changed is changed in Microsoft.
 *
 * Without a campaign picked: every campaign with its Google counterpart and progress.
 * With one: the match, the two side by side for the period, and the checklist.
 */
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CircleCheck, FileUp, Loader2, Lock, MessageSquare, RefreshCw, TriangleAlert } from '@/components/icons';
import { pageTransition } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Badge, Segmented } from '@/components/ui/controls';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select, Tooltip } from '@/components/ui/overlays';
import { bidLabel } from '@/ai/tools/write';
import { statusLabel } from '@/ai/tools/context';
import { change, derive, sumMetrics } from '@/bing/metrics';
import type { DerivedMetrics } from '@/bing/types';
import { fmtMoney, fmtNumber, fmtPercent, fmtRelative, type DateRange } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { isAdmin, useAccount } from '@/stores/account';
import { useCurrentAccount } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { connectGoogleAudit, disconnectGoogleAudit } from '@/workspace/shared';
import { startChat } from '../chat/startChat';
import { SecretInput } from '../settings/forms';
import { PERIOD_LABELS, changeAudit, refreshGoogle, useAuditUi, type AuditPeriod, type GoogleCampaign } from './data';
import { DetailCompare, STEP_TAB, TAB_LABEL, tabsFor } from './DetailCompare';
import { rankCandidates } from './match';
import { useAuditModel, type AuditRow } from './model';
import { AUDIT_STEPS, stepApplies, type AuditStep, type StepStatus } from './steps';

/* ---------------------------------- labels ---------------------------------- */

const BING_TYPE: Record<string, string> = { Search: 'Søgning', Shopping: 'Shopping', Audience: 'Audience', PerformanceMax: 'PMax' };
const GOOGLE_CHANNEL: Record<string, string> = {
  SEARCH: 'Søgning',
  SHOPPING: 'Shopping',
  PERFORMANCE_MAX: 'PMax',
  DISPLAY: 'Display',
  VIDEO: 'Video',
  DEMAND_GEN: 'Demand Gen',
  MULTI_CHANNEL: 'App',
};
const GOOGLE_STATUS: Record<string, string> = { ENABLED: 'Aktiv', PAUSED: 'Pauset' };
const GOOGLE_BID: Record<string, string> = {
  MANUAL_CPC: 'Manuel CPC',
  ENHANCED_CPC: 'Forbedret CPC',
  TARGET_SPEND: 'Maksimér klik',
  MAXIMIZE_CONVERSIONS: 'Maksimér konverteringer',
  MAXIMIZE_CONVERSION_VALUE: 'Maksimér konverteringsværdi',
  TARGET_CPA: 'Mål-CPA',
  TARGET_ROAS: 'Mål-ROAS',
  TARGET_IMPRESSION_SHARE: 'Mål for visningsandel',
  MANUAL_CPM: 'Manuel CPM',
  MANUAL_CPV: 'Manuel CPV',
};

function googleBid(g: GoogleCampaign, currency: string): string {
  const base = GOOGLE_BID[g.bidStrategy] ?? g.bidStrategy;
  // The same unit as Microsoft's side (bidLabel): ROAS as a ratio, 4,5 = 450 %.
  const target = g.targetRoas ? `mål-ROAS ${fmtNumber(g.targetRoas, 2)}` : g.targetCpa ? `mål-CPA ${fmtMoney(g.targetCpa, currency)}` : '';
  return [base, target, g.portfolio ? 'porteføljestrategi' : ''].filter(Boolean).join(' · ');
}

const googleMetrics = (g: GoogleCampaign | null): DerivedMetrics | null => (g ? derive(g.metrics) : null);
const bingMetrics = (r: AuditRow): DerivedMetrics | null => (r.bing.metrics ? derive(sumMetrics([r.bing.metrics])) : null);

/** The only service account the workspace accepts (cloudflare/src/googleAds.ts → ALLOWED_SERVICE_ACCOUNT). */
const SERVICE_ACCOUNT = 'gsc-chat@search-console-mcp-….iam.gserviceaccount.com';

const fmtCustomer = (id: string | null | undefined) => (id && id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : (id ?? ''));

/* ------------------------------ Google connection ------------------------------ */

type ConnectMethod = 'oauth' | 'service_account';

function ConnectGoogle({ onDone }: { onDone?: () => void }) {
  const google = useAccount((s) => s.workspace?.google);
  const admin = useAccount((s) => isAdmin(s.user));
  const [method, setMethod] = useState<ConnectMethod>(google?.method ?? 'oauth');
  const [key, setKey] = useState<{ name: string; text: string } | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [customerId, setCustomerId] = useState(fmtCustomer(google?.customerId));
  const [loginId, setLoginId] = useState(fmtCustomer(google?.loginCustomerId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  // Secrets already stored for this method may be left empty (they are kept).
  const stored = !!google?.connected && google.method === method;

  const pick = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > 20_000) return setError('Filen er for stor til at være en service-kontonøgle.');
    setKey({ name: f.name, text: await f.text() });
  };

  const ready =
    customerId.replace(/\D/g, '').length === 10 && (method === 'oauth' ? stored || (!!clientId.trim() && !!clientSecret.trim() && !!refreshToken.trim()) : stored || !!key);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectGoogleAudit(
        method === 'oauth'
          ? { method, clientId, clientSecret, refreshToken, customerId, loginCustomerId: loginId }
          : { method, key: key?.text, customerId, loginCustomerId: loginId },
      );
      setKey(null);
      setClientSecret('');
      setRefreshToken('');
      toast.success('Google Ads er forbundet – kun læsning');
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const keep = stored ? 'Gemt – lad feltet stå tomt for at beholde det' : undefined;

  return (
    <div className="grid max-w-[680px] gap-5 rounded-2xl border border-line bg-surface p-6">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-medium text-ink">
          <Lock className="size-4 text-brand" /> Forbind Google Ads – kun læsning
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Audit'en læser kampagnerne i jeres Google Ads-konto og sammenligner dem med Microsoft Advertising. Der ændres aldrig noget i Google: serveren afviser alt andet end
          læsning, før det sendes.
        </p>
      </div>
      <Segmented
        layoutId="google-connect-method"
        size="sm"
        value={method}
        onChange={(m: ConnectMethod) => {
          setMethod(m);
          setError(null);
        }}
        options={[
          { value: 'oauth', label: 'Som Inventarland Dashboard' },
          { value: 'service_account', label: 'Service-konto' },
        ]}
        className="justify-self-start"
      />
      {method === 'oauth' ? (
        <ol className="grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>
            Brug de samme tre værdier som i <b>Inventarland Dashboard → Integrationer → Google Ads</b>: OAuth client ID, client secret og refresh token. Ingen
            developer token – Google har udfaset det.
          </li>
          <li>
            Refresh-tokenet hører til en Google-bruger med adgang til Ads-kontoen. Appen læser kun – også hvis brugeren selv må ændre i Google – men har I en bruger med{' '}
            <b>Kun læseadgang</b>, så brug hellere dens token.
          </li>
          <li>Værdierne gemmes kun i jeres Cloudflare og sendes aldrig tilbage til appen.</li>
        </ol>
      ) : (
        <ol className="grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>
            I Google Ads: <b>Administrator → Adgang og sikkerhed → +</b>. Skriv <b>{SERVICE_ACCOUNT}</b>, vælg <b>Kun læseadgang</b>, og tilføj. Det er den eneste
            service-konto, der kan forbindes.
          </li>
          <li>I service-kontoens Google Cloud-projekt: slå <b>Google Ads API</b> til under APIs &amp; Services.</li>
          <li>Vælg service-kontoens JSON-nøgle herunder. Den gemmes kun i jeres Cloudflare og vises aldrig igen.</li>
        </ol>
      )}
      {!admin ? (
        <p className="rounded-xl bg-line-2 px-4 py-3 text-[13px] text-ink-2">Kun en administrator kan forbinde Google Ads. Bed en administrator om at gøre det her.</p>
      ) : (
        <div className="grid gap-4">
          {method === 'oauth' ? (
            <>
              <Field label="OAuth client ID" htmlFor="g-client" hint={stored && !clientId ? 'Gemt – lad feltet stå tomt for at beholde det' : 'Slutter på .apps.googleusercontent.com'}>
                <Input id="g-client" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="123…apps.googleusercontent.com" autoComplete="off" spellCheck={false} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="OAuth client secret" htmlFor="g-secret" hint={keep}>
                  <SecretInput id="g-secret" value={clientSecret} onChange={setClientSecret} placeholder="GOCSPX-…" />
                </Field>
                <Field label="OAuth refresh token" htmlFor="g-refresh" hint={keep}>
                  <SecretInput id="g-refresh" value={refreshToken} onChange={setRefreshToken} placeholder="1//0…" />
                </Field>
              </div>
            </>
          ) : (
            <Field label="Service-kontoens JSON-nøgle" hint={stored && !key ? `Gemt: ${google?.serviceAccount}. Vælg kun en fil, hvis nøglen skal skiftes.` : undefined}>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => file.current?.click()}>
                  <FileUp /> Vælg fil
                </Button>
                <span className="truncate text-[13px] text-muted">{key ? key.name : 'Ingen fil valgt'}</span>
                <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
              </div>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Google Ads-kundenummer" htmlFor="g-customer" hint="Øverst i Google Ads, fx 123-456-7890.">
              <Input id="g-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="123-456-7890" inputMode="numeric" />
            </Field>
            <Field label="Administratorkonto (MCC)" htmlFor="g-login" hint="Kun hvis adgangen går gennem en administratorkonto.">
              <Input id="g-login" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Valgfri" inputMode="numeric" />
            </Field>
          </div>
          {error && (
            <p className="flex gap-2 rounded-xl bg-negative-bg px-4 py-3 text-[13px] leading-relaxed text-negative">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={busy || !ready}>
              {busy && <Loader2 className="animate-spin" />} Test og gem
            </Button>
            {google?.connected && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await disconnectGoogleAudit();
                    onDone?.();
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Fjern forbindelsen
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- overview ---------------------------------- */

function MatchCell({ row, googleReady }: { row: AuditRow; googleReady: boolean }) {
  if (row.audit?.googleId === null) return <span className="text-subtle">Ingen modpart</span>;
  if (row.audit?.googleId) {
    if (row.google) return <span className="text-ink-2">{row.google.name}</span>;
    // Only once Google's campaigns are in can a missing one be called missing.
    return googleReady ? <span className="text-warning">Findes ikke længere i Google</span> : <span className="text-subtle">Valgt (Google ikke hentet)</span>;
  }
  if (row.suggestion)
    return (
      <span className="flex items-center gap-2">
        <span className="truncate text-muted">Forslag: {row.suggestion.campaign.name}</span>
        <Button
          size="xs"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            changeAudit({ type: 'match', bingId: row.bing.id, googleId: row.suggestion!.googleId }).catch((err: unknown) => toast.error('Kunne ikke gemme', { description: errorMessage(err) }));
          }}
        >
          Bekræft
        </Button>
      </span>
    );
  return <span className="text-subtle">{googleReady ? 'Ikke valgt' : '–'}</span>;
}

function Overview({ rows, bingCurrency, googleCurrency, googleReady }: { rows: AuditRow[]; bingCurrency: string; googleCurrency: string; googleReady: boolean }) {
  const select = useAuditUi((s) => s.select);
  const head = 'border-b border-line px-3 py-2.5 text-[12px] font-medium text-muted';
  const cell = 'border-b border-line-2 px-3 py-2.5';
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left">
              <th className={cn(head, 'pl-4')}>Microsoft-kampagne</th>
              <th className={head}>Google-modpart</th>
              <th className={cn(head, 'w-[140px]')}>Fremskridt</th>
              <th className={cn(head, 'text-right')}>Omk. Microsoft</th>
              <th className={cn(head, 'text-right')}>Omk. Google</th>
              <th className={cn(head, 'text-right')}>ROAS Microsoft</th>
              <th className={cn(head, 'pr-4 text-right')}>ROAS Google</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = bingMetrics(r);
              const g = googleMetrics(r.google);
              const pct = r.progress.total ? Math.round((r.progress.done / r.progress.total) * 100) : 0;
              return (
                <tr key={r.bing.id} onClick={() => select(r.bing.id)} className="cursor-pointer transition-colors hover:bg-brand-50/30">
                  <td className={cn(cell, 'pl-4')}>
                    <span className="flex items-center gap-2">
                      {r.finished && <CircleCheck className="size-3.5 shrink-0 text-positive" />}
                      <span className={cn('font-medium', r.bing.status === 'Active' ? 'text-ink' : 'text-subtle')}>{r.bing.name}</span>
                      <span className="text-[11.5px] text-subtle">{BING_TYPE[r.bing.type] ?? r.bing.type}</span>
                    </span>
                  </td>
                  <td className={cn(cell, 'max-w-[280px]')}>
                    <MatchCell row={r} googleReady={googleReady} />
                  </td>
                  <td className={cell}>
                    <span className="flex items-center gap-2">
                      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-line-2">
                        <span className={cn('block h-full rounded-full', pct === 100 ? 'bg-positive' : 'bg-brand')} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-9 text-right text-[11.5px] tabular text-muted">
                        {r.progress.done}/{r.progress.total}
                      </span>
                    </span>
                  </td>
                  <td className={cn(cell, 'text-right tabular text-ink-2')}>{b ? fmtMoney(b.spend, bingCurrency) : '–'}</td>
                  <td className={cn(cell, 'text-right tabular text-ink-2')}>{g ? fmtMoney(g.spend, googleCurrency) : '–'}</td>
                  <td className={cn(cell, 'text-right tabular text-ink-2')}>{b?.roas != null ? fmtNumber(b.roas, 2) : '–'}</td>
                  <td className={cn(cell, 'pr-4 text-right tabular text-ink-2')}>{g?.roas != null ? fmtNumber(g.roas, 2) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------- one campaign ---------------------------------- */

const NONE = '__none';

function MatchPicker({ row, google }: { row: AuditRow; google: GoogleCampaign[] }) {
  const ranked = rankCandidates(row.bing, google);
  const score = new Map(ranked.map((s) => [s.googleId, s.score]));
  const ordered = [...google].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'da'));
  const value = row.audit?.googleId === null ? NONE : (row.audit?.googleId ?? null);
  const save = (googleId: string | null) =>
    changeAudit({ type: 'match', bingId: row.bing.id, googleId }).catch((e: unknown) => toast.error('Kunne ikke gemme matchet', { description: errorMessage(e) }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        aria-label="Google-modpart"
        value={value}
        onChange={(v) => void save(v === NONE ? null : v)}
        placeholder="Vælg Google-kampagne …"
        className="w-full max-w-[520px]"
        contentClassName="max-h-[360px] overflow-y-auto"
        options={[
          ...ordered.map((g) => ({
            value: g.id,
            label: g.name,
            description: `${GOOGLE_CHANNEL[g.channel] ?? g.channel} · ${GOOGLE_STATUS[g.status] ?? g.status}${g.id === row.suggestion?.googleId ? ' · forslag' : ''}`,
          })),
          { value: NONE, label: 'Ingen modpart i Google', description: 'Sammenlign med kontoen som helhed' },
        ]}
      />
      {row.suggestion && (
        <Button variant="secondary" size="sm" onClick={() => void save(row.suggestion!.googleId)}>
          Bekræft forslag: {row.suggestion.campaign.name}
        </Button>
      )}
      {row.audit?.googleId !== undefined && row.audit.matchedBy && (
        <span className="text-[12px] text-subtle">
          Valgt af {row.audit.matchedBy} {row.audit.matchedAt ? fmtRelative(row.audit.matchedAt) : ''}
        </span>
      )}
    </div>
  );
}

type Better = 'higher' | 'lower' | null;

function DiffCell({ bing, google, better }: { bing: number | null; google: number | null; better: Better }) {
  const d = change(bing, google);
  if (d === null) return <span className="text-subtle">–</span>;
  if (!better) return <span className="text-subtle">{fmtPercent(1 + d, 0)} af Google</span>;
  const good = better === 'higher' ? d >= 0 : d <= 0;
  return <span className={cn('font-medium', Math.abs(d) < 0.05 ? 'text-muted' : good ? 'text-positive' : 'text-negative')}>{`${d > 0 ? '+' : ''}${fmtPercent(d, 0)}`}</span>;
}

function CompareTable({ row, bingCurrency, googleCurrency }: { row: AuditRow; bingCurrency: string; googleCurrency: string }) {
  const g = row.google;
  const b = bingMetrics(row) ?? derive({ impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });
  const gm = googleMetrics(g);
  const lines: { label: string; bing: ReactNode; google: ReactNode; diff?: ReactNode }[] = [
    { label: 'Status', bing: statusLabel(row.bing.status), google: g ? (GOOGLE_STATUS[g.status] ?? g.status) : '–' },
    { label: 'Kampagnetype', bing: BING_TYPE[row.bing.type] ?? row.bing.type, google: g ? (GOOGLE_CHANNEL[g.channel] ?? g.channel) : '–' },
    {
      label: 'Dagsbudget',
      bing: row.bing.sharedBudgetId ? 'Delt budget' : fmtMoney(row.bing.dailyBudget, bingCurrency),
      google: g ? `${fmtMoney(g.dailyBudget, googleCurrency)}${g.sharedBudget ? ' (delt)' : ''}` : '–',
    },
    { label: 'Budstrategi', bing: `${bidLabel(row.bing.bidStrategy)}${row.bing.portfolioBidStrategyId ? ' · porteføljestrategi' : ''}`, google: g ? googleBid(g, googleCurrency) : '–' },
  ];
  // Amounts in each account's own currency.
  const metric = (label: string, key: keyof DerivedMetrics, fmt: (v: number | null, currency: string) => string, better: Better) =>
    lines.push({
      label,
      bing: fmt(b[key], bingCurrency),
      google: gm ? fmt(gm[key], googleCurrency) : '–',
      diff: gm ? <DiffCell bing={b[key]} google={gm[key]} better={better} /> : null,
    });
  metric('Visninger', 'impressions', (v) => fmtNumber(v), null);
  metric('Klik', 'clicks', (v) => fmtNumber(v), null);
  metric('CTR', 'ctr', (v) => fmtPercent(v, 2), 'higher');
  metric('Gns. CPC', 'cpc', (v, c) => fmtMoney(v, c, 2), 'lower');
  metric('Omkostning', 'spend', (v, c) => fmtMoney(v, c), null);
  metric('Konverteringer', 'conversions', (v) => fmtNumber(v, 1), null);
  metric('Konv.-rate', 'convRate', (v) => fmtPercent(v, 2), 'higher');
  metric('Konv.-værdi', 'revenue', (v, c) => fmtMoney(v, c), null);
  metric('ROAS', 'roas', (v) => fmtNumber(v, 2), 'higher');
  metric('Pris pr. konv.', 'cpa', (v, c) => fmtMoney(v, c), 'lower');

  const head = 'border-b border-line px-4 py-2.5 text-[12px] font-medium text-muted';
  const cell = 'border-b border-line-2 px-4 py-2';
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left">
            <th className={cn(head, 'w-[180px]')} />
            <th className={head}>Microsoft Advertising</th>
            <th className={head}>Google Ads {g ? '' : row.audit?.googleId === null ? '(ingen modpart)' : row.audit?.googleId ? '(kampagnen er ikke hentet)' : '(ingen modpart valgt)'}</th>
            <th className={cn(head, 'text-right')}>Microsoft mod Google</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <td className={cn(cell, 'font-medium text-ink-2')}>{l.label}</td>
              <td className={cn(cell, 'tabular text-ink')}>{l.bing}</td>
              <td className={cn(cell, 'tabular text-ink')}>{l.google}</td>
              <td className={cn(cell, 'text-right tabular')}>{l.diff ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line-2 px-4 py-2.5 text-[12px] leading-relaxed text-subtle">
        Konverteringer og konverteringsværdi tælles ikke ens i de to platforme (attribution, tidsvindue og hvilke handlinger der tæller med), så sammenlign retning og størrelsesorden – ikke
        decimalerne. ROAS-mål er forholdstal (4,5 = 450 %).
      </p>
      {bingCurrency && googleCurrency && bingCurrency !== googleCurrency && (
        <p className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-warning">
          <TriangleAlert className="size-3.5" /> Kontiene har forskellig valuta ({bingCurrency} og {googleCurrency}) – beløbene kan ikke sammenlignes direkte.
        </p>
      )}
    </div>
  );
}

/** Where the data for a step is, while the comparisons beyond the campaign itself are being built. */
const SHOWN_ABOVE = new Set(['match', 'setup', 'budget', 'performance']);

function StepRow({ step, index, row }: { step: AuditStep; index: number; row: AuditRow }) {
  const mark = row.audit?.steps[step.id];
  const applies = stepApplies(step, row.bing.type);
  const stepTab = STEP_TAB[step.id];
  const tab = stepTab && tabsFor(row.bing.type).includes(stepTab) ? stepTab : null;
  const set = (status: StepStatus | null) =>
    changeAudit({ type: 'step', bingId: row.bing.id, step: step.id, status }).catch((e: unknown) => toast.error('Kunne ikke gemme', { description: errorMessage(e) }));
  return (
    <li className={cn('flex gap-3 border-b border-line-2 px-4 py-3 last:border-0', !applies && !mark && 'opacity-55')}>
      <Tooltip content={mark?.status === 'done' ? 'Markér som ikke gjort' : 'Markér som gjort'}>
        <button
          type="button"
          role="checkbox"
          aria-checked={mark?.status === 'done'}
          aria-label={`${step.title}: gjort`}
          onClick={() => void set(mark?.status === 'done' ? null : 'done')}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
            mark?.status === 'done' ? 'border-positive bg-positive text-white' : 'border-line hover:border-brand',
          )}
        >
          {mark?.status === 'done' && <Check className="size-3" />}
        </button>
      </Tooltip>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink">
          <span className="tabular text-subtle">{index + 1}.</span>
          <span className={cn(mark?.status === 'na' && 'text-subtle line-through')}>{step.title}</span>
          {!applies && <Badge>Ikke relevant for {BING_TYPE[row.bing.type] ?? row.bing.type}</Badge>}
          {applies && SHOWN_ABOVE.has(step.id) && <Badge tone="brand">Data ovenfor</Badge>}
          {applies && tab && (
            <button
              type="button"
              onClick={() => {
                useAuditUi.getState().setTab(tab);
                document.getElementById('audit-compare')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand hover:bg-brand-50/70"
            >
              Se: {TAB_LABEL[tab]}
            </button>
          )}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{step.what}</p>
        {mark && (
          <p className="mt-1 text-[11.5px] text-subtle">
            {mark.status === 'done' ? 'Gjort' : 'Ikke relevant'} · {mark.by} · {fmtRelative(mark.at)}
          </p>
        )}
      </div>
      {applies && mark?.status !== 'done' && (
        <Button variant="ghost" size="xs" className="shrink-0 self-start" onClick={() => void set(mark?.status === 'na' ? null : 'na')}>
          {mark?.status === 'na' ? 'Relevant alligevel' : 'Ikke relevant'}
        </Button>
      )}
    </li>
  );
}

function CampaignNote({ row }: { row: AuditRow }) {
  const saved = row.audit?.note?.text ?? '';
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved, row.bing.id]);
  const save = () => {
    if (text.trim() === saved) return;
    changeAudit({ type: 'note', bingId: row.bing.id, text }).catch((e: unknown) => toast.error('Kommentaren blev ikke gemt', { description: errorMessage(e) }));
  };
  return (
    <div className="grid gap-2">
      <h3 className="text-[14px] font-medium text-ink">Kampagnekommentar</h3>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={save} rows={4} maxLength={4000} placeholder="Hvad blev fundet, hvad blev ændret, og hvad skal følges op?" />
      {row.audit?.note && (
        <p className="text-[11.5px] text-subtle">
          Gemt af {row.audit.note.by} · {fmtRelative(row.audit.note.at)}
        </p>
      )}
    </div>
  );
}

/** Hands the whole 1:1 comparison to the assistant: it reads both, and proposes Microsoft changes on cards. */
function AskMatchup({ row, google }: { row: AuditRow; google: GoogleCampaign }) {
  const go = useUi((s) => s.go);
  const ask = () =>
    [
      `Lav en 1:1 matchup af Microsoft-kampagnen "${row.bing.name}" (id ${row.bing.id}) mod Google-kampagnen "${google.name}" (id ${google.id}).`,
      'Brug compare_with_google og gå i detaljer: annoncegrupper, søgeord, negative søgeord, produktgrupper og varenumre, søgetermer og annoncer.',
      'Fortæl kort, hvad der er forskelligt, og foreslå derefter rettelserne i Microsoft på godkendelseskort – én slags ad gangen.',
      'Ændr ikke kampagneindstillinger som budstrategi, budget, mål, status, placeringer eller tidsplan – nævn kun forskellene. Google må aldrig ændres; den læses kun.',
    ].join('\n');
  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          go('chat');
          startChat(ask());
        }}
      >
        <MessageSquare /> Spørg assistenten om 1:1 matchup
      </Button>
    </div>
  );
}

function CampaignAuditView({ row, google, range, bingCurrency, googleCurrency, googleReady }: { row: AuditRow; google: GoogleCampaign[]; range: DateRange; bingCurrency: string; googleCurrency: string; googleReady: boolean }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[20px] font-medium tracking-[-0.02em] text-ink">{row.bing.name}</h2>
          <Badge>{BING_TYPE[row.bing.type] ?? row.bing.type}</Badge>
          <Badge tone={row.bing.status === 'Active' ? 'positive' : 'neutral'}>{statusLabel(row.bing.status)}</Badge>
          {row.finished && <Badge tone="positive">Færdig</Badge>}
          <span className="ml-auto text-[12.5px] tabular text-muted">
            {row.progress.done} af {row.progress.total} trin
          </span>
        </div>
        {googleReady ? <MatchPicker row={row} google={google} /> : <p className="text-[13px] text-muted">Forbind Google Ads for at vælge modparten.</p>}
        {googleReady && row.google && <AskMatchup row={row} google={row.google} />}
      </div>
      <CompareTable row={row} bingCurrency={bingCurrency} googleCurrency={googleCurrency} />
      <DetailCompare row={row} range={range} bingCurrency={bingCurrency} googleCurrency={googleCurrency} />
      <div className="grid gap-2">
        <h3 className="text-[14px] font-medium text-ink">Trin</h3>
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
          {AUDIT_STEPS.map((s, i) => (
            <StepRow key={s.id} step={s} index={i} row={row} />
          ))}
        </ol>
      </div>
      <CampaignNote row={row} />
    </div>
  );
}

/* ---------------------------------- the page ---------------------------------- */

export function AuditPage() {
  const { range, rows, bing, google, audits, googleConnected } = useAuditModel();
  const selected = useAuditUi((s) => s.selected);
  const select = useAuditUi((s) => s.select);
  const period = useAuditUi((s) => s.period);
  const setPeriod = useAuditUi((s) => s.setPeriod);
  const info = useAccount((s) => s.workspace?.google);
  const account = useCurrentAccount();
  const bingCurrency = account?.currency ?? 'DKK';
  const googleCurrency = google.data?.account.currency || info?.currency || bingCurrency;
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const row = rows.find((r) => r.bing.id === selected) ?? null;
  const googleReady = googleConnected && !!google.data;

  // A campaign that is no longer there (another account, deleted): back to the overview.
  useEffect(() => {
    if (selected && bing.data && !row) select(null);
  }, [selected, bing.data, row, select]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([googleConnected ? refreshGoogle(range) : null, bing.refetch(), audits.refetch()]);
    } catch (e) {
      toast.error('Google Ads kunne ikke hentes', { description: errorMessage(e) });
    } finally {
      setRefreshing(false);
    }
  };

  const googleError = (google.error as Error | null)?.message ?? google.data?.error ?? null;

  return (
    <motion.div {...pageTransition} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-8 pb-4 pt-7">
        <div className="mr-auto">
          <h1 className="text-[26px] font-medium tracking-[-0.03em] text-ink">Audit</h1>
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
            {account?.name ?? 'Microsoft Advertising'} mod
            {googleConnected ? (
              <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 text-ink-2 hover:text-brand">
                <Lock className="size-3" /> {info?.accountName ?? 'Google Ads'} ({fmtCustomer(info?.customerId)}) · kun læsning
              </button>
            ) : (
              <span>Google Ads (ikke forbundet)</span>
            )}
            {google.data && <span>· Google hentet {fmtRelative(google.data.fetchedAt)}</span>}
          </p>
        </div>
        <Segmented
          layoutId="audit-period"
          value={period}
          onChange={(v: AuditPeriod) => setPeriod(v)}
          options={(Object.keys(PERIOD_LABELS) as AuditPeriod[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
        />
        <Button variant="secondary" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn(refreshing && 'animate-spin')} /> Opdatér
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10">
        <div className="grid gap-6">
          {(!googleConnected || editing) && <ConnectGoogle onDone={() => setEditing(false)} />}
          {googleConnected && googleError && (
            <p className="flex gap-2 rounded-xl bg-warning-bg px-4 py-3 text-[13px] leading-relaxed text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {google.data ? `Viser den seneste kopi. ${googleError}` : googleError}
            </p>
          )}
          {googleConnected && google.isPending && (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Henter Google Ads-kampagner (kun læsning) …
            </p>
          )}
          {bing.error ? (
            <p className="flex gap-2 rounded-xl bg-negative-bg px-4 py-3 text-[13px] text-negative">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> Microsoft Advertising: {errorMessage(bing.error)}
            </p>
          ) : bing.isPending ? (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Henter Microsoft-kampagner …
            </p>
          ) : row ? (
            <CampaignAuditView row={row} google={google.data?.campaigns ?? []} range={range} bingCurrency={bingCurrency} googleCurrency={googleCurrency} googleReady={googleReady} />
          ) : (
            <Overview rows={rows} bingCurrency={bingCurrency} googleCurrency={googleCurrency} googleReady={googleReady} />
          )}
          <p className="text-[12px] text-subtle">
            Periode: {range.from} – {range.to}, hele dage, ens for begge kontoer. Google læses højst én gang i døgnet pr. periode, medmindre der trykkes Opdatér.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
