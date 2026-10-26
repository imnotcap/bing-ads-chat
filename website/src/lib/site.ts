/**
 * The site's routes and the head of every page.
 *
 * Everything here is plain data and pure functions with no DOM: the same code decides
 * what the browser renders and what scripts/prerender.mjs writes into the HTML a search
 * engine is served, so a title can never be right in one and wrong in the other.
 */
import { POSTS, postBySlug, wordCount, type Post } from '@/content/posts';

/** Where the site is served. Canonical URLs and the sitemap are built from it. */
export const ORIGIN = ((import.meta.env?.VITE_PUBLIC_URL as string | undefined) || 'https://xavieros.dk').replace(/\/$/, '');

export const SITE_NAME = 'XavierOS';

export type Route = { kind: 'home' } | { kind: 'blog' } | { kind: 'post'; post: Post } | { kind: 'missing' };

/** A path always ends in a slash here, so /blog and /blog/ are the same page. */
export const normalise = (pathname: string) => (pathname.endsWith('/') ? pathname : `${pathname}/`);

export function routeFor(pathname: string): Route {
  const path = normalise(pathname);
  if (path === '/') return { kind: 'home' };
  if (path === '/blog/') return { kind: 'blog' };
  const slug = /^\/blog\/([^/]+)\/$/.exec(path)?.[1];
  const post = slug ? postBySlug(slug) : undefined;
  if (post) return { kind: 'post', post };
  return { kind: 'missing' };
}

export const pathOf = (route: Route) =>
  route.kind === 'home' ? '/' : route.kind === 'blog' ? '/blog/' : route.kind === 'post' ? `/blog/${route.post.slug}/` : '/';

export interface Head {
  title: string;
  description: string;
  canonical: string;
  /** Schema.org, one object per <script type="application/ld+json">. */
  jsonLd: unknown[];
  /** article for a post, website otherwise. */
  ogType: 'website' | 'article';
}

const org = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/favicon.svg`,
};

const BLOG_TITLE = 'Blog om AI, connectors og markedsføring';
const BLOG_DESCRIPTION =
  'Nøgterne artikler om AI i markedsføring, connectors til jeres egne systemer og konkret optimering af Microsoft Advertising. Skrevet til folk, der selv driver kontoen.';

export function headFor(route: Route): Head {
  if (route.kind === 'post') {
    const post = route.post;
    const url = `${ORIGIN}/blog/${post.slug}/`;
    return {
      title: `${post.title} · ${SITE_NAME}`,
      description: post.description,
      canonical: url,
      ogType: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updated ?? post.date,
          inLanguage: 'da-DK',
          keywords: post.tags.join(', '),
          articleSection: post.category,
          wordCount: wordCount(post),
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          author: org,
          publisher: org,
        },
        breadcrumbs([
          ['Forside', `${ORIGIN}/`],
          ['Blog', `${ORIGIN}/blog/`],
          [post.title, url],
        ]),
        ...faqOf(post),
      ],
    };
  }
  if (route.kind === 'blog') {
    return {
      title: `${BLOG_TITLE} · ${SITE_NAME}`,
      description: BLOG_DESCRIPTION,
      canonical: `${ORIGIN}/blog/`,
      ogType: 'website',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: `${SITE_NAME} – ${BLOG_TITLE}`,
          description: BLOG_DESCRIPTION,
          url: `${ORIGIN}/blog/`,
          inLanguage: 'da-DK',
          publisher: org,
          blogPost: POSTS.map((p) => ({
            '@type': 'BlogPosting',
            headline: p.title,
            description: p.description,
            datePublished: p.date,
            url: `${ORIGIN}/blog/${p.slug}/`,
          })),
        },
        breadcrumbs([
          ['Forside', `${ORIGIN}/`],
          ['Blog', `${ORIGIN}/blog/`],
        ]),
      ],
    };
  }
  return {
    title: 'XavierOS – din AI-rådgiver til Microsoft Ads',
    description:
      'Spørg om din Microsoft Advertising-konto på dansk. XavierOS finder spildet, forbereder ændringerne og sender intet, før du har godkendt det – og tjekker bagefter, at det faktisk er sket.',
    canonical: `${ORIGIN}/`,
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Windows 10, Windows 11, Web',
        description: 'AI-rådgiver til Microsoft Advertising, hvor ingen ændring sker uden en godkendelse.',
        url: `${ORIGIN}/`,
        inLanguage: 'da-DK',
        publisher: org,
      },
    ],
  };
}

const breadcrumbs = (trail: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});

/** A post's own questions and answers, so they can be shown as such in a result. */
function faqOf(post: Post) {
  const items = post.body.flatMap((b) => (b.t === 'faq' ? b.items : []));
  if (!items.length) return [];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
}


/** Every page the site has, for the sitemap and for the prerender. */
export const allRoutes = (): Route[] => [{ kind: 'home' }, { kind: 'blog' }, ...POSTS.map((post): Route => ({ kind: 'post', post }))];
