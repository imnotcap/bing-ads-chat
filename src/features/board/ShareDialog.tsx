/**
 * "Del med teamet": turn this PC's boards into a team (and get an invite code), join
 * a team with a code, or see the team's code and connection and leave it.
 */
import { motion } from 'motion/react';
import { Check, Copy, Loader2, LogOut, Share2, Users } from 'lucide-react';
import { useState } from 'react';
import { create } from 'zustand';
import { EASE } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/overlays';
import { cn, errorMessage } from '@/lib/utils';
import { useBoard, type SyncStatus } from '@/stores/board';
import { useSettings } from '@/stores/settings';
import { createTeam, inviteCode, joinTeam, leaveTeam } from '@/board/sync';

export const useShareDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const STATUS: Record<SyncStatus, { label: string; dot: string }> = {
  local: { label: 'Kun på denne PC', dot: 'bg-subtle' },
  connecting: { label: 'Forbinder …', dot: 'bg-warning animate-pulse' },
  online: { label: 'Synkroniseret', dot: 'bg-positive' },
  offline: { label: 'Offline – gemmer dine ændringer', dot: 'bg-warning' },
  error: { label: 'Ingen adgang', dot: 'bg-negative' },
};

export function StatusDot({ status, className }: { status: SyncStatus; className?: string }) {
  return <span className={cn('size-2 shrink-0 rounded-full', STATUS[status].dot, className)} />;
}

export function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Kunne ikke kopiere', { description: 'Markér koden og kopiér den med Ctrl+C.' });
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-line-2/60 p-1.5 pl-3">
      <code className="min-w-0 flex-1 select-all truncate font-mono text-[12.5px] text-ink-2">{code}</code>
      <Button size="xs" variant="secondary" onClick={() => void copy()}>
        {copied ? <Check className="text-positive" /> : <Copy />} {copied ? 'Kopieret' : 'Kopiér'}
      </Button>
    </div>
  );
}

function SetupForm({ onCreated }: { onCreated: (code: string) => void }) {
  const company = useSettings((s) => s.business.companyName);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [teamName, setTeamName] = useState(company || 'Marketing');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const setOpen = useShareDialog((s) => s.setOpen);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'create') onCreated(await createTeam(teamName, name, role));
      else {
        await joinTeam(code, name, role);
        toast.success('Du er med i teamet', { description: 'Tavlerne opdateres nu, når dine kolleger ændrer noget.' });
        setOpen(false);
      }
    } catch (e) {
      toast.error(mode === 'create' ? 'Teamet kunne ikke oprettes' : 'Kunne ikke deltage', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Segmented
        layoutId="share-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'create', label: 'Opret et team' },
          { value: 'join', label: 'Deltag med en kode' },
        ]}
      />
      <p className="text-[13px] leading-relaxed text-muted">
        {mode === 'create'
          ? 'Tavlerne på denne PC bliver teamets. Du får en invitationskode, som dine kolleger skriver ind i deres app – så ser alle de samme kort og ændringer med det samme.'
          : 'Skriv koden, du har fået af en kollega. Teamets tavler erstatter tavlerne på denne PC.'}
      </p>
      {mode === 'create' ? (
        <Field label="Teamets navn" htmlFor="team-name">
          <Input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
        </Field>
      ) : (
        <Field label="Invitationskode" htmlFor="team-code">
          <Input id="team-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="bac-…" className="font-mono text-[13px]" autoFocus />
        </Field>
      )}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <Field label="Dit navn" htmlFor="team-me">
          <Input id="team-me" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Jonas Hansen" />
        </Field>
        <Field label="Din rolle" htmlFor="team-role">
          <Input id="team-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Fx SEO" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Annullér
        </Button>
        <Button variant="gradient" disabled={busy || !name.trim() || (mode === 'join' ? !code.trim() : !teamName.trim())} onClick={() => void submit()}>
          {busy && <Loader2 className="animate-spin" />}
          {mode === 'create' ? 'Del tavlerne' : 'Deltag i teamet'}
        </Button>
      </div>
    </div>
  );
}

function TeamInfoView({ fresh }: { fresh: boolean }) {
  const team = useBoard((s) => s.team)!;
  const status = useBoard((s) => s.status);
  const detail = useBoard((s) => s.statusDetail);
  const members = useBoard((s) => s.members);
  const pending = useBoard((s) => s.pending.length);
  const setOpen = useShareDialog((s) => s.setOpen);
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      {fresh && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="rounded-xl bg-positive-bg px-3.5 py-3 text-[13px] text-positive">
          Teamet er oprettet. Send koden herunder til dine kolleger.
        </motion.div>
      )}
      <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">{team.name}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <StatusDot status={status} /> {STATUS[status].label} · {members.length} {members.length === 1 ? 'medlem' : 'medlemmer'}
            {pending > 0 && status !== 'online' && ` · ${pending} ændring${pending === 1 ? '' : 'er'} venter`}
          </div>
        </div>
      </div>
      {status === 'error' && detail && <p className="rounded-xl bg-negative-bg px-3.5 py-2.5 text-[12.5px] text-negative">{detail}</p>}
      <div>
        <div className="mb-1.5 text-[12.5px] font-medium text-ink-2">Invitationskode</div>
        <CodeBox code={inviteCode(team)} />
        <p className="mt-1.5 text-[12px] leading-relaxed text-subtle">
          Kolleger åbner Planlægning → Del → "Deltag med en kode". Alle med koden kan se og ændre teamets tavler, så del den kun internt.
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
        {confirmLeave ? (
          <div className="flex items-center gap-2 text-[12.5px] text-muted">
            Tavlerne bliver på denne PC som en kopi.
            <Button
              size="xs"
              variant="destructive"
              onClick={() => {
                leaveTeam();
                setOpen(false);
                toast('Du har forladt teamet', { description: 'Tavlerne ligger nu kun på denne PC.' });
              }}
            >
              Forlad
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirmLeave(false)}>
              Fortryd
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-muted" onClick={() => setConfirmLeave(true)}>
            <LogOut /> Forlad teamet
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Luk
        </Button>
      </div>
    </div>
  );
}

export function ShareDialog() {
  const open = useShareDialog((s) => s.open);
  const setOpen = useShareDialog((s) => s.setOpen);
  const team = useBoard((s) => s.team);
  const [fresh, setFresh] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setFresh(false);
      }}
      title={team ? 'Delt med teamet' : 'Del planlægningen med teamet'}
      description={team ? undefined : 'Tavlerne gemmes på jeres egen Cloudflare-konto, så alle i teamet arbejder på de samme kort.'}
      className="w-[min(520px,calc(100vw-32px))]"
    >
      {team ? <TeamInfoView fresh={fresh} /> : <SetupForm onCreated={() => setFresh(true)} />}
    </Dialog>
  );
}

/** The share/status button in the board header. */
export function ShareButton() {
  const team = useBoard((s) => s.team);
  const status = useBoard((s) => s.status);
  const setOpen = useShareDialog((s) => s.setOpen);
  if (!team) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Share2 /> Del
      </Button>
    );
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => setOpen(true)} title={STATUS[status].label}>
      <StatusDot status={status} /> {team.name}
    </Button>
  );
}
