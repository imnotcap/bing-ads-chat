/**
 * Platform and AI-provider marks (simplified), so sources are recognisable at a
 * glance – same marks as Inventarland for the ad platforms.
 */
import { useId } from 'react';
import { cn } from '@/lib/utils';

export type Brand = 'microsoft_ads' | 'google_ads' | 'meta' | 'linkedin' | 'microsoft' | 'google' | 'claude' | 'gemini';

export const BRAND_LABELS: Record<Brand, string> = {
  microsoft_ads: 'Microsoft Advertising',
  google_ads: 'Google Ads',
  meta: 'Meta',
  linkedin: 'LinkedIn',
  microsoft: 'Microsoft',
  google: 'Google',
  claude: 'Claude',
  gemini: 'Gemini',
};

export function BrandIcon({ brand, className }: { brand: Brand; className?: string }) {
  const id = useId();
  const cls = cn('size-4 shrink-0', className);
  switch (brand) {
    case 'microsoft_ads':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label="Microsoft Advertising">
          <defs>
            <linearGradient id={`${id}-ms`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#37BDFF" />
              <stop offset="1" stopColor="#1A5FE0" />
            </linearGradient>
          </defs>
          <path d="M5 2.5 9 3.9v13.3l5.3-3.1-2.6-1.2-1.6-4 8.4 2.9v4.4L9 21.5 5 19.3Z" fill={`url(#${id}-ms)`} />
        </svg>
      );
    case 'google_ads':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label="Google Ads">
          <path d="M8.6 3.9 2.7 14.1a3.4 3.4 0 0 0 5.9 3.4l5.9-10.2a3.4 3.4 0 0 0-5.9-3.4Z" fill="#FBBC04" />
          <path d="M15.4 3.9a3.4 3.4 0 0 0-5.9 3.4l5.9 10.2a3.4 3.4 0 0 0 5.9-3.4L15.4 3.9Z" fill="#4285F4" />
          <circle cx="5.65" cy="17.3" r="3.4" fill="#34A853" />
        </svg>
      );
    case 'meta':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label="Meta">
          <path
            d="M3 14.6c0-3.9 2-7.6 4.6-7.6 1.9 0 3.2 1.6 4.4 3.6 1.3-2.1 2.7-3.6 4.5-3.6 2.6 0 4.5 3.6 4.5 7.4 0 2.1-.9 3.6-2.6 3.6-1.6 0-2.6-1.2-4.4-4.2L12 10.6l-2 3.2c-1.8 2.9-2.9 4.2-4.5 4.2C3.9 18 3 16.6 3 14.6Z"
            fill="none"
            stroke="#0866FF"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label="LinkedIn">
          <rect x="2" y="2" width="20" height="20" rx="4.5" fill="#0A66C2" />
          <path d="M7 10h2.6v7H7Zm1.3-4.1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.2 10h2.5v1c.4-.7 1.3-1.2 2.5-1.2 2.4 0 2.8 1.5 2.8 3.5V17h-2.6v-3.2c0-.9 0-1.9-1.2-1.9s-1.4.9-1.4 1.8V17h-2.6Z" fill="#fff" />
        </svg>
      );
    case 'microsoft':
      return (
        <svg viewBox="0 0 21 21" className={cls} aria-label="Microsoft">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
      );
    case 'google':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label="Google">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      );
    case 'claude':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label="Claude">
          <g stroke="#D97757" strokeWidth="2.3" strokeLinecap="round">
            {Array.from({ length: 11 }, (_, i) => {
              const a = (i / 11) * Math.PI * 2 - Math.PI / 2;
              const outer = i % 2 ? 8.6 : 10;
              return <line key={i} x1={12 + Math.cos(a) * 2.2} y1={12 + Math.sin(a) * 2.2} x2={12 + Math.cos(a) * outer} y2={12 + Math.sin(a) * outer} />;
            })}
          </g>
        </svg>
      );
    case 'gemini':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-label="Gemini">
          <defs>
            <linearGradient id={`${id}-gm`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4796E3" />
              <stop offset="0.55" stopColor="#9177C7" />
              <stop offset="1" stopColor="#D96570" />
            </linearGradient>
          </defs>
          <path d="M12 1.5C12 7.3 16.7 12 22.5 12 16.7 12 12 16.7 12 22.5 12 16.7 7.3 12 1.5 12 7.3 12 12 7.3 12 1.5Z" fill={`url(#${id}-gm)`} />
        </svg>
      );
  }
}
