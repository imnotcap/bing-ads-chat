/** Rule-based observations for the insights panel – each can be handed to the assistant. */
import type { CampaignRow } from '@/hooks/useAdsData';
import { daysBetween, fmtMoney, fmtNumber, type DateRange } from '@/lib/format';

export interface Alert {
  id: string;
  tone: 'opportunity' | 'warning' | 'info';
  title: string;
  detail: string;
  prompt: string;
}

export function computeAlerts(campaigns: CampaignRow[], range: DateRange, currency: string): Alert[] {
  const days = daysBetween(range.from, range.to);
  const active = campaigns.filter((c) => c.status === 'Active' && c.metrics);
  const spend = active.reduce((s, c) => s + (c.metrics?.spend ?? 0), 0);
  const conv = active.reduce((s, c) => s + (c.metrics?.conversions ?? 0), 0);
  const avgCpa = conv ? spend / conv : null;
  const out: Alert[] = [];

  for (const c of active) {
    const m = c.metrics!;
    const budget = (c.dailyBudget ?? 0) * days;
    if (budget > 0 && (m.spend ?? 0) >= budget * 0.95 && (m.roas ?? 0) >= 3) {
      out.push({
        id: `budget-${c.id}`,
        tone: 'opportunity',
        title: `${c.name} er begrænset af budget`,
        detail: `Bruger ${Math.round(((m.spend ?? 0) / budget) * 100)} % af budgettet med ROAS ${fmtNumber(m.roas, 1)}x`,
        prompt: `Kampagnen "${c.name}" (id ${c.id}) ser ud til at være begrænset af budget med en høj ROAS. Analysér om vi bør hæve budgettet, og hvor meget.`,
      });
    }
    if (avgCpa && (m.cpa ?? 0) > avgCpa * 2 && (m.spend ?? 0) > spend * 0.05) {
      out.push({
        id: `cpa-${c.id}`,
        tone: 'warning',
        title: `Høj CPA i ${c.name}`,
        detail: `CPA ${fmtMoney(m.cpa, currency)} – ${fmtNumber((m.cpa ?? 0) / avgCpa, 1)}x kontoens gennemsnit`,
        prompt: `Kampagnen "${c.name}" (id ${c.id}) har en CPA, der er langt over kontoens gennemsnit. Find årsagen (søgeord, søgetermer, annoncer) og foreslå konkrete forbedringer.`,
      });
    }
    if ((m.spend ?? 0) > Math.max(100, spend * 0.03) && !(m.conversions ?? 0)) {
      out.push({
        id: `noconv-${c.id}`,
        tone: 'warning',
        title: `${c.name} har ingen konverteringer`,
        detail: `${fmtMoney(m.spend, currency)} brugt uden konverteringer`,
        prompt: `Kampagnen "${c.name}" (id ${c.id}) har brugt penge uden konverteringer i perioden. Hvad skyldes det, og hvad bør vi gøre?`,
      });
    }
  }
  const paused = campaigns.filter((c) => c.status !== 'Active' && (c.metrics?.roas ?? 0) >= 4 && (c.metrics?.conversions ?? 0) >= 3);
  for (const c of paused) {
    out.push({
      id: `paused-${c.id}`,
      tone: 'info',
      title: `${c.name} er pauset`,
      detail: `Den havde ROAS ${fmtNumber(c.metrics?.roas, 1)}x i perioden`,
      prompt: `Kampagnen "${c.name}" (id ${c.id}) er pauset, men havde gode resultater. Bør vi genaktivere den?`,
    });
  }
  const rank = { opportunity: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
}
