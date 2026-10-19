/**
 * After the assistant has changed something (campaigns, ad groups, keywords, ads …)
 * it offers a follow-up under the reply: a card on the user's personal planning
 * board ("Min planlægning", made if missing), a reminder in the Outlook calendar and
 * a mail to the user themselves. "/test" shows the same card without any changes.
 */
import { motion } from 'motion/react';
import { ArrowRight, CalendarClock, Check, ExternalLink, FlaskConical, Loader2, Mail, SquareKanban } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EASE } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { addOutlookEvent, outlookAvailable, sendMailToSelf } from '@/bing/outlook';
import { openExternal } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { fmtDue, useBoard } from '@/stores/board';
import { useChat, type AssistantItem, type ToolPart } from '@/stores/chat';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PRESETS = [
  { label: 'Om 3 dage', days: 3 },
  { label: 'Om 1 uge', days: 7 },
  { label: 'Om 2 uger', days: 14 },
];

function fmtValue(v: string | number | null | undefined) {
  return v === null || v === undefined || v === '' ? '–' : String(v);
}

/** The changes in a reply that were carried out. */
export function completedChanges(item: AssistantItem): ToolPart[] {
  // Account changes only – a new training rule needs no follow-up.
  return item.parts.filter((p): p is ToolPart => p.type === 'tool' && p.status === 'done' && !!p.plan && p.plan.kind !== 'raw' && p.name !== 'train_playbook');
}

function describe(changes: ToolPart[]) {
  const lines = changes.flatMap((t) =>
    (t.plan?.changes ?? []).slice(0, 8).map((c) =>
      c.before === undefined || c.before === null || c.before === ''
        ? `• ${c.field}: ${fmtValue(c.after)}`
        : `• ${c.entity} – ${c.field}: ${fmtValue(c.before)} → ${fmtValue(c.after)}`,
    ),
  );
  const date = new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
  return `Ændret af assistenten ${date}:\n${lines.join('\n')}\n\nTjek om ændringerne virker: sammenlign forbrug, klik, konverteringer og CPA før og efter.`;
}

const TEST_DESCRIPTION =
  'Dette er en test af opfølgningen i Bing Ads Chat – intet er ændret i Microsoft Advertising.\n\nNår assistenten ændrer noget rigtigt, står ændringerne her, så du kan tjekke, om de virkede.';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function mailHtml(title: string, description: string, when: string, outlookLink?: string | null) {
  const body = escapeHtml(description).replace(/\n/g, '<br>');
  const link = outlookLink ? `<p><a href="${escapeHtml(outlookLink)}">Åbn påmindelsen i Outlook</a></p>` : '';
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1d1d22"><h2 style="font-size:17px;margin:0 0 8px">${escapeHtml(title)}</h2><p style="color:#6b6b76;margin:0 0 12px">Opfølgning ${escapeHtml(when)}</p><p>${body}</p>${link}<p style="color:#9a9aa5;font-size:12px">Sendt fra Bing Ads Chat til dig selv.</p></div>`;
}

export function FollowUpCard({ item }: { item: AssistantItem }) {
  const convId = useChat((s) => s.activeId);
  const updateItem = useChat((s) => s.updateItem);
  const enabled = useSettings((s) => s.ai.followUps);
  const outlookDefault = useSettings((s) => s.ai.followUpOutlook);
  const mailDefault = useSettings((s) => s.ai.followUpMail);
  const email = useAccount((s) => s.user?.email ?? null);
  const test = !!item.test;
  const setAi = useSettings((s) => s.setAi);
  const changes = useMemo(() => completedChanges(item), [item]);
  const firstTitle = changes[0]?.plan?.title ?? 'Ændring';
  const [title, setTitle] = useState(test ? 'Test: opfølgning fra Bing Ads Chat' : `Følg op: ${firstTitle}${changes.length > 1 ? ` (+${changes.length - 1})` : ''}`);
  const [due, setDue] = useState(isoDay(test ? 1 : 7));
  const [time, setTime] = useState('09:00');
  const [toBoard, setToBoard] = useState(true);
  const canOutlook = outlookAvailable();
  const [toOutlook, setToOutlook] = useState((test || outlookDefault) && canOutlook);
  const canMail = canOutlook && !!email;
  const [toMail, setToMail] = useState((test || mailDefault) && canMail);
  const [busy, setBusy] = useState(false);
  const state = item.followUp;

  if (!convId || (!changes.length && !test)) return null;
  if (state?.status === 'dismissed') return null;

  if (state?.status === 'created') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink-2"
      >
        <span className="grid size-5 place-items-center rounded-full bg-positive text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span>
          Opfølgning {fmtDue(state.due)} kl. {state.time}
        </span>
        {state.boardId && (
          <button type="button" onClick={() => useUi.getState().openBoard(state.boardId)} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <SquareKanban className="size-3.5" /> Min planlægning
          </button>
        )}
        {state.outlookLink !== undefined && state.outlookLink !== null && (
          <button type="button" onClick={() => void openExternal(state.outlookLink!)} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <ExternalLink className="size-3.5" /> I Outlook
          </button>
        )}
        {state.mailTo && (
          <span className="inline-flex items-center gap-1">
            <Mail className="size-3.5 text-muted" /> Mail sendt til {state.mailTo}
          </span>
        )}
        {state.outlookError && <span className="text-[12px] text-warning">Ikke i Outlook: {state.outlookError}</span>}
        {state.mailError && <span className="text-[12px] text-warning">Ingen mail: {state.mailError}</span>}
      </motion.div>
    );
  }
  if (!enabled && !test) return null;

  const create = async () => {
    setBusy(true);
    try {
      const description = test ? TEST_DESCRIPTION : describe(changes);
      const subject = title.trim() || 'Følg op på annonceændringer';
      let boardId = '';
      let cardId = '';
      if (toBoard) {
        ({ boardId, cardId } = useBoard.getState().addFollowUp({
          title: subject,
          description,
          due,
          checklist: ['Tjek tallene for det, der blev ændret', 'Beslut: behold, justér eller rul tilbage'],
          conversationId: convId,
          activityIds: changes.map((c) => c.activityId).filter((x): x is string => !!x),
        }));
      }
      let outlookLink: string | null | undefined;
      let outlookError: string | undefined;
      if (toOutlook) {
        try {
          const ev = await addOutlookEvent({ subject, body: description, date: due, time, minutes: 30, reminderMinutes: 15 });
          outlookLink = ev.webLink ?? null;
          if (cardId) useBoard.getState().updateCard(cardId, { outlook: { eventId: ev.id, webLink: ev.webLink, at: `${due}T${time}` } });
        } catch (e) {
          outlookError = errorMessage(e);
        }
      }
      let mailTo: string | undefined;
      let mailError: string | undefined;
      if (toMail) {
        try {
          mailTo = await sendMailToSelf({ subject, html: mailHtml(subject, description, `${fmtDue(due)} kl. ${time}`, outlookLink) });
        } catch (e) {
          mailError = errorMessage(e);
        }
      }
      updateItem(convId, item.id, (it) => ({
        ...it,
        followUp: { status: 'created', boardId, cardId, due, time, outlookLink, outlookError, mailTo, mailError },
      }));
      const done = [toBoard && 'kort i Min planlægning', toOutlook && !outlookError && 'påmindelse i Outlook', mailTo && 'mail til dig'].filter(Boolean).join(', ');
      if (outlookError || mailError) toast.warning(done ? `Lavet: ${done}` : 'Opfølgningen fejlede', { description: [outlookError && `Outlook: ${outlookError}`, mailError && `Mail: ${mailError}`].filter(Boolean).join(' · ') });
      else toast.success('Opfølgning oprettet', { description: `${done.charAt(0).toUpperCase()}${done.slice(1)} · ${fmtDue(due)} kl. ${time}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.15 }}
      className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(18_18_22/0.04)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal">
          {test ? <FlaskConical className="size-4" /> : <CalendarClock className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink">{test ? 'Test af opfølgning' : 'Skal jeg sætte en opfølgning på?'}</div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {test
              ? 'Prøv opfølgningen af uden Microsoft Advertising: vælg hvad der skal laves, og klik Opret.'
              : `Så får du et kort i din personlige planlægning${canOutlook ? ', en påmindelse i Outlook og en mail' : ''}, når det er tid til at tjekke, om ændringen virkede.`}
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3 sm:pl-11">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Titel på opfølgningen"
          className="h-9 w-full rounded-lg border border-line px-3 text-[13.5px] outline-none transition-[border-color,box-shadow] focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => {
            const value = isoDay(p.days);
            return (
              <button
                key={p.days}
                type="button"
                onClick={() => setDue(value)}
                className={cn('h-8 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors', due === value ? 'bg-ink text-white' : 'bg-line-2 text-ink-2 hover:bg-[#ebebf0]')}
              >
                {p.label}
              </button>
            );
          })}
          <input
            type="date"
            value={due}
            min={isoDay(0)}
            onChange={(e) => e.target.value && setDue(e.target.value)}
            aria-label="Dato"
            className="h-8 rounded-lg border border-line px-2 text-[12.5px] outline-none focus:border-brand/50"
          />
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Tidspunkt" className="h-8 rounded-lg border border-line px-2 text-[12.5px] outline-none focus:border-brand/50" />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-2">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={toBoard} onChange={(e) => setToBoard(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
            Kort i Min planlægning
          </label>
          <label className={cn('inline-flex items-center gap-2', canOutlook ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')} title={canOutlook ? undefined : 'Kræver desktop-appen og Microsoft-login'}>
            <input
              type="checkbox"
              disabled={!canOutlook}
              checked={toOutlook}
              onChange={(e) => {
                setToOutlook(e.target.checked);
                if (!test) setAi({ followUpOutlook: e.target.checked });
              }}
              className="size-4 accent-[var(--color-brand)]"
            />
            Påmindelse i Outlook-kalenderen
          </label>
          <label
            className={cn('inline-flex min-w-0 items-center gap-2', canMail ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}
            title={canMail ? undefined : 'Kræver desktop-appen og Microsoft-login'}
          >
            <input
              type="checkbox"
              disabled={!canMail}
              checked={toMail}
              onChange={(e) => {
                setToMail(e.target.checked);
                if (!test) setAi({ followUpMail: e.target.checked });
              }}
              className="size-4 shrink-0 accent-[var(--color-brand)]"
            />
            <span className="truncate">Mail til mig{email ? ` (${email})` : ''}</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button size="sm" variant="gradient" disabled={busy || (!toBoard && !toOutlook && !toMail)} onClick={() => void create()}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />} Opret opfølgning
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateItem(convId, item.id, (it) => ({ ...it, followUp: { status: 'dismissed' } }))}>
            Nej tak
          </Button>
          {!test && (
            <button type="button" onClick={() => setAi({ followUps: false })} className="ml-auto text-[12px] text-subtle hover:text-muted hover:underline">
              Spørg ikke igen
            </button>
          )}
        </div>
        {(toOutlook || toMail) && busy && <p className="text-[12px] text-muted">Mangler appen adgang til kalender eller mail, åbner Microsoft i browseren, så du kan give lov.</p>}
      </div>
    </motion.div>
  );
}
