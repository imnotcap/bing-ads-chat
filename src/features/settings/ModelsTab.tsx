/**
 * Indstillinger → AI-modeller (administrator): which models users may pick, the
 * Gemini API key and the Gemini models with their prices.
 */
import { CheckCircle2, ExternalLink, KeyRound, Loader2, RefreshCw, Sparkles } from '@/components/icons';
import { useState } from 'react';
import { listGeminiModels, type GeminiModelListing } from '@/ai/gemini';
import { CLAUDE_MODELS, allModels, type ModelInfo } from '@/ai/models';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Badge, Switch } from '@/components/ui/controls';
import { BrandIcon, type Brand } from '@/components/brand/BrandIcon';
import { Field, Input } from '@/components/ui/input';
import { openExternal } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { useSettings } from '@/stores/settings';
import { saveSharedKey, sharedKey } from '@/workspace/shared';

function Section({ title, description, children, action, brand }: { title: string; description?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; brand?: Brand }) {
  return (
    <section className="border-b border-line py-7 first:pt-1 last:border-0">
      <div className="mb-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            {brand && <BrandIcon brand={brand} className="size-[18px]" />}
            {title}
          </h3>
          {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PriceInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-[12px] text-muted">
      {label}
      <span className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-subtle">$</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-7 w-[78px] rounded-lg border border-line bg-white pl-5 pr-1.5 text-[12.5px] tabular text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10"
        />
      </span>
    </label>
  );
}

function ModelRow({ m, enabled, onToggle, extra, isDefault, onDefault }: { m: ModelInfo; enabled: boolean; onToggle: (v: boolean) => void; extra?: React.ReactNode; isDefault: boolean; onDefault: () => void }) {
  return (
    <div className={cn('rounded-2xl border p-3.5 transition-colors', enabled ? 'border-line bg-white' : 'border-line/60 bg-[#fafafb]')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BrandIcon brand={m.provider === 'google' ? 'gemini' : 'claude'} className={cn(!enabled && 'opacity-50')} />
            <span className={cn('text-[14px] font-semibold', enabled ? 'text-ink' : 'text-muted')}>{m.label}</span>
            <code className="rounded bg-line-2 px-1.5 text-[11px] text-muted">{m.id}</code>
            {isDefault && <Badge tone="brand">Standard</Badge>}
          </div>
          {m.description && <div className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{m.description}</div>}
          {m.provider === 'anthropic' && (
            <div className="mt-1.5 text-[11.5px] text-subtle">
              ${m.input} / ${m.output} pr. mio. tokens (input / output)
            </div>
          )}
          {extra}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Tillad ${m.label}`} />
          {enabled && !isDefault && (
            <button type="button" onClick={onDefault} className="text-[11.5px] font-medium text-brand hover:underline">
              Gør til standard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ModelsTab() {
  const ai = useSettings((s) => s.ai);
  const setAi = useSettings((s) => s.setAi);
  const shared = useAccount((s) => s.workspace?.keys.google ?? null);
  const hasKey = !!shared;
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState<GeminiModelListing[] | null>(null);

  // Empty list = all models allowed; make it explicit as soon as the admin edits it.
  const enabledIds = ai.enabledModels.length ? ai.enabledModels : allModels().map((m) => m.id);
  const isEnabled = (id: string) => enabledIds.includes(id);
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...new Set([...enabledIds, id])] : enabledIds.filter((x) => x !== id);
    if (!next.length) return toast.warning('Mindst én model skal være tilladt.', { transient: true });
    setAi({ enabledModels: next, ...(on || ai.model !== id ? {} : { model: next[0]! }) });
  };

  const fetchModels = async (apiKey?: string) => {
    setBusy(true);
    try {
      const k = apiKey ?? (await sharedKey('google'));
      if (!k) throw new Error('Indtast først en Gemini API-nøgle.');
      const list = await listGeminiModels(k);
      if (apiKey) {
        await saveSharedKey('google', apiKey);
        setKey('');
      }
      setListing(list);
      toast.success(apiKey ? 'Gemini-nøglen er gemt' : 'Modellisten er opdateret', { description: `${list.length} Gemini-modeller fundet. Slå dem til, du vil kunne bruge.`, transient: true });
    } catch (e) {
      toast.error('Kunne ikke hente Gemini-modeller', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const addGemini = (g: GeminiModelListing) => {
    const model: ModelInfo = { id: g.id, provider: 'google', label: g.label, description: g.description.split('. ')[0] ?? '', input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    setAi({ customModels: [...ai.customModels.filter((m) => m.id !== g.id), model], enabledModels: [...new Set([...enabledIds, g.id])] });
  };
  const updateGemini = (id: string, patch: Partial<ModelInfo>) =>
    setAi({ customModels: ai.customModels.map((m) => (m.id === id ? { ...m, ...patch, cacheRead: patch.input !== undefined ? patch.input / 4 : m.cacheRead } : m)) });
  const removeGemini = (id: string) =>
    setAi({ customModels: ai.customModels.filter((m) => m.id !== id), enabledModels: enabledIds.filter((x) => x !== id), ...(ai.model === id ? { model: 'claude-haiku-5-5' } : {}) });

  const notAdded = (listing ?? []).filter((g) => !ai.customModels.some((m) => m.id === g.id));

  return (
    <div>
      <Section
        title="AI-modeller"
        description="Vælg, hvilke modeller man kan vælge i chatfeltet, og hvilken der er standard. Billigste valg: en Gemini Flash-model eller Claude Haiku 5.5 ($0,10 / $0,50 pr. mio. tokens) – begge klarer daglig analyse og ændringer fint; brug Opus til de tunge analyser."
      >
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] text-brand-600">
          <Sparkles className="size-4 shrink-0" />
          Alle modeller bruger de samme værktøjer, forbrugsregler og godkendelser.
        </div>
      </Section>

      <Section
        title="Gemini (Google)"
        brand="gemini"
        description={
          <>
            Opret en API-nøgle i{' '}
            <button type="button" className="font-medium text-brand hover:underline" onClick={() => void openExternal('https://aistudio.google.com/apikey')}>
              Google AI Studio <ExternalLink className="inline size-3" />
            </button>
            . Nøglen gemmes fælles på jeres Cloudflare, så alle i appen bruger den samme.
          </>
        }
        action={
          hasKey ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void fetchModels()}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Hent modeller
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-4">
          {hasKey ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-positive-bg px-3.5 py-2.5 text-[13px] text-positive">
              <CheckCircle2 className="size-4" /> Fælles nøgle …{shared?.hint} · sat af {shared?.by}
              <Button
                size="xs"
                variant="ghost"
                className="ml-auto text-positive hover:bg-white/60"
                onClick={() =>
                  void saveSharedKey('google', null)
                    .then(() => setListing(null))
                    .catch((e: unknown) => toast.error('Nøglen kunne ikke fjernes', { description: errorMessage(e) }))
                }
              >
                Fjern nøgle
              </Button>
            </div>
          ) : (
            <Field label="Gemini API-nøgle" htmlFor="gemini-key">
              <div className="flex gap-2">
                <Input id="gemini-key" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" className="font-mono text-[13px]" />
                <Button disabled={busy || !key.trim()} onClick={() => void fetchModels(key.trim())}>
                  {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Gem og hent modeller
                </Button>
              </div>
            </Field>
          )}

          {ai.customModels.map((m) => (
            <ModelRow
              key={m.id}
              m={m}
              enabled={isEnabled(m.id)}
              onToggle={(v) => toggle(m.id, v)}
              isDefault={ai.model === m.id}
              onDefault={() => setAi({ model: m.id })}
              extra={
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <PriceInput label="Input" value={m.input} onChange={(input) => updateGemini(m.id, { input })} />
                  <PriceInput label="Output" value={m.output} onChange={(output) => updateGemini(m.id, { output })} />
                  <span className="text-[11.5px] text-subtle">pr. mio. tokens</span>
                  <button type="button" onClick={() => removeGemini(m.id)} className="ml-auto text-[11.5px] text-muted hover:text-negative">
                    Fjern
                  </button>
                  {!m.input && !m.output && <span className="w-full text-[11.5px] text-warning">Angiv prisen (se ai.google.dev/pricing), så AI-forbruget og månedsloftet regnes rigtigt.</span>}
                </div>
              }
            />
          ))}

          {notAdded.length > 0 && (
            <div className="rounded-2xl border border-dashed border-line p-3">
              <div className="mb-2 px-1 text-[12.5px] font-medium text-ink-2">Tilgængelige Gemini-modeller – klik for at tilføje</div>
              <div className="flex flex-wrap gap-1.5">
                {notAdded.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    title={g.description}
                    onClick={() => addGemini(g)}
                    className="rounded-full border border-line bg-white px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    + {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Claude (Anthropic)" brand="claude" description="Kræver en Claude API-nøgle under Forbindelser.">
        <div className="grid gap-2.5">
          {CLAUDE_MODELS.map((m) => (
            <ModelRow key={m.id} m={m} enabled={isEnabled(m.id)} onToggle={(v) => toggle(m.id, v)} isDefault={ai.model === m.id} onDefault={() => setAi({ model: m.id })} />
          ))}
        </div>
      </Section>
    </div>
  );
}
