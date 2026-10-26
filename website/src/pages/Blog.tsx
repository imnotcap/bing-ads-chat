/**
 * The blog: the index and a post, in the same shapes as the front page – a full-width
 * banner with the ASCII field behind it, then the content on the white canvas.
 */
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { AsciiArc, AsciiField } from '@/components/ascii/AsciiArc';
import { GradientASCII } from '@/components/ascii/GradientASCII';
import { POSTS, postsByDate, readingMinutes, type Block, type Post } from '@/content/posts';
import { ButtonLink, Container, Label, Reveal, TwoTone, cn } from '@/lib/ui';

const DARK_ASCII = ['#2a2440', '#4b3fa8', '#6d5cf6', '#8f86c9', '#3b3a48'];

const dk = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });

/** The dark band at the top of every blog page. */
function Banner({ children, tall }: { children: React.ReactNode; tall?: boolean }) {
  return (
    <section className="px-2 pt-2">
      <div className={cn('relative isolate overflow-hidden rounded-[10px] bg-ink px-5 text-white sm:px-8 lg:px-14', tall ? 'py-20 sm:py-28' : 'py-16 sm:py-20')}>
        <GradientASCII
          colors={DARK_ASCII}
          shape="horizon"
          characters=" ·▪■"
          cellSize={14}
          density={0.68}
          glyphOpacity={0.5}
          gradientOpacity={0.3}
          grain={0}
          flicker={0.18}
          speed={0.55}
          mouseInteraction
          clickEffect="wave"
          intro={false}
          className="absolute inset-0 -z-10"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_65%_at_30%_50%,rgb(18_18_22/0.8),rgb(18_18_22/0.45))]" />
        {children}
      </div>
    </section>
  );
}

function Meta({ post, light }: { post: Post; light?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]', light ? 'text-white/60' : 'text-subtle')}>
      <span className={cn('rounded-full px-2.5 py-0.5 font-medium', light ? 'bg-white/12 text-white/85' : 'bg-line-2 text-ink-2')}>{post.category}</span>
      <time dateTime={post.date}>{dk(post.date)}</time>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        <Clock3 className="size-3.5" /> {readingMinutes(post)} min.
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ the index */

export function BlogIndex() {
  const posts = postsByDate();
  const [lead, ...rest] = posts;
  return (
    <main>
      <Banner tall>
        <Reveal>
          <Label tone="light">Blog</Label>
          <h1 className="mt-4 max-w-[900px] text-balance text-[34px] font-medium leading-[1.12] tracking-[-0.035em] sm:text-[52px]">
            AI, connectors og <span className="text-white/50">markedsføring, der kan måles.</span>
          </h1>
          <p className="mt-5 max-w-[560px] text-[14.5px] leading-relaxed text-white/70">
            Nøgterne artikler om, hvad AI faktisk kan i en annoncekonto, hvad connectors er, og hvordan man optimerer Microsoft Advertising uden at
            gætte. Ingen løfter, vi ikke selv ville tro på.
          </p>
        </Reveal>
      </Banner>

      {lead && (
        <Container className="py-16 sm:py-20">
          <Reveal>
            <a href={`/blog/${lead.slug}/`} className="group grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div className="relative order-2 h-[260px] overflow-hidden rounded-[16px] bg-mesh sm:h-[320px] lg:order-1">
                <AsciiField shape="pinch" ink="#6d5cf6" opacity={0.5} mask="radial-gradient(ellipse 80% 85% at 50% 50%, black 25%, transparent 85%)" />
                <div className="absolute inset-0 grid place-items-center px-8">
                  <span className="text-center text-[15px] font-medium leading-snug text-ink/70">{lead.tags.join(' · ')}</span>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <Meta post={lead} />
                <h2 className="mt-4 text-balance text-[26px] font-medium leading-[1.2] tracking-[-0.03em] text-ink transition-colors group-hover:text-brand-700 sm:text-[32px]">
                  {lead.title}
                </h2>
                <p className="mt-4 max-w-[520px] text-[14px] leading-relaxed text-muted">{lead.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  Læs artiklen
                  <span className="grid size-7 place-items-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:translate-x-0.5">
                    <ArrowRight className="size-3.5" strokeWidth={2.2} />
                  </span>
                </span>
              </div>
            </a>
          </Reveal>
        </Container>
      )}

      <section className="border-t border-line">
        <Container className="py-16 sm:py-20">
          <Reveal>
            <TwoTone dark="Alle artikler." light={`${POSTS.length} stykker – og flere på vej.`} className="text-[26px] leading-[1.15] sm:text-[32px]" />
          </Reveal>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post, i) => (
              <Reveal key={post.slug} delay={Math.min(i * 0.05, 0.2)}>
                <a href={`/blog/${post.slug}/`} className="group flex h-full flex-col">
                  <div className="relative h-[150px] overflow-hidden rounded-[14px] bg-line-2">
                    <AsciiField shape={i % 2 ? 'rise' : 'eclipse'} ink="#8f93a0" opacity={0.42} />
                  </div>
                  <div className="mt-5 flex flex-1 flex-col">
                    <Meta post={post} />
                    <h3 className="mt-3 text-balance text-[18px] font-medium leading-snug tracking-[-0.02em] text-ink transition-colors group-hover:text-brand-700">
                      {post.title}
                    </h3>
                    <p className="mt-2.5 flex-1 text-[13.5px] leading-relaxed text-muted">{post.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 group-hover:text-ink">
                      Læs mere <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------- one post */

function Body({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h2':
            return (
              <h2 key={i} id={b.id} className="mt-14 scroll-mt-24 text-balance text-[24px] font-medium leading-snug tracking-[-0.03em] text-ink sm:text-[28px]">
                {b.text}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className="mt-9 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                {b.text}
              </h3>
            );
          case 'p':
            return (
              <p key={i} className="mt-5 text-[16px] leading-[1.75] text-ink-2">
                {b.text}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="mt-5 grid gap-3">
                {b.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[16px] leading-[1.7] text-ink-2">
                    <span aria-hidden="true" className="mt-[11px] size-1.5 shrink-0 rounded-full bg-brand" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="mt-5 grid gap-3">
                {b.items.map((item, n) => (
                  <li key={item} className="flex gap-3.5 text-[16px] leading-[1.7] text-ink-2">
                    <span aria-hidden="true" className="tabular mt-[3px] grid size-6 shrink-0 place-items-center rounded-full bg-line-2 text-[12.5px] font-semibold text-ink">
                      {n + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote key={i} className="relative mt-10 overflow-hidden rounded-[16px] bg-ink px-7 py-8 text-white sm:px-9">
                <AsciiField shape="rise" ink="#55506b" opacity={0.5} mask="linear-gradient(140deg, transparent 45%, black 100%)" />
                <p className="relative text-balance text-[19px] font-medium leading-[1.4] tracking-[-0.02em] sm:text-[22px]">{b.text}</p>
              </blockquote>
            );
          case 'note':
            return (
              <aside key={i} className="mt-10 rounded-[14px] border border-line bg-canvas px-6 py-5">
                <p className="text-[13px] font-semibold uppercase tracking-[0.07em] text-brand-700">{b.title}</p>
                <p className="mt-2 text-[15px] leading-[1.7] text-ink-2">{b.text}</p>
              </aside>
            );
          case 'faq':
            return (
              <section key={i} className="mt-14">
                <h2 className="text-[24px] font-medium tracking-[-0.03em] text-ink sm:text-[28px]">Ofte stillede spørgsmål</h2>
                <dl className="mt-6 grid gap-5">
                  {b.items.map((qa) => (
                    <div key={qa.q} className="border-t border-line pt-5">
                      <dt className="text-[16px] font-semibold leading-snug text-ink">{qa.q}</dt>
                      <dd className="mt-2 text-[15.5px] leading-[1.7] text-ink-2">{qa.a}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
        }
      })}
    </>
  );
}

export function BlogPost({ post }: { post: Post }) {
  const headings = post.body.filter((b): b is Extract<Block, { t: 'h2' }> => b.t === 'h2');
  const more = postsByDate()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);
  return (
    <main>
      <Banner>
        <Reveal>
          <a href="/blog/" className="inline-flex items-center gap-2 text-[13px] font-medium text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="size-3.5" /> Alle artikler
          </a>
          <h1 className="mt-6 max-w-[860px] text-balance text-[30px] font-medium leading-[1.14] tracking-[-0.035em] sm:text-[46px]">{post.title}</h1>
          <div className="mt-6">
            <Meta post={post} light />
          </div>
        </Reveal>
      </Banner>

      <Container className="py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)] lg:gap-16">
          <article>
            <p className="text-[18px] leading-[1.65] text-ink sm:text-[19px]">{post.lead}</p>
            <Body blocks={post.body} />

            <div className="mt-14 flex flex-wrap gap-2 border-t border-line pt-8">
              {post.tags.map((t) => (
                <span key={t} className="rounded-full bg-line-2 px-3 py-1 text-[12.5px] text-ink-2">
                  {t}
                </span>
              ))}
            </div>
          </article>

          {/* On a wide screen the contents and the call to action follow along beside the text. */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            {headings.length > 1 && (
              <nav aria-label="Indhold" className="rounded-[14px] border border-line bg-surface p-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">Indhold</p>
                <ul className="mt-4 grid gap-2.5">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="text-[13.5px] leading-snug text-ink-2 hover:text-ink">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div className="relative mt-4 overflow-hidden rounded-[14px] bg-mesh p-6">
              <AsciiField shape="eclipse" ink="#6d5cf6" opacity={0.45} />
              <div className="relative">
                <p className="text-[15.5px] font-medium leading-snug tracking-[-0.02em] text-ink">Vil du prøve det på jeres egen konto?</p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">XavierOS læser kontoen, forbereder ændringerne og sender intet, før I har godkendt det.</p>
                <ButtonLink href="/#kontakt" className="mt-5">
                  Book en demo
                </ButtonLink>
              </div>
            </div>
          </aside>
        </div>
      </Container>

      <section className="relative border-t border-line">
        <AsciiArc className="opacity-70" />
        <Container className="relative py-16 sm:py-20">
          <TwoTone dark="Læs videre." light="Mere om det samme." className="text-[26px] leading-[1.15] sm:text-[30px]" />
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {more.map((p) => (
              <a key={p.slug} href={`/blog/${p.slug}/`} className="group">
                <Meta post={p} />
                <h3 className="mt-3 text-balance text-[17px] font-medium leading-snug tracking-[-0.02em] text-ink transition-colors group-hover:text-brand-700">
                  {p.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{p.description}</p>
              </a>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
