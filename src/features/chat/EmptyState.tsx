import { motion } from 'motion/react';
import { KeyRound } from 'lucide-react';
import { BlurText, MiniOrb } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { EASE, fadeUp, stagger } from '@/components/motion';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { SUGGESTIONS } from './suggestions';

/** Three conversation starters – the rest are available as slash commands. */
const STARTERS = [SUGGESTIONS[0]!, SUGGESTIONS[1]!, SUGGESTIONS[2]!];

export function EmptyState({ onPick, running }: { onPick: (prompt: string) => void; running: boolean }) {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const hasKey = useConnection((s) => s.hasAnthropicKey);
  const go = useUi((s) => s.go);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col items-center justify-center px-6 pb-10 pt-8">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE }}>
        <MiniOrb size={48} active={running} />
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} className="mt-5 text-[15px] text-muted">
        Velkommen til Bing Ads Chat{account ? ` · ${account.name}` : ''}
        {mode === 'demo' ? ' (demo)' : ''}
      </motion.p>
      <BlurText as="h1" text="Hvordan kan jeg hjælpe?" startDelay={0.1} className="mt-1.5 justify-center text-center text-[38px] font-medium tracking-[-0.03em] text-ink" />

      {!hasKey && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }} className="mt-5">
          <Button onClick={() => go('settings', 'connections')}>
            <KeyRound /> Tilføj Claude API-nøgle for at komme i gang
          </Button>
        </motion.div>
      )}

      <motion.div variants={stagger(0.06, 0.4)} initial="hidden" animate="show" className="mt-9 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {STARTERS.map((s) => (
          <motion.button
            key={s.title}
            type="button"
            variants={fadeUp}
            onClick={() => onPick(s.prompt)}
            className="group flex h-[118px] flex-col justify-between rounded-2xl border border-line bg-surface p-4 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-glow"
          >
            <span className="text-[13.5px] leading-snug text-ink-2 group-hover:text-ink">{s.title}</span>
            <s.icon className="size-4 text-subtle transition-colors group-hover:text-brand" />
          </motion.button>
        ))}
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.8 } }} className="mt-4 text-[12.5px] text-subtle">
        Tip: skriv <span className="font-medium text-muted">/</span> i chatfeltet for flere genveje
      </motion.p>
    </div>
  );
}
