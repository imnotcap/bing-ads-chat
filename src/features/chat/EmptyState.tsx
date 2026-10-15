import { motion } from 'motion/react';
import { KeyRound } from 'lucide-react';
import { BlurText, GradientASCII, Orb } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { fadeUp, stagger } from '@/components/motion';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { SUGGESTIONS } from './suggestions';

/** Three conversation starters – the rest are available as slash commands. */
const STARTERS = [SUGGESTIONS[0]!, SUGGESTIONS[1]!, SUGGESTIONS[2]!];

/** Theme version of the GradientASCII palette – soft lavender that melts into the white page. */
const ASCII_COLORS = ['#a99dff', '#fbfbfc', '#efecff', '#c9c0ff'];

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const hasKey = useConnection((s) => s.hasAnthropicKey);
  const go = useUi((s) => s.go);

  return (
    <div className="flex min-h-full flex-col">
      {/* Hero: ASCII horizon with the orb as its sun. */}
      <div className="relative h-[300px] w-full shrink-0">
        <GradientASCII
          className="absolute inset-0 [mask-image:radial-gradient(ellipse_62%_78%_at_50%_42%,black_25%,transparent_78%)]"
          colors={ASCII_COLORS}
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={18}
          density={0.55}
          glyphOpacity={0.35}
          gradientOpacity={0.55}
          grain={0.03}
          flicker={0.15}
          lightMode
          inkColor="#b4a9ff"
        />
        <div className="absolute inset-x-0 top-[34px] flex justify-center">
          <Orb
            style={{ width: 210, height: 210 }}
            colors={['#9c43fe', '#4cc2e9', '#101499']}
            backgroundColor="#fbfbfc"
            hoverIntensity={1.35}
            trail={2.6}
            rotateOnHover
            followCursor
            hue={312}
            size={0.53}
            glow={1.4}
            halo={false}
            bleed={3}
            wobble={3}
            highlight={1.9}
            speed={2.35}
            forceHoverState
          />
        </div>
      </div>

      <div className="mx-auto -mt-12 flex w-full max-w-[760px] flex-1 flex-col items-center px-6 pb-8">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} className="relative text-[15px] text-muted">
          Velkommen til Bing Ads Chat{account ? ` · ${account.name}` : ''}
          {mode === 'demo' ? ' (demo)' : ''}
        </motion.p>
        <BlurText as="h1" text="Hvordan kan jeg hjælpe?" startDelay={0.1} className="relative mt-1.5 justify-center text-center text-[38px] font-medium tracking-[-0.03em] text-ink" />

        {!hasKey && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }} className="mt-5">
            <Button onClick={() => go('settings', 'connections')}>
              <KeyRound /> Tilføj Claude API-nøgle for at komme i gang
            </Button>
          </motion.div>
        )}

        <motion.div variants={stagger(0.06, 0.4)} initial="hidden" animate="show" className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {STARTERS.map((s) => (
            <motion.button
              key={s.title}
              type="button"
              variants={fadeUp}
              onClick={() => onPick(s.prompt)}
              className="group flex h-[112px] flex-col justify-between rounded-2xl border border-line bg-surface p-4 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-glow"
            >
              <span className="text-[13.5px] leading-snug text-ink-2 group-hover:text-ink">{s.title}</span>
              <s.icon className="size-4 text-subtle transition-colors group-hover:text-brand" />
            </motion.button>
          ))}
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.8 } }} className="mt-4 text-[12.5px] text-subtle">
          Tip: skriv <span className="font-medium text-muted">/</span> for genveje, eller tryk <span className="font-medium text-muted">+</span> for at vedhæfte filer
        </motion.p>
      </div>
    </div>
  );
}
