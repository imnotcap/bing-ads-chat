/** Marks for the platforms XavierOS works with (same drawings as in the app). */
import { useId } from 'react';
import { cn } from '@/lib/ui';

export type BrandId = 'microsoft_ads' | 'claude' | 'outlook' | 'google_ads' | 'meta' | 'webshop';

export const BRAND_NAMES: Record<BrandId, string> = {
  microsoft_ads: 'Microsoft Advertising',
  claude: 'Claude',
  outlook: 'Outlook-kalender',
  google_ads: 'Google Ads',
  meta: 'Meta',
  webshop: 'Webshop (Magento)',
};

export function BrandIcon({ id, className }: { id: BrandId; className?: string }) {
  const gid = useId();
  const cls = cn('size-5 shrink-0', className);
  switch (id) {
    case 'microsoft_ads':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label={BRAND_NAMES[id]}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#37BDFF" />
              <stop offset="1" stopColor="#1A5FE0" />
            </linearGradient>
          </defs>
          <path d="M5 2.5 9 3.9v13.3l5.3-3.1-2.6-1.2-1.6-4 8.4 2.9v4.4L9 21.5 5 19.3Z" fill={`url(#${gid})`} />
        </svg>
      );
    case 'claude':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label={BRAND_NAMES[id]}>
          <g stroke="#D97757" strokeWidth="2.3" strokeLinecap="round">
            {Array.from({ length: 11 }, (_, i) => {
              const a = (i / 11) * Math.PI * 2 - Math.PI / 2;
              const outer = i % 2 ? 8.6 : 10;
              return <line key={i} x1={12 + Math.cos(a) * 2.2} y1={12 + Math.sin(a) * 2.2} x2={12 + Math.cos(a) * outer} y2={12 + Math.sin(a) * outer} />;
            })}
          </g>
        </svg>
      );
    case 'outlook':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label={BRAND_NAMES[id]}>
          <rect x="2" y="3" width="20" height="18" rx="4" fill="#0f6cbd" />
          <circle cx="9" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="2.2" />
          <path d="M14 8h5v8h-5" fill="none" stroke="#9fd2ff" strokeWidth="1.8" />
        </svg>
      );
    case 'google_ads':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label={BRAND_NAMES[id]}>
          <path d="M8.6 3.9 2.7 14.1a3.4 3.4 0 0 0 5.9 3.4l5.9-10.2a3.4 3.4 0 0 0-5.9-3.4Z" fill="#FBBC04" />
          <path d="M15.4 3.9a3.4 3.4 0 0 0-5.9 3.4l5.9 10.2a3.4 3.4 0 0 0 5.9-3.4L15.4 3.9Z" fill="#4285F4" />
          <circle cx="5.65" cy="17.3" r="3.4" fill="#34A853" />
        </svg>
      );
    case 'meta':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label={BRAND_NAMES[id]}>
          <path
            d="M3 14.6c0-3.9 2-7.6 4.6-7.6 1.9 0 3.2 1.6 4.4 3.6 1.3-2.1 2.7-3.6 4.5-3.6 2.6 0 4.5 3.6 4.5 7.4 0 2.1-.9 3.6-2.6 3.6-1.6 0-2.6-1.2-4.4-4.2L12 10.6l-2 3.2c-1.8 2.9-2.9 4.2-4.5 4.2C3.9 18 3 16.6 3 14.6Z"
            fill="none"
            stroke="#0866FF"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'webshop':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label={BRAND_NAMES[id]}>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#EE672F" />
          <path d="M12 5.5 6.5 8.6v7.3l1.9 1.1V9.7L12 7.6l3.6 2.1V17l1.9-1.1V8.6Zm0 4.2-1.7 1v7.3l1.7 1 1.7-1v-7.3Z" fill="#fff" />
        </svg>
      );
  }
}
