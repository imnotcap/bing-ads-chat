/**
 * "Ekskl. brand" for Overblik and Dagligt overblik: which campaigns are brand (the user's
 * choice per account, else "brand" in the name – daily.ts → brandCampaignIds), the switch
 * (remembered in the settings, the same on both pages) and the picker.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Dialog } from '@/components/ui/overlays';
import { useCampaigns } from '@/hooks/useAdsData';
import { addDays, today } from '@/lib/format';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { brandCampaignIds } from './daily';

/** The account's brand campaigns, the campaign list they come from, and whether the user chose them. */
export function useBrand() {
  const accountId = useConnection((s) => s.accountId);
  const range = useMemo(() => ({ from: addDays(today(), -30), to: today() }), []);
  const campaigns = useCampaigns(range);
  const chosen = useSettings((s) => (accountId ? s.brandCampaigns[accountId] : undefined));
  const ids = useMemo(() => brandCampaignIds(campaigns.data ?? [], chosen), [campaigns.data, chosen]);
  const exclude = useSettings((s) => s.excludeBrand);
  const names = (campaigns.data ?? []).filter((c) => ids.includes(c.id)).map((c) => c.name);
  return { accountId, ids, names, chosen, campaigns: campaigns.data ?? [], exclude, active: exclude && ids.length > 0 };
}

/** "Alle kampagner / Ekskl. brand" and "Brand (n)" – the same switch on both pages. */
export function BrandSwitch() {
  const brand = useBrand();
  const setExclude = useSettings((s) => s.setExcludeBrand);
  const [pick, setPick] = useState(false);
  return (
    <>
      <Segmented
        layoutId="brand-scope"
        size="sm"
        value={brand.exclude ? 'nobrand' : 'all'}
        onChange={(v) => setExclude(v === 'nobrand')}
        options={[
          { value: 'all', label: 'Alle kampagner' },
          { value: 'nobrand', label: 'Ekskl. brand', title: brand.ids.length ? `Uden ${brand.names.join(', ')}` : 'Ingen brand-kampagner fundet – vælg dem' },
        ]}
      />
      <Button variant="ghost" size="sm" onClick={() => setPick(true)}>
        Brand ({brand.ids.length})
      </Button>
      <BrandPicker open={pick} onClose={() => setPick(false)} accountId={brand.accountId} campaigns={brand.campaigns} chosen={brand.chosen} current={brand.ids} />
    </>
  );
}

/** The line that says what is left out. */
export function BrandNote({ className }: { className?: string }) {
  const brand = useBrand();
  if (!brand.exclude) return null;
  return (
    <p className={className ?? 'text-[12.5px] text-muted'}>
      {brand.ids.length ? `Ekskl. brand: ${brand.names.join(', ')} er trukket fra.` : 'Ingen brand-kampagner fundet (ingen kampagne har "brand" i navnet) – vælg dem under Brand.'}
    </p>
  );
}

/** Which campaigns count as brand for the account – remembered per account (default: "brand" in the name). */
export function BrandPicker({
  open,
  onClose,
  accountId,
  campaigns,
  chosen,
  current,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
  campaigns: { id: string; name: string; status: string }[];
  chosen: string[] | undefined;
  current: string[];
}) {
  const setBrandCampaigns = useSettings((s) => s.setBrandCampaigns);
  const [picked, setPicked] = useState<Set<string>>(new Set(current));
  const [q, setQ] = useState('');
  // Opens with what counts as brand right now.
  useEffect(() => {
    if (open) setPicked(new Set(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const list = campaigns.filter((c) => c.status !== 'Deleted' && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Hvilke kampagner er brand?"
      description={chosen ? 'Valgt af jer for denne konto.' : 'Lige nu: kampagner med "brand" i navnet. Vælg selv, hvis det ikke passer.'}
      footer={
        <>
          {chosen && (
            <Button
              variant="ghost"
              onClick={() => {
                if (accountId) setBrandCampaigns(accountId, null);
                onClose();
              }}
            >
              Brug navnet igen
            </Button>
          )}
          <Button
            variant="positive"
            onClick={() => {
              if (accountId) setBrandCampaigns(accountId, [...picked]);
              onClose();
            }}
          >
            Gem ({picked.size})
          </Button>
        </>
      }
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Søg kampagne …"
        className="mb-2 h-9 w-full rounded-xl border border-line px-3 text-[13px] outline-none focus:border-brand/50"
      />
      <ul className="grid max-h-[50vh] gap-0.5 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-line-2/60">
              <input
                type="checkbox"
                checked={picked.has(c.id)}
                onChange={() => setPicked((p) => (p.has(c.id) ? new Set([...p].filter((x) => x !== c.id)) : new Set(p).add(c.id)))}
                className="size-4 accent-[var(--color-brand,#6d5cf6)]"
              />
              <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
              {c.status !== 'Active' && <span className="text-[11.5px] text-subtle">{c.status === 'Paused' ? 'Pauset' : c.status}</span>}
            </label>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
