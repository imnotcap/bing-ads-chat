/**
 * Indstillinger → Træning: each branch's playbook (role, workflow, tools, guardrails,
 * navigation and the rules the team has taught it). Laid out like Forbindelser – one
 * card per branch, the editor opens in a dialog. Shared by everyone on Cloudflare.
 */
import { GraduationCap, Loader2, RotateCcw, Settings2, ShieldCheck } from '@/components/icons';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/overlays';
import { fmtRelative } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { BRANCH_IDS, MAX_SECTION_CHARS, SECTIONS, SECTION_IDS, branchInfo, defaultPlaybook, effectivePlaybook, type BranchId, type PlaybookSections, type SectionId } from '@/ai/playbooks';
import { loadPlaybooks, savePlaybook, usePlaybooks } from '@/workspace/playbooks';
import { ConnectorLogo } from './ConnectorLogo';
import { SharedBy } from './forms';

function BranchCard({ id, onOpen }: { id: BranchId; onOpen: () => void }) {
  const info = branchInfo(id);
  const stored = usePlaybooks((s) => s.stored?.[id] ?? null);
  const changed = Object.keys(stored?.sections ?? {}).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-line bg-white p-3.5 text-left transition-[border-color,box-shadow] hover:border-black/10 hover:shadow-[0_2px_10px_-4px_rgb(18_18_22/0.12)]"
    >
      <ConnectorLogo id={id} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-ink">{info.name}</span>
          {info.active && <span className="rounded-full bg-brand-50 px-1.5 py-px text-[11px] font-medium text-brand">Chatten</span>}
        </span>
        <span className="block truncate text-[12.5px] text-muted">{info.description}</span>
        <span className="block truncate text-[12px] text-subtle">
          {changed && stored?.updatedBy ? `Trænet af ${stored.updatedBy}${stored.updatedAt ? ` ${fmtRelative(stored.updatedAt)}` : ''}` : 'Standard-playbook'}
        </span>
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors group-hover:bg-line-2 group-hover:text-ink" aria-hidden>
        <Settings2 className="size-4" />
      </span>
    </button>
  );
}

function PlaybookEditor({ id }: { id: BranchId }) {
  const stored = usePlaybooks((s) => s.stored?.[id] ?? null);
  const current = useMemo(() => effectivePlaybook(id, stored), [id, stored]);
  const defaults = useMemo(() => defaultPlaybook(id), [id]);
  const [draft, setDraft] = useState<PlaybookSections>(current);
  const [busy, setBusy] = useState(false);
  // Someone else saved meanwhile: take their version of the sections not being edited here.
  useEffect(() => setDraft((d) => Object.fromEntries(SECTION_IDS.map((s) => [s, d[s] === current[s] ? current[s] : d[s]])) as PlaybookSections), [current]);

  const dirty = SECTION_IDS.filter((s) => draft[s] !== current[s]);
  const save = async (sections: Partial<Record<SectionId, string | null>>) => {
    setBusy(true);
    try {
      await savePlaybook(id, sections);
      toast.success('Træningen er gemt for alle', { description: `${branchInfo(id).name} bruger den fra næste besked.` });
    } catch (e) {
      toast.error('Kunne ikke gemme træningen', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex gap-2.5 rounded-xl bg-brand-50/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        <span>Træningen kan gøre assistenten klogere og mere forsigtig – men aldrig løsne grundreglen: den ændrer intet uden din godkendelse, og forbrugsreglerne gælder altid.</span>
      </div>
      {SECTION_IDS.map((s) => {
        const custom = stored?.sections[s] !== undefined;
        const lines = draft[s].split('\n').length;
        return (
          <section key={s} className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[13.5px] font-semibold text-ink">{SECTIONS[s].label}</h3>
              {custom && <span className="rounded-full bg-line-2 px-1.5 py-px text-[11px] text-muted">Tilpasset</span>}
              {custom && draft[s] === current[s] && (
                <button type="button" disabled={busy} onClick={() => void save({ [s]: null })} className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink" title="Gå tilbage til standardteksten">
                  <RotateCcw className="size-3" /> Standard
                </button>
              )}
            </div>
            <p className="text-[12px] text-muted">{SECTIONS[s].hint}</p>
            <Textarea
              value={draft[s]}
              rows={Math.min(16, Math.max(3, lines + 1))}
              maxLength={MAX_SECTION_CHARS}
              onChange={(e) => setDraft((d) => ({ ...d, [s]: e.target.value }))}
              placeholder={s === 'lessons' ? 'Fx "- Brand-kampagner må aldrig få nye brede søgeord."' : defaults[s] ? '' : 'Tomt'}
              className="text-[12.5px]"
              aria-label={SECTIONS[s].label}
            />
          </section>
        );
      })}
      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t border-line bg-white px-1 py-3">
        <Button variant="gradient" disabled={busy || !dirty.length} onClick={() => void save(Object.fromEntries(dirty.map((s) => [s, draft[s] === defaults[s] ? null : draft[s]])))}>
          {busy && <Loader2 className="animate-spin" />} Gem træning{dirty.length ? ` (${dirty.length})` : ''}
        </Button>
        {dirty.length > 0 && (
          <Button variant="ghost" disabled={busy} onClick={() => setDraft(current)}>
            Fortryd
          </Button>
        )}
        <span className="ml-auto">
          <SharedBy by={stored?.updatedBy ?? null} at={stored?.updatedAt ?? null} />
        </span>
      </div>
    </div>
  );
}

export function TrainingTab() {
  const error = usePlaybooks((s) => s.error);
  const loaded = usePlaybooks((s) => !!s.stored);
  const [open, setOpen] = useState<BranchId | null>(null);
  const [shown, setShown] = useState<BranchId | null>(null);
  useEffect(() => {
    void loadPlaybooks();
  }, []);
  useEffect(() => {
    if (open) setShown(open);
  }, [open]);
  const current = open ?? shown;
  const active = BRANCH_IDS.filter((b) => branchInfo(b).active);
  const later = BRANCH_IDS.filter((b) => !branchInfo(b).active);

  return (
    <div className="grid gap-6">
      <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
        <GraduationCap className="mt-0.5 size-4 shrink-0 text-brand" />
        <span>
          Hver gren har sin egen playbook: rolle, arbejdsflow, værktøjer, grænser og jeres egne regler. Den er fælles for alle, og chatten kan foreslå nye regler, som I godkender. Skriv fx
          “fremover skal du altid …” i chatten.
        </span>
      </div>
      {error && !loaded && <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning">Træningen kunne ikke hentes – chatten bruger standard-playbooken: {error}</p>}
      <section>
        <h3 className="mb-2.5 text-[13px] font-semibold text-ink">I brug</h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {active.map((b) => (
            <BranchCard key={b} id={b} onOpen={() => setOpen(b)} />
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-1 text-[13px] font-semibold text-ink">Klar til egen assistent</h3>
        <p className="mb-2.5 text-[12.5px] text-muted">Træn dem allerede nu – playbooken bruges, når grenen får sin egen assistent.</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {later.map((b) => (
            <BranchCard key={b} id={b} onOpen={() => setOpen(b)} />
          ))}
        </div>
      </section>
      <Dialog
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={
          current ? (
            <span className="flex items-center gap-3">
              <ConnectorLogo id={current} className="size-10" />
              <span className="grid">
                <span>Træning · {branchInfo(current).name}</span>
                <span className="text-[12.5px] font-normal text-muted">{branchInfo(current).description}</span>
              </span>
            </span>
          ) : (
            ''
          )
        }
        className="w-[min(720px,calc(100vw-32px))]"
      >
        {current && (
          <div className="-mx-1 max-h-[min(70vh,680px)] overflow-y-auto px-1">
            <PlaybookEditor key={current} id={current} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
