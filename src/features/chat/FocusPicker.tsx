/**
 * "Fokus" in the chat field: pick the campaign – and optionally one ad group in it – the
 * conversation is about. The assistant then gets the ids in its context and works there.
 */
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown, Crosshair, Layers, Loader2, Search, X } from '@/components/icons';
import { AnimatePresence, motion } from 'motion/react';
import { Popover } from 'radix-ui';
import { useMemo, useState } from 'react';
import { matchByName } from '@/ai/tools/find';
import { getBackend } from '@/bing/backend';
import type { Campaign } from '@/bing/types';
import { cn } from '@/lib/utils';
import { useConnection } from '@/stores/connection';
import { setFocus, useFocus } from './focus';

const trigger =
  'inline-flex h-7 min-w-0 max-w-[260px] items-center gap-1.5 rounded-md px-1.5 text-[12.5px] text-muted outline-none transition-colors hover:bg-line-2 hover:text-ink data-[state=open]:bg-line-2 data-[state=open]:text-ink';

const row = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-line-2 hover:text-ink';

const statusDot = (status: string) => (
  <span className={cn('size-1.5 shrink-0 rounded-full', status === 'Active' ? 'bg-positive' : 'bg-line')} title={status === 'Active' ? 'Aktiv' : 'Ikke aktiv'} />
);

function useCampaigns(enabled: boolean) {
  const { mode, accountId, revision } = useConnection();
  return useQuery({
    queryKey: ['focus-campaigns', mode, accountId, revision],
    enabled: enabled && !!accountId,
    queryFn: async () => {
      const backend = await getBackend();
      return backend.listCampaignsCached ? backend.listCampaignsCached(accountId!) : backend.listCampaigns(accountId!);
    },
  });
}

function useAdGroups(campaignId: string | null) {
  const { mode, accountId, revision } = useConnection();
  return useQuery({
    queryKey: ['focus-adgroups', mode, accountId, revision, campaignId],
    enabled: !!campaignId && !!accountId,
    queryFn: async () => (await getBackend()).listAdGroups(accountId!, campaignId!),
  });
}

export function FocusPicker() {
  const focus = useFocus();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const campaigns = useCampaigns(open);
  const adGroups = useAdGroups(open ? (campaign?.id ?? null) : null);

  const shown = useMemo(() => {
    const list = campaigns.data ?? [];
    const q = query.trim();
    const hits = q ? matchByName(list, q, 60) : [...list].sort((a, b) => Number(b.status === 'Active') - Number(a.status === 'Active') || a.name.localeCompare(b.name, 'da'));
    return hits.slice(0, 60);
  }, [campaigns.data, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setCampaign(null);
  };
  const choose = (c: Campaign, group?: { id: string; name: string }) => {
    setFocus({ campaignId: c.id, campaignName: c.name, ...(group ? { adGroupId: group.id, adGroupName: group.name } : {}) });
    close();
  };

  const label = focus ? (focus.adGroupName ? `${focus.campaignName} › ${focus.adGroupName}` : focus.campaignName) : 'Hele kontoen';

  return (
    <Popover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <Popover.Trigger asChild>
        <button type="button" className={cn(trigger, focus && 'text-ink-2')} aria-label="Fokus: kampagne og annoncegruppe" title={focus ? `Fokus: ${label}` : 'Vælg en kampagne eller annoncegruppe at arbejde i'}>
          <Crosshair className={cn('size-3.5 shrink-0', focus && 'text-brand')} />
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0" />
        </button>
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content forceMount side="top" align="start" sideOffset={8} collisionPadding={12} className="z-50 outline-none" onOpenAutoFocus={(e) => e.preventDefault()}>
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex max-h-[min(460px,70vh)] w-[360px] origin-[var(--radix-popover-content-transform-origin)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
              >
                {!campaign ? (
                  <>
                    <div className="border-b border-line p-2">
                      <div className="px-1.5 pb-1.5 pt-0.5 text-[12px] font-medium text-subtle">Fokus for samtalen</div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
                        <input
                          autoFocus
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Søg efter kampagne …"
                          aria-label="Søg efter kampagne"
                          className="h-8 w-full rounded-lg bg-line-2 pl-8 pr-2 text-[13px] outline-none placeholder:text-subtle focus:bg-white focus:ring-1 focus:ring-brand/30"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5">
                      {!query && (
                        <button type="button" className={row} onClick={() => (setFocus(null), close())}>
                          <Layers className="size-4 shrink-0 text-muted" />
                          <span className="flex-1">Hele kontoen</span>
                          {!focus && <Check className="size-4 text-brand" />}
                        </button>
                      )}
                      {campaigns.isLoading && (
                        <div className="flex items-center gap-2 px-2.5 py-3 text-[12.5px] text-muted">
                          <Loader2 className="size-3.5 animate-spin" /> Henter kampagner …
                        </div>
                      )}
                      {campaigns.isError && <div className="px-2.5 py-3 text-[12.5px] text-negative">Kampagnerne kunne ikke hentes.</div>}
                      {shown.map((c) => (
                        <button key={c.id} type="button" className={row} onClick={() => setCampaign(c)}>
                          {statusDot(c.status)}
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                          {focus?.campaignId === c.id && <Check className="size-4 shrink-0 text-brand" />}
                          <ChevronDown className="size-3.5 shrink-0 -rotate-90 text-subtle" />
                        </button>
                      ))}
                      {campaigns.data && !shown.length && <div className="px-2.5 py-3 text-[12.5px] text-muted">Ingen kampagner matcher.</div>}
                      {campaigns.data && campaigns.data.length > shown.length && shown.length === 60 && (
                        <div className="px-2.5 pb-1 pt-2 text-[11.5px] text-subtle">Viser 60 af {campaigns.data.length} – søg for at finde resten.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1 border-b border-line p-2">
                      <button type="button" onClick={() => setCampaign(null)} aria-label="Tilbage" className="grid size-7 place-items-center rounded-md text-muted hover:bg-line-2 hover:text-ink">
                        <ArrowLeft className="size-4" />
                      </button>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{campaign.name}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5">
                      <button type="button" className={row} onClick={() => choose(campaign)}>
                        <Layers className="size-4 shrink-0 text-muted" />
                        <span className="flex-1 font-medium">Hele kampagnen</span>
                        {focus?.campaignId === campaign.id && !focus.adGroupId && <Check className="size-4 text-brand" />}
                      </button>
                      <div className="px-2.5 pb-1 pt-2 text-[11.5px] text-subtle">Eller én annoncegruppe</div>
                      {adGroups.isLoading && (
                        <div className="flex items-center gap-2 px-2.5 py-2 text-[12.5px] text-muted">
                          <Loader2 className="size-3.5 animate-spin" /> Henter annoncegrupper …
                        </div>
                      )}
                      {adGroups.isError && <div className="px-2.5 py-2 text-[12.5px] text-negative">Annoncegrupperne kunne ikke hentes.</div>}
                      {(adGroups.data ?? []).map((g) => (
                        <button key={g.id} type="button" className={row} onClick={() => choose(campaign, g)}>
                          {statusDot(g.status)}
                          <span className="min-w-0 flex-1 truncate">{g.name}</span>
                          {focus?.adGroupId === g.id && <Check className="size-4 shrink-0 text-brand" />}
                        </button>
                      ))}
                      {adGroups.data && !adGroups.data.length && <div className="px-2.5 py-2 text-[12.5px] text-muted">Kampagnen har ingen annoncegrupper.</div>}
                    </div>
                  </>
                )}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
      {focus && (
        <button type="button" onClick={() => setFocus(null)} aria-label="Fjern fokus" title="Fjern fokus (hele kontoen)" className="-ml-1 grid size-6 place-items-center rounded-md text-subtle hover:bg-line-2 hover:text-ink">
          <X className="size-3" />
        </button>
      )}
    </Popover.Root>
  );
}
