import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { enableSmoothScroll } from '@/lib/smoothScroll';
import { About, Benefits, Contact, FinalCta, Footer, LogoStrip, Principles, Process, Solutions } from '@/components/Sections';

/** Same order as the reference: hero, logos, about, benefits, solutions, process, quote, contact, call to action, footer. */
export function App() {
  useEffect(enableSmoothScroll, []);
  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero />
        <LogoStrip />
        <About />
        <Benefits />
        <Solutions />
        <Process />
        <Principles />
        <Contact />
        <FinalCta />
      </main>
      <Footer />
    </MotionConfig>
  );
}
