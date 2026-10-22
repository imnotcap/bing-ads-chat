import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { AsciiArc } from '@/components/ascii/AsciiArc';
import { ButtonLink, Gif, WEB_APP_URL, ease } from '@/lib/ui';

/**
 * The reference's hero: one full-width picture with the heading centred near the top
 * and the subject rising from the bottom edge – here the app itself, under a light
 * sky with the app's grey ASCII arc.
 */
export function Hero() {
  return (
    <section id="top" className="px-2">
      <div className="relative isolate h-[760px] overflow-hidden rounded-[10px] bg-[linear-gradient(180deg,#e7e6f3_0%,#f1f0f8_38%,#fafafc_70%)] sm:h-[860px] lg:h-[900px]">
        <AsciiArc className="h-[600px]" strength={1} />
        <div className="relative z-[1] flex flex-col items-center px-5 pt-[92px] text-center sm:pt-[104px]">
          <motion.h1
            initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, delay: 0.1, ease }}
            className="max-w-[900px] text-balance text-[40px] font-medium leading-[1.08] tracking-[-0.04em] text-ink sm:text-[58px] lg:text-[64px]"
          >
            Jeres rådgiver til Microsoft Ads,
            <br className="hidden sm:block" /> der <span className="text-subtle">tjekker efter</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease }}
            className="mt-5 max-w-[460px] text-pretty text-[14.5px] leading-relaxed text-ink-2"
          >
            Spørg om kontoen på dansk. XavierOS gør ændringerne klar, sender intet før I har godkendt – og læser dem tilbage fra Microsoft.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35, ease }} className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="#kontakt">Book en demo</ButtonLink>
            <ButtonLink href={WEB_APP_URL} variant="outline" className="text-ink" icon={<ArrowUpRight className="size-3.5" />}>
              Prøv web-appen
            </ButtonLink>
          </motion.div>
        </div>
        {/* The app, rising from the bottom edge like the horizon in the reference. */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.45, ease }}
          className="absolute inset-x-0 top-[540px] z-[1] mx-auto w-[92%] max-w-[1180px] sm:top-[440px] lg:top-[455px]"
        >
          <div className="overflow-hidden rounded-t-[14px] border border-b-0 border-black/[0.07] bg-white p-1.5 pb-0 shadow-[0_-30px_80px_-40px_rgb(18_18_22/0.35)]">
            <div className="overflow-hidden rounded-t-[9px]">
              <Gif src="/gifs/app-analyse.gif" alt="XavierOS analyserer kontoen: søgetermer, forslag og en graf over forbrug og ROAS" width={960} height={645} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
