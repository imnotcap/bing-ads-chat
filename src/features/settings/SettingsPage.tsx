import { AnimatePresence, motion } from 'motion/react';
import { Bot, Building2, Database, Download, OctagonPause, Palette, Plug, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EFFORT_LABELS, MODELS, modelInfo, type Effort } from '@/ai/models';
import { getBackend } from '@/bing/backend';
import { DemoBackend } from '@/bing/demo/backend';
import { invalidateSpendCache } from '@/bing/spend';
import { ElasticSlider } from '@/components/reactbits';
import { EASE, pageTransition } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Badge, Segmented, Switch, SwitchRow } from '@/components/ui/controls';
import { Field, Input, NumberInput, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/overlays';
import { useCampaigns, useSelectedRange } from '@/hooks/useAdsData';
import { fmtMoney, fmtNumber, fmtUsd, monthKey } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { cn, errorMessage } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import { useChat } from '@/stores/chat';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { DEFAULT_SPEND_RULES, useSettings } from '@/stores/settings';
import { useUi, type SettingsTab } from '@/stores/ui';
import { monthTotal, useUsage } from '@/stores/usage';
import { switchToDemo } from './connection';
import { ApprovalModePicker, ClaudeKeyForm, MicrosoftConnectForm, MicrosoftSetupGuide } from './forms';

const TABS: { id: SettingsTab; label: string; icon: LucideIcon; description: string }[] = [
  { id: 'connections', label: 'Forbindelser', icon: Plug, description: 'Claude og Microsoft Advertising' },
  { id: 'spend', label: 'Forbrug', icon: Wallet, description: 'Budgetter, grænser og godkendelse' },
  { id: 'ai', label: 'AI-assistent', icon: Bot, description: 'Model, tænkning og AI-forbrug' },
  { id: 'business', label: 'Virksomhed', icon: Building2, description: 'Kontekst til bedre råd' },
  { id: 'appearance', label: 'Udseende', icon: Palette, description: 'Animationer og layout' },
  { id: 'data', label: 'Data', icon: Database, description: 'Eksport og nulstilling' },
];

function Card({ title, description, children, className, action }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn('card p-6', className)}>
      <div className="mb-5 flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-[16px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------- Forbindelser ------------------------------- */

function ConnectionsTab() {
  const mode = useConnection((s) => s.mode);
  return (
    <div className="grid gap-5">
      <Card title="Claude (AI)" description="Assistenten bruger Anthropics Claude API. Du betaler selv for forbruget via din Anthropic-konto.">
        <ClaudeKeyForm />
      </Card>
      <Card
        title="Microsoft Advertising"
        description="Forbind din rigtige Bing Ads-konto. Indtil da bruger appen en realistisk demo-konto, så du kan prøve alt af uden risiko."
        action={
          <Segmented
            layoutId="mode-switch"
            size="sm"
            value={mode}
            onChange={(m) => (m === 'demo' ? switchToDemo() : toast('Log ind med Microsoft nedenfor for at bruge din rigtige konto'))}
            options={[
              { value: 'demo', label: 'Demo' },
              { value: 'live', label: 'Rigtig konto' },
            ]}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <MicrosoftConnectForm />
          <div className="rounded-2xl bg-line-2/70 p-4">
            <div className="mb-3 text-[13px] font-semibold text-ink">Sådan får du adgang</div>
            <MicrosoftSetupGuide />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------- Forbrug ---------------------------------- */

function LimitRow({ label, hint, value, onChange, suffix, step = 1 }: { label: string; hint: string; value: number | null; onChange: (v: number | null) => void; suffix: string; step?: number }) {
  return (
    <div className="grid items-center gap-2 border-b border-line-2 py-3.5 last:border-0 md:grid-cols-[1fr_220px]">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-[12.5px] leading-relaxed text-muted">{hint}</div>
      </div>
      <NumberInput value={value} onChange={onChange} suffix={suffix} step={step} aria-label={label} />
    </div>
  );
}

function SpendTab() {
  const spend = useSettings((s) => s.spend);
  const setSpend = useSettings((s) => s.setSpend);
  const account = useCurrentAccount();
  const currency = account?.currency ?? 'DKK';
  const range = useSelectedRange();
  const campaigns = useCampaigns(range);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const mode = useConnection((s) => s.mode);

  const emergencyStop = async () => {
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
      setStopOpen(false);
    } catch (e) {
      toast.error('Nødstop fejlede', { description: errorMessage(e) });
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="grid gap-5">
      <Card title="Godkendelse af ændringer" description="Bestem hvor meget assistenten må gøre på egen hånd. Alle ændringer logges og kan fortrydes under Aktivitet.">
        <ApprovalModePicker value={spend.approvalMode} onChange={(approvalMode) => setSpend({ approvalMode })} />
      </Card>

      <Card title="Månedsbudget og budgetvagt" description="Appen holder øje med forbruget, mens den er åben, og advarer – eller stopper – når budgettet nærmer sig.">
        <LimitRow
          label="Samlet månedsbudget"
          hint="Bruges til prognoser, advarsler og til at stoppe budgetforøgelser, der vil overskride måneden."
          value={spend.monthlyBudget}
          onChange={(monthlyBudget) => setSpend({ monthlyBudget })}
          suffix={currency}
        />
        <div className="grid items-center gap-3 border-b border-line-2 py-3.5 md:grid-cols-[1fr_320px]">
          <div>
            <div className="text-sm font-medium text-ink">Advar ved</div>
            <div className="text-[12.5px] text-muted">Du får en notifikation, når denne andel af månedsbudgettet er brugt.</div>
          </div>
          <ElasticSlider label="Advar ved procent af månedsbudget" value={spend.warnAtPct} min={50} max={100} step={5} format={(v) => `${v} %`} onChange={(warnAtPct) => setSpend({ warnAtPct })} />
        </div>
        <SwitchRow
          label="Budgetvagt: pause alt ved 100 %"
          description="Sætter alle aktive kampagner (undtagen beskyttede) på pause, når månedsbudgettet er brugt. Kan fortrydes under Aktivitet."
          checked={spend.autoPauseAtMonthlyBudget}
          disabled={spend.monthlyBudget === null}
          onCheckedChange={(autoPauseAtMonthlyBudget) => setSpend({ autoPauseAtMonthlyBudget })}
        />
      </Card>

      <Card title="Grænser for assistenten" description="Hårde grænser blokerer ændringer helt. Tom = ingen grænse.">
        <LimitRow
          label="Maks. dagsbudget pr. kampagne"
          hint="Assistenten kan ikke sætte et dagsbudget højere end dette."
          value={spend.maxDailyBudgetPerCampaign}
          onChange={(maxDailyBudgetPerCampaign) => setSpend({ maxDailyBudgetPerCampaign })}
          suffix={currency}
        />
        <LimitRow
          label="Maks. samlet dagsbudget"
          hint="Summen af alle aktive kampagners dagsbudgetter."
          value={spend.maxTotalDailyBudget}
          onChange={(maxTotalDailyBudget) => setSpend({ maxTotalDailyBudget })}
          suffix={currency}
        />
        <LimitRow label="Maks. CPC-bud" hint="Højeste bud på søgeord og annoncegrupper." value={spend.maxCpcBid} onChange={(maxCpcBid) => setSpend({ maxCpcBid })} suffix={currency} step={0.01} />
        <div className="grid items-center gap-3 border-b border-line-2 py-3.5 md:grid-cols-[1fr_320px]">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              Budgetstigning der altid kræver godkendelse
              <Switch
                checked={spend.maxBudgetIncreasePct !== null}
                onCheckedChange={(on) => setSpend({ maxBudgetIncreasePct: on ? (DEFAULT_SPEND_RULES.maxBudgetIncreasePct ?? 50) : null })}
                aria-label="Slå grænse for budgetstigning til"
              />
            </div>
            <div className="text-[12.5px] text-muted">Gælder også i autopilot.</div>
          </div>
          {spend.maxBudgetIncreasePct !== null ? (
            <ElasticSlider label="Maks. budgetstigning" value={spend.maxBudgetIncreasePct} min={5} max={200} step={5} format={(v) => `+${v} %`} onChange={(maxBudgetIncreasePct) => setSpend({ maxBudgetIncreasePct })} />
          ) : (
            <span className="text-[13px] text-muted">Ingen grænse</span>
          )}
        </div>
        <SwitchRow label="Må oprette nye kampagner" checked={spend.allowCreateCampaigns} onCheckedChange={(allowCreateCampaigns) => setSpend({ allowCreateCampaigns })} />
        <SwitchRow label="Nye kampagner starter pauset" description="Så du kan se dem igennem, før de begynder at bruge penge." checked={spend.newEntitiesPaused} onCheckedChange={(newEntitiesPaused) => setSpend({ newEntitiesPaused })} />
        <SwitchRow label="Må slette" description="Kampagner og søgeord. Assistenten foretrækker at sætte på pause." checked={spend.allowDelete} onCheckedChange={(allowDelete) => setSpend({ allowDelete })} />
      </Card>

      <Card title="Beskyttede kampagner" description="Assistenten må hverken ændre disse kampagner eller deres annoncegrupper, søgeord og annoncer.">
        {!campaigns.data ? (
          <div className="h-24 animate-pulse rounded-xl bg-line-2" />
        ) : (
          <div className="grid gap-1.5 md:grid-cols-2">
            {campaigns.data.map((c) => {
              const on = spend.protectedCampaignIds.includes(c.id);
              return (
                <label key={c.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors', on ? 'border-brand/30 bg-brand-50/50' : 'border-line hover:bg-line-2/50')}>
                  <Switch
                    checked={on}
                    onCheckedChange={(v) =>
                      setSpend({ protectedCampaignIds: v ? [...spend.protectedCampaignIds, c.id] : spend.protectedCampaignIds.filter((x) => x !== c.id) })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{c.name}</span>
                  <span className="text-[12px] tabular text-muted">{fmtMoney(c.dailyBudget, currency)}/dag</span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Nødstop"
        description="Sætter alle aktive kampagner på pause med det samme. Kan fortrydes under Aktivitet."
        action={
          <Button variant="destructive" onClick={() => setStopOpen(true)}>
            <OctagonPause /> Pause alle kampagner
          </Button>
        }
      >
        <p className="text-[12.5px] text-muted">Brug den, hvis noget løber løbsk – fx et uventet højt forbrug.</p>
      </Card>

      <Dialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Pause alle kampagner?"
        description={`Alle aktive kampagner på ${account?.name ?? 'kontoen'} sættes på pause${mode === 'demo' ? ' (demo-konto)' : ''}. Du kan genaktivere dem fra Aktivitet.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStopOpen(false)}>
              Annullér
            </Button>
            <Button variant="destructive" disabled={stopping} onClick={emergencyStop}>
              <OctagonPause /> Pause alt
            </Button>
          </>
        }
      />
    </div>
  );
}

/* -------------------------------- AI-assistent -------------------------------- */

function AiTab() {
  const ai = useSettings((s) => s.ai);
  const setAi = useSettings((s) => s.setAi);
  const months = useUsage((s) => s.months);
  const resetUsage = useUsage((s) => s.reset);
  const total = monthTotal(months);
  const current = months[monthKey()] ?? {};
  const history = Object.keys(months).sort().reverse().slice(0, 6);
  const cap = ai.monthlyAiBudgetUsd;

  return (
    <div className="grid gap-5">
      <Card title="Model" description="Du kan også skifte model direkte i chatfeltet.">
        <div className="grid gap-2.5 md:grid-cols-2">
          {MODELS.map((m) => {
            const active = m.id === ai.model;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setAi({ model: m.id })}
                className={cn(
                  'flex flex-col rounded-2xl border p-4 text-left transition-[border-color,box-shadow]',
                  active ? 'border-brand/40 bg-brand-50/50 shadow-[0_0_0_4px_rgb(109_92_246/0.08)]' : 'border-line hover:border-black/10',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{m.label}</span>
                  {m.id === 'claude-opus-5-5' && <Badge tone="brand">Anbefalet</Badge>}
                </div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{m.description}</div>
                <div className="mt-2 text-[11.5px] text-subtle">
                  ${m.input} / ${m.output} pr. mio. tokens (input / output)
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Tænkning" description="Højere indsats giver grundigere analyser, men tager længere tid og koster mere.">
        <Field label="Indsats (effort)">
          <Segmented<Effort>
            layoutId="effort"
            value={ai.effort}
            onChange={(effort) => setAi({ effort })}
            options={(['low', 'medium', 'high', 'xhigh'] as Effort[]).map((e) => ({ value: e, label: EFFORT_LABELS[e].split(' – ')[0], title: EFFORT_LABELS[e] }))}
          />
        </Field>
        <p className="mt-2 text-[12.5px] text-muted">{EFFORT_LABELS[ai.effort]}</p>
        <div className="mt-3">
          <SwitchRow label="Vis assistentens tankegang" description="Viser et kort resumé af, hvordan assistenten ræsonnerer." checked={ai.showThinking} onCheckedChange={(showThinking) => setAi({ showThinking })} />
        </div>
      </Card>

      <Card title="AI-forbrug" description="Anslået ud fra Anthropics listepriser. Den faktiske regning ses i Anthropic Console.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-line-2/60 p-4">
            <div className="text-[12px] text-muted">Denne måned</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{fmtUsd(total.costUsd)}</div>
            <div className="text-[12px] text-muted">≈ {fmtMoney(total.costUsd * ai.usdToDkk, 'DKK')}</div>
          </div>
          <div className="rounded-2xl bg-line-2/60 p-4">
            <div className="text-[12px] text-muted">Forespørgsler</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{fmtNumber(total.requests)}</div>
            <div className="text-[12px] text-muted">{fmtNumber((total.inputTokens + total.cacheReadTokens + total.cacheWriteTokens) / 1000)}k input · {fmtNumber(total.outputTokens / 1000)}k output</div>
          </div>
          <div className="rounded-2xl bg-line-2/60 p-4">
            <div className="text-[12px] text-muted">Cache-træf</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">
              {total.inputTokens + total.cacheReadTokens ? Math.round((total.cacheReadTokens / (total.inputTokens + total.cacheReadTokens + total.cacheWriteTokens)) * 100) : 0} %
            </div>
            <div className="text-[12px] text-muted">af input læst fra cache</div>
          </div>
        </div>
        {cap !== null && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[12px] text-muted">
              <span>Månedligt AI-budget</span>
              <span>
                {fmtUsd(total.costUsd)} af {fmtUsd(cap)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <motion.div
                className={cn('h-full rounded-full', total.costUsd >= cap ? 'bg-negative' : 'bg-gradient-to-r from-brand to-violet')}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (total.costUsd / cap) * 100)}%` }}
                transition={{ duration: 0.8, ease: EASE }}
              />
            </div>
          </div>
        )}
        {Object.keys(current).length > 0 && (
          <table className="mt-4 w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Model</th>
                <th className="py-1 text-right font-medium">Forespørgsler</th>
                <th className="py-1 text-right font-medium">Pris</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(current).map(([model, b]) => (
                <tr key={model} className="border-t border-line-2">
                  <td className="py-1.5 text-ink-2">{modelInfo(model).label}</td>
                  <td className="py-1.5 text-right tabular">{fmtNumber(b.requests)}</td>
                  <td className="py-1.5 text-right tabular">{fmtUsd(b.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {history.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-muted">
            Tidligere:
            {history.slice(1).map((m) => (
              <Badge key={m}>
                {m}: {fmtUsd(monthTotal(months, m).costUsd)}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-5 grid gap-4 border-t border-line-2 pt-4 md:grid-cols-3">
          <Field label="Månedligt AI-budget" hint="Assistenten stopper, når grænsen er nået. Tom = ingen grænse.">
            <NumberInput value={cap} onChange={(monthlyAiBudgetUsd) => setAi({ monthlyAiBudgetUsd })} suffix="USD" />
          </Field>
          <Field label="Kurs USD → DKK" hint="Kun til visning.">
            <NumberInput value={ai.usdToDkk} onChange={(v) => setAi({ usdToDkk: v ?? 6.9 })} step={0.01} placeholder="6,90" />
          </Field>
          <Field label="Maks. værktøjsrunder pr. svar" hint="Sikkerhedsnet mod løkker.">
            <NumberInput value={ai.maxToolRounds} onChange={(v) => setAi({ maxToolRounds: Math.max(3, Math.min(100, v ?? 30)) })} placeholder="30" />
          </Field>
        </div>
        <div className="mt-4">
          <Button size="sm" variant="ghost" onClick={() => resetUsage()}>
            Nulstil forbrugstal
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- Virksomhed --------------------------------- */

function BusinessTab() {
  const b = useSettings((s) => s.business);
  const set = useSettings((s) => s.setBusiness);
  return (
    <Card title="Virksomhedsprofil" description="Assistenten bruger profilen til at give råd, der passer til din forretning – og til at skrive annoncer i jeres tone.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Virksomhedsnavn">
          <Input value={b.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="Nordlys Interiør" />
        </Field>
        <Field label="Website">
          <Input value={b.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://…" />
        </Field>
        <Field label="Hvad sælger I, og til hvem?" className="md:col-span-2">
          <Textarea value={b.description} onChange={(e) => set({ description: e.target.value })} placeholder="Fx: Kontormøbler til hjemmekontorer og små virksomheder i Danmark. Vigtigste kategorier er …" />
        </Field>
        <Field label="Mål-CPA" hint="Hvad må en konvertering koste?">
          <NumberInput value={b.targetCpa} onChange={(targetCpa) => set({ targetCpa })} suffix="kr." placeholder="Ikke sat" />
        </Field>
        <Field label="Mål-ROAS" hint="Fx 5 = 5 kr. omsætning pr. annoncekrone.">
          <NumberInput value={b.targetRoas} onChange={(targetRoas) => set({ targetRoas })} suffix="x" step={0.1} placeholder="Ikke sat" />
        </Field>
        <Field label="Dækningsgrad" hint="Bruges til at beregne break-even ROAS.">
          <NumberInput value={b.grossMarginPct} onChange={(grossMarginPct) => set({ grossMarginPct })} suffix="%" placeholder="Ikke sat" />
        </Field>
        <Field label="Tone of voice" hint="Til annoncetekster.">
          <Input value={b.toneOfVoice} onChange={(e) => set({ toneOfVoice: e.target.value })} placeholder="Venlig, faglig, uden udråbstegn" />
        </Field>
        <Field label="Egne instruktioner til assistenten" className="md:col-span-2" hint="Fx: “Rør aldrig brand-kampagnen”, “Svar kort”, “Vi har udsalg i uge 47”.">
          <Textarea value={b.instructions} onChange={(e) => set({ instructions: e.target.value })} />
        </Field>
      </div>
    </Card>
  );
}

/* ---------------------------------- Udseende ---------------------------------- */

function AppearanceTab() {
  const a = useSettings((s) => s.appearance);
  const set = useSettings((s) => s.setAppearance);
  return (
    <Card title="Udseende" description="Gør appen roligere eller mere levende.">
      <Field label="Animationer">
        <Segmented
          layoutId="anim"
          value={a.animations}
          onChange={(animations) => set({ animations })}
          options={[
            { value: 'system', label: 'Følg Windows' },
            { value: 'full', label: 'Altid' },
            { value: 'reduced', label: 'Reduceret' },
          ]}
        />
      </Field>
      <div className="mt-3">
        <SwitchRow label="Animeret baggrund" description="Bløde, langsomt bevægende farver bag chatten (Aurora)." checked={a.auroraBackground} onCheckedChange={(auroraBackground) => set({ auroraBackground })} />
        <SwitchRow label="Klik-gnister" description="Små gnister ved hvert klik." checked={a.clickSpark} onCheckedChange={(clickSpark) => set({ clickSpark })} />
        <SwitchRow label="Vis indsigtsvindue ved chatten" description="Nøgletal, budget og opmærksomhedspunkter i højre side. Kan også foldes sammen direkte i chatten." checked={a.insightsPanel} onCheckedChange={(insightsPanel) => set({ insightsPanel })} />
        <SwitchRow label="Kompakt menu" checked={a.sidebarCollapsed} onCheckedChange={(sidebarCollapsed) => set({ sidebarCollapsed })} />
      </div>
    </Card>
  );
}

/* ------------------------------------ Data ------------------------------------ */

function DataTab() {
  const [confirm, setConfirm] = useState<null | 'chats' | 'demo' | 'all'>(null);
  const clearChats = useChat((s) => s.clearAll);
  const mode = useConnection((s) => s.mode);

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      conversations: useChat.getState().conversations.map(({ api: _api, ...c }) => {
        void _api;
        return c;
      }),
      activity: useActivity.getState().entries,
      settings: { ...useSettings.getState() },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bing-ads-chat-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actions = {
    chats: { title: 'Slet alle samtaler?', description: 'Alle samtaler slettes fra denne computer.', run: () => clearChats() },
    demo: {
      title: 'Nulstil demo-kontoen?',
      description: 'Alle ændringer på demo-kontoen fjernes, og den starter forfra.',
      run: () => {
        DemoBackend.reset();
        useConnection.getState().bump();
        void queryClient.invalidateQueries();
      },
    },
    all: {
      title: 'Nulstil alle indstillinger?',
      description: 'Forbrugsregler, AI-indstillinger, virksomhedsprofil og udseende sættes tilbage til standard. Nøgler og samtaler bevares.',
      run: () => {
        localStorage.removeItem('bac.settings');
        location.reload();
      },
    },
  };

  return (
    <div className="grid gap-5">
      <Card title="Eksportér" description="Download samtaler, aktivitetslog og indstillinger som JSON (uden nøgler).">
        <Button variant="secondary" onClick={exportData}>
          <Download /> Eksportér data
        </Button>
      </Card>
      <Card title="Nulstil" description="Data gemmes kun lokalt på denne computer.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setConfirm('chats')}>
            Slet alle samtaler
          </Button>
          <Button variant="secondary" onClick={() => setConfirm('demo')} disabled={mode !== 'demo'}>
            Nulstil demo-konto
          </Button>
          <Button variant="secondary" onClick={() => setConfirm('all')}>
            Nulstil indstillinger
          </Button>
        </div>
      </Card>
      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? actions[confirm].title : ''}
        description={confirm ? actions[confirm].description : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Annullér
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm) actions[confirm].run();
                setConfirm(null);
                toast.success('Udført');
              }}
            >
              Bekræft
            </Button>
          </>
        }
      />
    </div>
  );
}

export function SettingsPage() {
  const tab = useUi((s) => s.settingsTab);
  const go = useUi((s) => s.go);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  return (
    <motion.div {...pageTransition} className="flex h-full min-w-0 flex-1 overflow-hidden">
      <nav aria-label="Indstillinger" className="w-[250px] shrink-0 px-4 pt-7">
        <h1 className="px-3 pb-4 text-[26px] font-medium tracking-[-0.03em] text-ink">Indstillinger</h1>
        <div className="grid gap-0.5">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go('settings', t.id)}
                className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', active ? 'text-ink' : 'text-ink-2 hover:bg-white/60')}
              >
                {active && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-xl bg-line-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <t.icon className={cn('relative size-4', active ? 'text-brand' : 'text-muted')} />
                <span className="relative">
                  <span className="block text-[13.5px] font-medium">{t.label}</span>
                  <span className="block text-[11.5px] text-muted">{t.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-[12px] text-muted">
          <ShieldCheck className="size-4 shrink-0 text-positive" />
          Nøgler gemmes i Windows Credential Manager – aldrig i klartekst.
        </div>
      </nav>
      <div className="flex-1 overflow-y-auto px-8 pb-12 pt-7">
        <div className="mx-auto max-w-[920px]">
          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }}>
              {current.id === 'connections' && <ConnectionsTab />}
              {current.id === 'spend' && <SpendTab />}
              {current.id === 'ai' && <AiTab />}
              {current.id === 'business' && <BusinessTab />}
              {current.id === 'appearance' && <AppearanceTab />}
              {current.id === 'data' && <DataTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
