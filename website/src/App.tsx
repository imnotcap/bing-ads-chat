import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Pricing } from '@/components/Pricing';
import { BlogIndex, BlogPost } from '@/pages/Blog';
import { enableSmoothScroll, scrollToHash } from '@/lib/smoothScroll';
import { routeFor } from '@/lib/site';
import { ButtonLink, Container } from '@/lib/ui';
import { About, Benefits, Contact, FinalCta, Footer, LogoStrip, Principles, Process, Solutions } from '@/components/Sections';

/** Same order as the reference: hero, logos, about, benefits, solutions, process, quote, pricing, contact, call to action, footer. */
function Home() {
  return (
    <main>
      <Hero />
      <LogoStrip />
      <About />
      <Benefits />
      <Solutions />
      <Process />
      <Principles />
      <Pricing />
      <Contact />
      <FinalCta />
    </main>
  );
}

function NotFound() {
  return (
    <main>
      <Container className="py-32 text-center sm:py-44">
        <p className="text-[13px] font-medium text-subtle">404</p>
        <h1 className="mt-4 text-balance text-[32px] font-medium tracking-[-0.035em] text-ink sm:text-[40px]">Den side findes ikke.</h1>
        <p className="mx-auto mt-4 max-w-[420px] text-[14px] leading-relaxed text-muted">Linket er måske forældet. Prøv forsiden eller bloggen.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/">Til forsiden</ButtonLink>
          <ButtonLink href="/blog/" variant="outline">
            Til bloggen
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}

/** `path` is given when the page is rendered to HTML ahead of time; in the browser it is the address. */
export function App({ path }: { path?: string }) {
  const route = routeFor(path ?? (typeof window === 'undefined' ? '/' : window.location.pathname));
  const home = route.kind === 'home';

  useEffect(() => {
    const off = enableSmoothScroll();
    // A link from the blog back to a section of the front page (/#kontakt) lands here with
    // the hash already set, and the browser has nothing to jump to until React has drawn.
    if (window.location.hash) requestAnimationFrame(() => scrollToHash(window.location.hash));
    return off;
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Header home={home} />
      {route.kind === 'home' && <Home />}
      {route.kind === 'blog' && <BlogIndex />}
      {route.kind === 'post' && <BlogPost post={route.post} />}
      {route.kind === 'missing' && <NotFound />}
      <Footer />
    </MotionConfig>
  );
}
