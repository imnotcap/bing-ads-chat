/**
 * Indstillinger → Budget og grænser: monthly budget, ceilings, goals and what may be
 * proposed – per branch, shared by the team (src/ai/branchLimits.ts). Microsoft
 * Advertising also gets its protected campaigns (from the account) and the emergency stop.
 */
import { OctagonPause } from '@/components/icons';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { getBackend } from '@/bing/backend';
import { invalidateSpendCache } from '@/bing/spend';
import { ElasticSlider } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { Switch, SwitchRow } from '@/components/ui/controls';
import { NumberInput, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/overlays';
import { useCampaigns, useSelectedRange } from '@/hooks/useAdsData';
import { fmtMoney } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { cn, errorMessage } from '@/lib/utils';
import { DEFAULT_LIMITS, LIMIT_BRANCH_IDS, branchName, effectiveLimits, limitGroups, limitKind, type BranchLimits, type LimitBranchId, type LimitField } from '@/ai/branchLimits';
import { useActivity } from '@/stores/activity';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { loadLimits, saveLimits, useLimits } from '@/workspace/limits';
import { ConnectorLogo } from './ConnectorLogo';
import { ApprovalNotice, SharedBy } from './forms';
import { Card } from './SettingsCard';

/** Changes are saved shortly after the last keystroke (one request, not one per digit). */
function useLimitEditor(id: LimitBranchId) {
  const stored = useLimits((s) => s.stored?.[id] ?? null);
  const [pending, setPending] = useState<Partial<BranchLimits>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(pending);
  latest.current = pending;

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const values = latest.current;
    if (!Object.keys(values).length) return;
    setPending({});
    saveLimits(id, values).catch((e) => toast.error('Kunne ikke gemme grænserne', { description: errorMessage(e) }));
  };
  // Save what's typed when switching branch or closing settings.
  useEffect(() => () => flush(), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<BranchLimits>) => {
    setPending((p) => ({ ...p, ...patch }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };
  return { values: { ...effectiveLimits(stored), ...pending }, stored, update };
}

function FieldRow({ field, value, onChange, currency }: { field: LimitField; value: BranchLimits[keyof BranchLimits]; onChange: (v: unknown) => void; currency: string }) {
  if (field.type === 'switch') return <SwitchRow label={field.label} description={field.hint} checked={value as boolean} onCheckedChange={onChange} />;
  const left = (
    <div>
      <div className="text-sm font-medium text-ink">{field.label}</div>
      {field.hint && <div className="text-[12.5px] leading-relaxed text-muted">{field.hint}</div>}
    </div>
  );
  let control: React.ReactNode;
  if (field.type === 'list') {
    control = (
      <Textarea
        value={(value as string[]).join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        onBlur={(e) => onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))}
        rows={3}
        placeholder="Ingen"
        className="min-h-16 text-[13px]"
        aria-label={field.label}
      />
    );
  } else if (field.key === 'warnAtPct') {
    control = <ElasticSlider label={field.label} value={value as number} min={50} max={100} step={5} format={(v) => `${v} %`} onChange={onChange} />;
  } else if (field.key === 'maxBudgetIncreasePct') {
    control = (
      <div className="flex items-center gap-3">
        <Switch checked={value !== null} onCheckedChange={(on) => onChange(on ? (DEFAULT_LIMITS.maxBudgetIncreasePct ?? 20) : null)} aria-label={`${field.label} til/fra`} />
        {value !== null ? (
          <ElasticSlider label={field.label} value={value as number} min={5} max={200} step={5} format={(v) => `+${v} %`} onChange={onChange} className="flex-1" />
        ) : (
          <span className="text-[13px] text-muted">Ingen advarsel</span>
        )}
      </div>
    );
  } else {
    const suffix = field.type === 'money' ? currency : field.type === 'pct' ? '%' : field.key === 'maxRows' ? 'rækker' : '';
    control = (
      <NumberInput
        value={value as number | null}
        onChange={(v) => onChange(field.key === 'maxRows' ? (v ?? DEFAULT_LIMITS.maxRows) : v)}
        suffix={suffix}
        step={field.step ?? 1}
        placeholder={field.key === 'maxRows' ? String(DEFAULT_LIMITS.maxRows) : 'Ingen grænse'}
        aria-label={field.label}
      />
    );
  }
  return (
    <div className="grid items-center gap-2 border-b border-line-2 py-3.5 last:border-0 md:grid-cols-[1fr_260px]">
      {left}
      {control}
    </div>
  );
}

function ProtectedCampaigns({ values, update }: { values: BranchLimits; update: (p: Partial<BranchLimits>) => void }) {
  const range = useSelectedRange();
  const campaigns = useCampaigns(range);
  const currency = useCurrentAccount()?.currency ?? 'DKK';
  return (
    <Card title="Beskyttede kampagner" description="Assistenten må hverken ændre disse kampagner eller deres annoncegrupper, søgeord og annoncer.">
      {!campaigns.data ? (
        <div className="h-24 animate-pulse rounded-xl bg-line-2" />
      ) : (
        <div className="grid gap-1.5 md:grid-cols-2">
          {campaigns.data.map((c) => {
            const on = values.protectedCampaignIds.includes(c.id);
            return (
              <label key={c.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors', on ? 'border-brand/30 bg-brand-50/50' : 'border-line hover:bg-line-2/50')}>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => update({ protectedCampaignIds: v ? [...values.protectedCampaignIds, c.id] : values.protectedCampaignIds.filter((x) => x !== c.id) })}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{c.name}</span>
                <span className="text-[12px] tabular text-muted">{fmtMoney(c.dailyBudget, currency)}/dag</span>
              </label>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function EmergencyStop() {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stop = async () => {
    setStopping(true);
    try {
      const accountId = useConnection.getState().accountId!;
      const backend = await getBackend();
      const active = (await backend.listCampaigns(accountId)).filter((c) => c.status === 'Active');
      if (active.length) {
        await backend.updateCampaigns(accountId, active.map((c) => ({ campaignId: c.id, status: 'Paused' })));
        useActivity.getState().add({
          source: 'user',
          mode,
          accountId,
          tool: 'update_campaigns',
          summary: `Nødstop: ${active.length} kampagner sat på pause`,
          changes: active.map((c) => ({ entity: 'Kampagne', entityId: c.id, field: `${c.name} · status`, before: 'Aktiv', after: 'Pauset' })),
          status: 'success',
          undo: { tool: 'update_campaigns', input: { changes: active.map((c) => ({ campaignId: c.id, status: 'Active' })), reason: 'Fortryd nødstop' } },
        });
      }
      invalidateSpendCache();
      void queryClient.invalidateQueries();
      toast.success(active.length ? `${active.length} kampagner er sat på pause` : 'Der var ingen aktive kampagner');
      setOpen(false);
    } catch (e) {
      toast.error('Nødstop fejlede', { description: errorMessage(e) });
    } finally {
      setStopping(false);
    }
  };
  return (
    <>
      <Card
        title="Nødstop"
        description="Sætter alle aktive kampagner på pause med det samme. Kan fortrydes under Aktivitet."
        action={
          <Button variant="destructive" onClick={() => setOpen(true)}>
            <OctagonPause /> Pause alle kampagner
          </Button>
        }
      >
        <p className="text-[12.5px] text-muted">Brug den, hvis noget løber løbsk – fx et uventet højt forbrug.</p>
      </Card>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Pause alle kampagner?"
        description={`Alle aktive kampagner på ${account?.name ?? 'kontoen'} sættes på pause${mode === 'demo' ? ' (demo-konto)' : ''}. Du kan genaktivere dem fra Aktivitet.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annullér
            </Button>
            <Button variant="destructive" disabled={stopping} onClick={stop}>
              <OctagonPause /> Pause alt
            </Button>
          </>
        }
      />
    </>
  );
}

function BranchLimitsForm({ id }: { id: LimitBranchId }) {
  const { values, stored, update } = useLimitEditor(id);
  const accountCurrency = useCurrentAccount()?.currency;
  const currency = id === 'microsoft_ads' ? (accountCurrency ?? 'DKK') : 'DKK';
  const kind = limitKind(id);
  const set = (key: keyof BranchLimits) => (v: unknown) => update({ [key]: v } as Partial<BranchLimits>);
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <span>
          {id === 'microsoft_ads'
            ? 'Håndhæves af appen i chatten: ændringer over lofterne blokeres, og alt kræver din godkendelse.'
            : kind === 'read'
              ? 'Grenen læser kun data – her styrer I, hvor meget den må hente ad gangen.'
              : 'Gives til chatten som rammer i dag – og håndhæves, når grenen får sin egen assistent.'}
        </span>
        <span className="ml-auto">{stored?.updatedBy ? <SharedBy by={stored.updatedBy} at={stored.updatedAt} /> : 'Standardværdier'}</span>
      </div>
      {limitGroups(id).map((g) => (
        <Card key={g.title} title={g.title} description={g.description}>
          {g.fields.map((f) => (
            <FieldRow key={f.key} field={f} value={values[f.key]} onChange={set(f.key)} currency={currency} />
          ))}
        </Card>
      ))}
      {id === 'microsoft_ads' && (
        <>
          <ProtectedCampaigns values={values} update={update} />
          <EmergencyStop />
        </>
      )}
    </div>
  );
}

export function BudgetTab() {
  const [branch, setBranch] = useState<LimitBranchId>('microsoft_ads');
  const stored = useLimits((s) => s.stored);
  const error = useLimits((s) => s.error);
  useEffect(() => {
    void loadLimits();
  }, []);
  return (
    <div className="grid gap-5">
      <Card title="Godkendelse af ændringer" description="Gælder alle grene. Alle ændringer logges og kan fortrydes under Aktivitet.">
        <ApprovalNotice />
      </Card>

      <section className="grid gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Budget og grænser pr. gren</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Fælles for alle i appen. Vælg en gren – hver har de indstillinger, der passer til den. Grenens playbook finder I under{' '}
            <button type="button" className="font-medium text-brand hover:underline" onClick={() => useUi.getState().go('settings', 'training')}>
              Træning
            </button>
            .
          </p>
        </div>
        {error && !stored && <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning">Grænserne kunne ikke hentes fra Cloudflare – appen bruger de senest kendte for Microsoft Advertising: {error}</p>}
        <div role="tablist" aria-label="Gren" className="flex flex-wrap gap-1.5">
          {LIMIT_BRANCH_IDS.map((b) => {
            const active = b === branch;
            const changed = Object.keys(stored?.[b]?.values ?? {}).length > 0;
            return (
              <button
                key={b}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBranch(b)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[12.5px] transition-colors',
                  active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-black/15',
                )}
              >
                <ConnectorLogo id={b} small />
                {branchName(b)}
                {changed && <span className={cn('size-1.5 rounded-full', active ? 'bg-white' : 'bg-brand')} aria-label="tilpasset" />}
              </button>
            );
          })}
        </div>
      </section>

      <BranchLimitsForm key={branch} id={branch} />
    </div>
  );
}
