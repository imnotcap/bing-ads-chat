/**
 * A file the assistant made (create_file): name, size, a short preview, and buttons
 * to save it to "Overførsler › XavierOS", show it in Explorer or copy it.
 */
import { motion } from 'motion/react';
import { Check, ChevronDown, Copy, Download, FileSpreadsheet, FileText, FolderOpen, CalendarPlus, Loader2 } from '@/components/icons';
import { useState } from 'react';
import { EASE } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/attachments';
import { isTauri, openExportsFolder, saveExport } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';

const ICONS = { csv: FileSpreadsheet, tsv: FileSpreadsheet, ics: CalendarPlus } as Record<string, typeof FileText>;
const KINDS: Record<string, string> = { csv: 'CSV – åbner i Excel', tsv: 'TSV – åbner i Excel', ics: 'Kalenderfil – åbner i Outlook', md: 'Markdown', txt: 'Tekst', json: 'JSON', html: 'HTML', xml: 'XML' };

export function FileBlock({ fileName, content, description }: { fileName: string; content: string; description?: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const Icon = ICONS[ext] ?? FileText;
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const bytes = new TextEncoder().encode(content).length;
  const lines = content.split('\n');

  const save = async () => {
    setBusy(true);
    try {
      // Excel reads æ, ø and å in a CSV correctly only with a byte order mark.
      const data = (ext === 'csv' || ext === 'tsv') && !content.startsWith('﻿') ? `﻿${content}` : content;
      const path = await saveExport(fileName, data);
      setSaved(path ?? fileName);
      toast.success('Filen er gemt', { description: path ? `Overførsler › XavierOS › ${path.split(/[\\/]/).pop()}` : fileName, transient: true });
    } catch (e) {
      toast.error('Filen kunne ikke gemmes', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink" title={fileName}>
            {fileName}
          </div>
          <div className="truncate text-[12px] text-muted">
            {KINDS[ext] ?? ext.toUpperCase()} · {formatBytes(bytes)}
            {description ? ` · ${description}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant={saved ? 'secondary' : 'gradient'} disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Download />} {saved ? 'Gemt' : 'Gem fil'}
          </Button>
          {saved && isTauri && (
            <Button size="sm" variant="ghost" onClick={() => void openExportsFolder(saved).catch((e: unknown) => toast.error('Kunne ikke åbne mappen', { description: errorMessage(e) }))}>
              <FolderOpen /> Vis i mappe
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Kopieret' : 'Kopiér'}
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 border-t border-line px-3.5 py-2 text-left text-[12px] font-medium text-muted hover:bg-line-2/50 hover:text-ink"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        {open ? 'Skjul indhold' : `Vis indhold (${lines.length} linje${lines.length === 1 ? '' : 'r'})`}
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto border-t border-line bg-line-2/40 px-3.5 py-3 text-[12px] leading-relaxed text-ink-2" data-selectable>
          {content}
        </pre>
      )}
    </motion.div>
  );
}
