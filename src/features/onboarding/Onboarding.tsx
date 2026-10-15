import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, BarChart3, FlaskConical, MessageSquareText, Plug, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { BlurText, GradientText, MiniOrb, Stepper } from '@/components/reactbits';
import { EASE } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Field, NumberInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { switchToDemo } from '../settings/connection';
import { ApprovalModePicker, ClaudeKeyForm, MicrosoftConnectForm, MicrosoftSetupGuide } from '../settings/forms';

const FEATURES = [
  { icon: MessageSquareText, title: 'Chat med din konto', text: 'Spørg, analysér og få ændringer lavet i almindeligt dansk.' },
  { icon: BarChart3, title: 'Indsigt med grafer', text: 'Rapporter, prognoser og opmærksomhedspunkter på sekunder.' },
  { icon: ShieldCheck, title: 'Du har kontrollen', text: 'Forbrugsregler, godkendelse og fortryd på alle ændringer.' },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<'demo' | 'live'>('demo');
  const hasKey = useConnection((s) => s.hasAnthropicKey);
  const mode = useConnection((s) => s.mode);
  const spend = useSettings((s) => s.spend);
  const setSpend = useSettings((s) => s.setSpend);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const currency = useConnection((s) => s.accounts.find((a) => a.id === s.accountId)?.currency ?? 'DKK');

  const finish = () => {
    if (path === 'demo' && mode !== 'demo') switchToDemo();
    setOnboarded(true);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-canvas p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(700px 420px at 100% 0%, rgb(139 123 255 / 0.18), transparent 70%), radial-gradient(600px 380px at 0% 100%, rgb(109 92 246 / 0.07), transparent 70%)' }} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
        className="relative w-full max-w-[820px] rounded-3xl border border-line bg-white p-8 shadow-pop"
      >
        <Stepper
          step={step}
          onStepChange={setStep}
          labels={['Velkommen', 'Claude', 'Microsoft Ads', 'Forbrug']}
          footer={
            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} className={cn(step === 0 && 'invisible')}>
                <ArrowLeft /> Tilbage
              </Button>
              {step < 3 ? (
                <Button onClick={() => setStep((s) => s + 1)}>
                  {step === 1 && !hasKey ? 'Spring over' : step === 2 && path === 'live' && mode !== 'live' ? 'Fortsæt med demo indtil videre' : 'Fortsæt'} <ArrowRight />
                </Button>
              ) : (
                <Button onClick={finish}>
                  Kom i gang <ArrowRight />
                </Button>
              )}
            </div>
          }
        >
          {/* 1 – Welcome */}
          <div className="grid items-center gap-8 md:grid-cols-[180px_1fr]">
            <div className="flex justify-center">
              <MiniOrb size={120} />
            </div>
            <div>
              <BlurText as="h1" text="Velkommen til Bing Ads Chat" className="text-[32px] font-medium tracking-[-0.03em] text-ink" />
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Din <GradientText className="font-semibold">AI-specialist</GradientText> i Microsoft Advertising – den læser, analyserer og ændrer din konto via chat.
              </p>
              <div className="mt-5 grid gap-3">
                {FEATURES.map((f, i) => (
                  <motion.div key={f.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1, ease: EASE }} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">
                      <f.icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-[14px] font-semibold text-ink">{f.title}</span>
                      <span className="block text-[13px] text-muted">{f.text}</span>
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    { v: 'demo', icon: FlaskConical, title: 'Prøv med demo-konto', text: 'Realistiske data – intet kan gå galt.' },
                    { v: 'live', icon: Plug, title: 'Forbind min konto', text: 'Brug din rigtige Microsoft Advertising-konto.' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setPath(o.v)}
                    className={cn(
                      'flex flex-col rounded-2xl border p-3.5 text-left transition-[border-color,box-shadow]',
                      path === o.v ? 'border-brand/40 bg-brand-50/60 shadow-[0_0_0_4px_rgb(109_92_246/0.08)]' : 'border-line bg-white hover:border-black/10',
                    )}
                  >
                    <o.icon className={cn('size-4', path === o.v ? 'text-brand' : 'text-muted')} />
                    <div className="mt-2 text-[13.5px] font-semibold text-ink">{o.title}</div>
                    <div className="text-[12px] text-muted">{o.text}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2 – Claude */}
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Forbind Claude</h2>
            <p className="mb-5 mt-1 text-[14px] text-muted">Assistenten drives af Claude fra Anthropic. Indsæt din API-nøgle – den gemmes sikkert i Windows Credential Manager.</p>
            <ClaudeKeyForm onDone={() => setStep(2)} />
          </div>

          {/* 3 – Microsoft */}
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{path === 'live' ? 'Forbind Microsoft Advertising' : 'Demo-kontoen er klar'}</h2>
            {path === 'live' ? (
              <div className="mt-4 grid gap-6 md:grid-cols-[1fr_300px]">
                <MicrosoftConnectForm compact onDone={() => setStep(3)} />
                <div className="rounded-2xl bg-line-2/70 p-4">
                  <MicrosoftSetupGuide />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-violet-50/70 p-5 text-[14px] leading-relaxed text-ink-2">
                Du starter med <b>Nordlys Interiør</b> – en realistisk demo-konto for en dansk kontormøbelbutik med 8 kampagner, søgeord, annoncer og 90 dages
                historik. Prøv fx at spørge, hvilke søgetermer der spilder penge. Du kan forbinde din rigtige konto når som helst under Indstillinger → Forbindelser.
              </div>
            )}
          </div>

          {/* 4 – Spending */}
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Dine forbrugsregler</h2>
            <p className="mb-5 mt-1 text-[14px] text-muted">Bestem hvor meget assistenten må gøre selv. Du kan altid ændre det under Indstillinger → Forbrug.</p>
            <ApprovalModePicker value={spend.approvalMode} onChange={(approvalMode) => setSpend({ approvalMode })} />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Månedsbudget for annoncering" hint="Bruges til prognoser og advarsler. Kan stå tomt.">
                <NumberInput value={spend.monthlyBudget} onChange={(monthlyBudget) => setSpend({ monthlyBudget })} suffix={currency} placeholder="Ikke sat" />
              </Field>
              <Field label="Maks. dagsbudget pr. kampagne" hint="Assistenten kan aldrig gå over denne grænse.">
                <NumberInput value={spend.maxDailyBudgetPerCampaign} onChange={(maxDailyBudgetPerCampaign) => setSpend({ maxDailyBudgetPerCampaign })} suffix={currency} />
              </Field>
            </div>
          </div>
        </Stepper>
      </motion.div>
    </motion.div>
  );
}
