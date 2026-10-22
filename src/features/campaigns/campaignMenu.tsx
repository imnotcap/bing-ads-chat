/** Right-click menu for a campaign (Kampagner page and the dashboard's campaign table). */
import { Copy, Hash, LayoutGrid, Pause, Play, Sparkles } from '@/components/icons';
import type { ContextItem } from '@/components/ui/contextMenu';
import { copyText } from '@/components/ui/contextMenu';
import type { CampaignRow } from '@/hooks/useAdsData';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/startChat';
import { userUpdateCampaigns } from './actions';

export function campaignMenuItems(c: CampaignRow, all: CampaignRow[], { openList = false }: { openList?: boolean } = {}): ContextItem[] {
  const active = c.status === 'Active';
  const items: (ContextItem | false)[] = [
    {
      label: 'Spørg assistenten om kampagnen',
      icon: <Sparkles />,
      onSelect: () => {
        useUi.getState().go('chat');
        startChat(`Analysér kampagnen "${c.name}" (id ${c.id}) i den valgte periode: hvad går godt, hvad bør forbedres, og hvilke konkrete ændringer foreslår du?`);
      },
    },
    openList && { label: 'Åbn i Kampagner', icon: <LayoutGrid />, onSelect: () => useUi.getState().go('campaigns') },
    (active || c.status === 'Paused') && {
      label: active ? 'Sæt på pause' : 'Aktivér',
      icon: active ? <Pause /> : <Play />,
      onSelect: () => void userUpdateCampaigns(all, [{ campaignId: c.id, status: active ? 'Paused' : 'Active' }], `${c.name} ${active ? 'sat på pause' : 'aktiveret'}`),
    },
    { label: 'Kopiér navn', icon: <Copy />, onSelect: () => copyText(c.name), separated: true },
    { label: 'Kopiér kampagne-id', icon: <Hash />, onSelect: () => copyText(c.id) },
  ];
  return items.filter((i): i is ContextItem => !!i);
}
