import { motion } from 'motion/react';
import { KeyRound } from 'lucide-react';
import { BlurText, Orb, RotatingText, SpotlightCard } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { EASE, fadeUp, stagger } from '@/components/motion';
import { cn } from '@/lib/utils';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { SUGGESTIONS } from './suggestions';

const TONES = {
  brand: 'bg-brand-50 text-brand',
  violet: 'bg-violet-50 text-violet',
  teal: 'bg-teal-50 text-teal',
  amber: 'bg-warning-bg text-warning',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'God nat';
  if (h < 10) return 'Godmorgen';
  if (h < 12) return 'God formiddag';
  if (h < 18) return 'God eftermiddag';
  return 'God aften';
}

export function EmptyState({ onPick, running }: { onPick: (prompt: string) => void; running: boolean }) {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const hasKey = useConnection((s) => s.hasAnthropicKey);
  const go = useUi((s) => s.go);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col items-center px-6 pb-6 pt-[6vh]">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE }}>
        <Orb size={132} active={running} />
      </motion.div>
      <BlurText
        as="h1"
        text={`${greeting()}! Hvad skal vi gøre ved din annoncering i dag?`}
        className="mt-6 justify-center text-center text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink"
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.6, duration: 0.5 } }}
        className="mt-3 text-center text-[15px] text-muted"
      >
        Jeg kan{' '}
        <RotatingText
          className="font-semibold text-ink-2"
          words={['analysere dine kampagner', 'finde spildte klik', 'skrive nye annoncer', 'justere budgetter og bud', 'lave rapporter med grafer', 'finde nye søgeord']}
        />{' '}
        {account ? (
          <>
            på <span className="font-medium text-ink-2">{account.name}</span>
            {mode === 'demo' && ' (demo)'}
          </>
        ) : null}
      </motion.p>

      {!hasKey && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.8 } }} className="mt-6">
          <Button variant="gradient" onClick={() => go('settings', 'connections')}>
            <KeyRound /> Tilføj Claude API-nøgle for at komme i gang
          </Button>
        </motion.div>
      )}

      <motion.div variants={stagger(0.05, 0.7)} initial="hidden" animate="show" className="mt-10 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        {SUGGESTIONS.map((s) => (
          <motion.div key={s.title} variants={fadeUp}>
            <SpotlightCard
              role="button"
              tabIndex={0}
              onClick={() => onPick(s.prompt)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(s.prompt)}
              className="h-full cursor-pointer rounded-2xl border border-black/[0.05] bg-white/75 p-4 shadow-[0_1px_2px_rgb(16_24_64/0.04)] backdrop-blur transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="relative">
                <span className={cn('grid size-8 place-items-center rounded-xl', TONES[s.tone])}>
                  <s.icon className="size-4" />
                </span>
                <div className="mt-3 text-[14px] font-semibold text-ink">{s.title}</div>
                <div className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted">{s.prompt}</div>
              </div>
            </SpotlightCard>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
