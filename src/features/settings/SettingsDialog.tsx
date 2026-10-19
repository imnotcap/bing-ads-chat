import { AnimatePresence, motion } from 'motion/react';
import { Bot, Building2, Cpu, Database, Download, ExternalLink, FlaskConical, GraduationCap, Info, Loader2, Palette, Plug, Search, ShieldCheck, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { toast } from '@/components/notifications/toast';
import { EFFORT_LABELS, modelInfo, type Effort } from '@/ai/models';
import { DemoBackend } from '@/bing/demo/backend';
import { EASE } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Badge, Segmented, SwitchRow } from '@/components/ui/controls';
import { Field, Input, NumberInput, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/overlays';
import { fmtMoney, fmtNumber, fmtUsd, monthKey } from '@/lib/format';
import { isTauri } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { checkForUpdate, openDownloadPage } from '@/lib/updater';
import { offerUpdate } from '@/hooks/useAutoUpdate';
import { useUpdate } from '@/stores/update';
import { cn, errorMessage } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import { useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi, type SettingsTab } from '@/stores/ui';
import { monthTotal, useUsage } from '@/stores/usage';
import { ModelsTab } from './ModelsTab';
import { startFollowUpTest } from '@/features/chat/followUpTest';
import { UsersTab } from './UsersTab';
import { ConnectorsTab } from './ConnectorsTab';
import { TrainingTab } from './TrainingTab';
import { BudgetTab } from './BudgetTab';
import { Card } from './SettingsCard';

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
  group: string;
  /** Extra words that make the tab show up in the search. */
  keywords: string;
}

const TABS: TabDef[] = [
  { id: 'connections', label: 'Forbindelser', icon: Plug, group: 'Konto', keywords: 'claude api nøgle microsoft advertising bing developer token demo fælles cloudflare inventarland magento webshop google ads meta linkedin daisycon search console ga4 analytics ahrefs serper klaviyo pim chainbox datakilder integrationer' },
  { id: 'users', label: 'Brugere', icon: Users, group: 'Konto', keywords: 'konto log ud login microsoft administrator admin godkend adgang kolleger team' },
  { id: 'business', label: 'Virksomhed', icon: Building2, group: 'Konto', keywords: 'profil mål cpa roas dækningsgrad tone of voice instruktioner website' },
  { id: 'spend', label: 'Budget og grænser', icon: Wallet, group: 'Assistent', keywords: 'forbrug budget månedsbudget grænser godkendelse nødstop gren grene google ads meta linkedin daisycon serper ahrefs kreditter mål cpa roas kun læse rækker beskyttede kampagner cpc bud budgetvagt' },
  { id: 'training', label: 'Træning', icon: GraduationCap, group: 'Assistent', keywords: 'træn playbook guidelines regler rolle arbejdsflow grænser navigation lærte regler gren grene agent instruktioner' },
  { id: 'ai', label: 'AI-assistent', icon: Bot, group: 'Assistent', keywords: 'model opus sonnet haiku fable effort tænkning forbrug pris tokens cache' },
  { id: 'models', label: 'AI-modeller', icon: Cpu, group: 'Assistent', keywords: 'gemini google claude modeller admin administrator tillad pris flash haiku api-nøgle' },
  { id: 'appearance', label: 'Udseende', icon: Palette, group: 'App', keywords: 'animationer gnister indsigt sidebar tema' },
  { id: 'data', label: 'Data', icon: Database, group: 'App', keywords: 'eksport nulstil slet samtaler demo' },
  { id: 'about', label: 'Om appen', icon: Info, group: 'App', keywords: 'version opdatering opdateringer download cloudflare installer' },
];


/* ------------------------------- Forbindelser ------------------------------- */

/* ---------------------------------- Forbrug ---------------------------------- */


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
      <Card title="Model" description="Vælges i chatfeltet. Hvilke modeller der kan vælges, styres under AI-modeller.">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[14px] font-semibold text-ink">{modelInfo(ai.model).label}</span>
          <Button size="sm" variant="secondary" onClick={() => useUi.getState().go('settings', 'models')}>
            Administrér modeller
          </Button>
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
          <SwitchRow
            label="Tilbyd opfølgning efter ændringer"
            description="Når assistenten har ændret noget, kan du med ét klik få et kort i Min planlægning og en påmindelse i Outlook."
            checked={ai.followUps}
            onCheckedChange={(followUps) => setAi({ followUps })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="grid gap-0.5">
              <span className="text-sm font-medium text-ink">Test opfølgningen</span>
              <span className="text-[12.5px] leading-relaxed text-muted">Laver et kort i Min planlægning, en påmindelse i Outlook og en mail til dig – uden Microsoft Ads og AI. Kan også skrives som /test i chatten.</span>
            </div>
            <Button size="sm" variant="secondary" onClick={startFollowUpTest}>
              <FlaskConical /> Test nu
            </Button>
          </div>
        </div>
      </Card>

      <Card title="AI-forbrug" description="Anslået ud fra listepriserne (Claude) og de priser, du har angivet for Gemini. Den faktiske regning ses hos Anthropic og Google.">
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
            { value: 'full', label: 'Altid' },
            { value: 'system', label: 'Følg Windows' },
            { value: 'reduced', label: 'Reduceret' },
          ]}
        />
      </Field>
      <div className="mt-3">
        <SwitchRow
          label="Bliv i baggrunden, når vinduet lukkes"
          description="Appen kører videre ved uret (systembakken) og åbner med det samme igen. Afslut helt via menuen ≡ → Afslut eller højreklik på ikonet."
          checked={a.closeToTray}
          onCheckedChange={(closeToTray) => set({ closeToTray })}
        />
        <SwitchRow label="Klik-gnister" description="Små gnister ved hvert klik." checked={a.clickSpark} onCheckedChange={(clickSpark) => set({ clickSpark })} />
        <SwitchRow label="Vis indsigtsvindue ved chatten" description="Nøgletal, budget og opmærksomhedspunkter i højre side. Kan også foldes sammen direkte i chatten." checked={a.insightsPanel} onCheckedChange={(insightsPanel) => set({ insightsPanel })} />
        <SwitchRow label="Skjul sidebar" checked={a.sidebarCollapsed} onCheckedChange={(sidebarCollapsed) => set({ sidebarCollapsed })} />
      </div>
    </Card>
  );
}

/* ---------------------------------- Om appen ---------------------------------- */

function AboutTab() {
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const available = useUpdate((s) => s.available);
  useEffect(() => {
    if (isTauri) void getVersion().then(setVersion).catch(() => undefined);
  }, []);
  const check = async () => {
    setChecking(true);
    try {
      const info = await checkForUpdate();
      if (!info.configured) toast('Automatiske opdateringer er ikke slået til i denne version.', { description: 'Installér den nyeste version fra download-siden én gang – derefter opdaterer appen sig selv.' });
      // offerUpdate only opens the dialog for a new version – reopen it on an explicit check.
      else if (offerUpdate(info)) useUpdate.getState().openPrompt();
      else toast.success(`Du har den nyeste version (${info.currentVersion}).`);
    } catch (e) {
      toast.error('Kunne ikke søge efter opdateringer', { description: errorMessage(e) });
    } finally {
      setChecking(false);
    }
  };
  return (
    <Card title="Om appen" description="Appen opdaterer sig selv: den tjekker for nye versioner ved start og hver halve time, og du installerer dem med ét klik.">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-medium text-ink">Bing Ads Chat {version ?? (isTauri ? '' : '(browser)')}</div>
          <div className="text-[12.5px] text-muted">{available ? `Version ${available.version} er klar til at blive installeret.` : 'Opdateringer hentes signeret fra Cloudflare.'}</div>
        </div>
        <Button variant="secondary" disabled={!isTauri || checking} onClick={() => void check()}>
          {checking ? <Loader2 className="animate-spin" /> : <Download />} {checking ? 'Søger …' : 'Søg efter opdateringer'}
        </Button>
      </div>
      <div className="mt-4">
        <Button variant="ghost" disabled={!isTauri} onClick={() => void openDownloadPage().catch((e) => toast.error(errorMessage(e)))}>
          <ExternalLink /> Åbn download-siden
        </Button>
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

function TabContent({ id }: { id: SettingsTab }) {
  switch (id) {
    case 'users':
      return <UsersTab />;
    case 'connections':
      return <ConnectorsTab />;
    case 'spend':
      return <BudgetTab />;
    case 'training':
      return <TrainingTab />;
    case 'ai':
      return <AiTab />;
    case 'business':
      return <BusinessTab />;
    case 'appearance':
      return <AppearanceTab />;
    case 'data':
      return <DataTab />;
    case 'about':
      return <AboutTab />;
    case 'models':
      return <ModelsTab />;
  }
}

/** Settings as a large dialog with a searchable navigation – like the Claude desktop app. */
export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const tab = useUi((s) => s.settingsTab);
  const go = useUi((s) => s.go);
  const close = useUi((s) => s.closeSettings);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = TABS.filter((t) => !q || `${t.label} ${t.group} ${t.keywords}`.toLowerCase().includes(q));
  const groups = [...new Set(visible.map((t) => t.group))];
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]!;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && close()}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[#121216]/30 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 flex h-[min(880px,calc(100vh-56px))] w-[min(1240px,calc(100vw-48px))] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none"
                initial={{ opacity: 0, scale: 0.97, x: '-50%', y: '-48%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.98, x: '-50%', y: '-49%', transition: { duration: 0.15 } }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <DialogPrimitive.Title className="sr-only">Indstillinger</DialogPrimitive.Title>
                <nav aria-label="Indstillinger" className="flex w-[264px] shrink-0 flex-col border-r border-line bg-canvas/60">
                  <div className="p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                      <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Søg"
                        className="h-9 w-full rounded-[10px] border border-line bg-surface pl-9 pr-3 text-[13.5px] outline-none placeholder:text-subtle focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 pb-4">
                    {groups.map((g) => (
                      <div key={g} className="mb-4">
                        <div className="px-2.5 pb-1.5 pt-1 text-[12px] text-muted">{g}</div>
                        {visible
                          .filter((t) => t.group === g)
                          .map((t) => {
                            const active = t.id === current.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => go('settings', t.id)}
                                className={cn(
                                  'relative flex h-9 w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-[14px] transition-colors',
                                  active ? 'font-medium text-ink' : 'text-ink-2 hover:bg-line-2/70',
                                )}
                              >
                                {active && <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-[10px] bg-line-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                                <t.icon className={cn('relative size-[17px]', active ? 'text-ink' : 'text-muted')} strokeWidth={1.8} />
                                <span className="relative">{t.label}</span>
                              </button>
                            );
                          })}
                      </div>
                    ))}
                    {visible.length === 0 && <p className="px-2.5 py-4 text-[13px] text-muted">Ingen indstillinger matcher “{query}”.</p>}
                  </div>
                  <div className="m-3 mt-0 flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[12px] leading-snug text-muted">
                    <ShieldCheck className="mt-px size-4 shrink-0 text-positive" />
                    Forbindelser gemmes fælles på jeres Cloudflare.
                  </div>
                </nav>

                <div className="relative flex min-w-0 flex-1 flex-col">
                  <DialogPrimitive.Close className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-line-2 hover:text-ink" aria-label="Luk">
                    <X className="size-[18px]" />
                  </DialogPrimitive.Close>
                  <div className="flex-1 overflow-y-auto px-10 pb-12 pt-7">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: EASE }}>
                        <h1 className="mb-2 pr-10 text-[20px] font-semibold tracking-[-0.02em] text-ink">{current.label}</h1>
                        <TabContent id={current.id} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
