/**
 * The rows proposed for the team's notes sheet after a change: corrected here, then written
 * (or skipped). Shown on the assistant's card and, for the app's other changes, in NoteTray.
 */
import { useState } from 'react';
import { Check, FileSpreadsheet, Loader2, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useNoteDrafts, type NoteRow } from '@/ai/notes';
import { errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { writeNotes } from '@/workspace/shared';

export function NotePreview({ id }: { id: string }) {
  const draft = useNoteDrafts((s) => s.drafts[id]);
  const sheet = useAccount((s) => s.workspace?.notesheet);
  const [rows, setRows] = useState<NoteRow[] | null>(null);
  if (!draft) return null;
  const shown = rows ?? draft.rows;
  const editable = draft.status === 'draft' || draft.status === 'error';
  const set = (i: number, patch: Partial<NoteRow>) => setRows(shown.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const send = async () => {
    const out = shown.filter((r) => r.comment.trim());
    useNoteDrafts.getState().patch(id, { status: 'sending', rows: out });
    try {
      await writeNotes(out);
      useNoteDrafts.getState().patch(id, { status: 'sent', error: undefined });
    } catch (e) {
      useNoteDrafts.getState().patch(id, { status: 'error', error: errorMessage(e) });
    }
  };
  const input = 'h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10';

  return (
    <div className="border-t border-line-2 bg-[#fafafb] px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px]">
        <FileSpreadsheet className="size-4 text-positive" />
        <span className="font-medium text-ink">Notatark</span>
        {sheet?.name && <span className="text-muted">{sheet.name}</span>}
        <span className="flex-1" />
        {draft.status === 'sent' && (
          <span className="flex items-center gap-1 font-medium text-positive">
            <Check className="size-3.5" /> Skrevet i arket
          </span>
        )}
        {draft.status === 'skipped' && <span className="text-muted">Ikke skrevet</span>}
      </div>
      {draft.status === 'skipped' ? null : (
        <div className="grid gap-2">
          {shown.map((r, i) =>
            editable ? (
              <div key={i} className="grid gap-1.5 rounded-xl border border-line bg-surface p-2.5 md:grid-cols-[1fr_140px]">
                <input value={r.adGroup} onChange={(e) => set(i, { adGroup: e.target.value })} placeholder="Annoncegruppe" aria-label="Annoncegruppe" className={input} />
                <input value={r.topics[0] ?? ''} onChange={(e) => set(i, { topics: [e.target.value] })} placeholder="Emne" aria-label="Emne" className={input} />
                <textarea
                  value={r.comment}
                  onChange={(e) => set(i, { comment: e.target.value })}
                  rows={2}
                  aria-label="Kommentar"
                  className="min-h-[52px] w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 md:col-span-2"
                />
                <p className="text-[11.5px] text-subtle md:col-span-2">Kampagne: {r.campaign || '–'} · Dato, tid, status og dig sættes på, når den skrives.</p>
              </div>
            ) : (
              <div key={i} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
                <div className="text-[11.5px] text-subtle">
                  {[r.campaign, r.adGroup, r.topics[0]].filter(Boolean).join(' · ')}
                </div>
                <div className="text-ink">{r.comment}</div>
              </div>
            ),
          )}
          {draft.status === 'error' && <p className="text-[12.5px] text-negative">Ikke skrevet: {draft.error}</p>}
          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" disabled={!shown.some((r) => r.comment.trim())} onClick={() => void send()}>
                <FileSpreadsheet /> {draft.status === 'error' ? 'Prøv igen' : `Skriv i notatark (${shown.filter((r) => r.comment.trim()).length})`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => useNoteDrafts.getState().patch(id, { status: 'skipped' })}>
                Spring over
              </Button>
              <span className="ml-auto text-[11.5px] text-subtle">Ret teksten, hvis du vil – intet skrives, før du trykker.</span>
            </div>
          )}
          {draft.status === 'sending' && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Skriver i arket …
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The notes for changes made outside the chat (campaign pages, emergency stop, budget guard, test). */
export function NoteTray() {
  const drafts = useNoteDrafts((s) => s.drafts);
  const open = Object.entries(drafts)
    .filter(([, d]) => d.source !== 'assistant' && (d.status === 'draft' || d.status === 'sending' || d.status === 'error'))
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, 3);
  if (!open.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 grid w-[440px] max-w-[calc(100vw-2rem)] gap-2">
      {open.map(([id, d]) => (
        <div key={id} className="pointer-events-auto overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-2 px-4 pt-3 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate font-medium text-ink-2">{d.title}</span>
            <button type="button" aria-label="Luk" onClick={() => useNoteDrafts.getState().patch(id, { status: 'skipped' })} className="text-subtle hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
          <NotePreview id={id} />
        </div>
      ))}
    </div>
  );
}
