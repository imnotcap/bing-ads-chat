/** Logos for the connector cards: the platform's own mark where we have it, else a tile in its colour. */
import { BarChart3, Boxes, Search } from 'lucide-react';
import { BrandIcon, type Brand } from '@/components/brand/BrandIcon';
import { cn } from '@/lib/utils';

export type LogoId =
  | 'claude'
  | 'microsoft_ads'
  | 'inventarland'
  | 'google_ads'
  | 'meta_ads'
  | 'linkedin_ads'
  | 'daisycon'
  | 'search_console'
  | 'ga4'
  | 'ahrefs'
  | 'serper'
  | 'magento'
  | 'klaviyo'
  | 'pim';

const BRANDS: Partial<Record<LogoId, Brand>> = { claude: 'claude', microsoft_ads: 'microsoft_ads', google_ads: 'google_ads', meta_ads: 'meta', linkedin_ads: 'linkedin' };

const LETTERS: Partial<Record<LogoId, { letter: string; bg: string; fg?: string }>> = {
  daisycon: { letter: 'D', bg: '#0091DA' },
  ahrefs: { letter: 'a', bg: '#FF8800' },
  serper: { letter: 'S', bg: '#111114' },
  magento: { letter: 'M', bg: '#EE672F' },
  klaviyo: { letter: 'K', bg: '#232426' },
  inventarland: { letter: 'I', bg: '#6d5cf6' },
};

/** `small`: a 20 px chip logo (branch pickers) instead of the 44 px card tile. */
export function ConnectorLogo({ id, className, small = false }: { id: LogoId; className?: string; small?: boolean }) {
  const box = cn('grid shrink-0 place-items-center overflow-hidden border border-line bg-white', small ? 'size-5 rounded-full' : 'size-11 rounded-xl', className);
  const icon = small ? 'size-3' : 'size-6';
  const lucide = small ? 'size-3' : 'size-5';
  const brand = BRANDS[id];
  if (brand) {
    return (
      <span className={box}>
        <BrandIcon brand={brand} className={icon} />
      </span>
    );
  }
  if (id === 'ga4') {
    return (
      <span className={box}>
        <svg viewBox="0 0 24 24" className={icon} aria-label="Google Analytics">
          <rect x="15" y="2.5" width="5.5" height="19" rx="2.75" fill="#F9AB00" />
          <rect x="8.5" y="9" width="5.5" height="12.5" rx="2.75" fill="#E37400" />
          <circle cx="4.75" cy="18.75" r="2.75" fill="#E37400" />
        </svg>
      </span>
    );
  }
  if (id === 'search_console') {
    return (
      <span className={box}>
        <Search className={cn(lucide, 'text-[#4285F4]')} strokeWidth={2.4} />
      </span>
    );
  }
  if (id === 'pim') {
    return (
      <span className={box}>
        <Boxes className={cn(lucide, 'text-[#0f9d8a]')} strokeWidth={2} />
      </span>
    );
  }
  const l = LETTERS[id];
  if (l) {
    return (
      <span className={cn(box, 'border-transparent font-bold text-white', small ? 'text-[11px]' : 'text-[19px]')} style={{ background: l.bg, color: l.fg }}>
        {l.letter}
      </span>
    );
  }
  return (
    <span className={box}>
      <BarChart3 className={cn(lucide, 'text-muted')} />
    </span>
  );
}
