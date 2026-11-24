/**
 * apply_stock_sheet: the sold-out sheet (Google Sheets, read by the Worker) applied to
 * Microsoft's product groups – Udsolgt / Fjernet excluded, På lager shown again at the bid it had before – on ONE
 * approval card for every Shopping ad group and Performance Max asset group (features/stock/stockPlan.ts).
 * Sent per group in one call and read back. What was done is remembered in the workspace, so
 * the dashboard's Lager tab stops asking.
 */
import { z } from 'zod';
import type { AdGroup, Campaign } from '@/bing/types';
import { toListingNodes } from '@/features/audit/bingDetail';
import type { DListingNode } from '@/features/audit/detail';
import { planEdit, type EditRequest, type MirrorGroup } from '@/features/audit/productMirror';
import { fmtMoney } from '@/lib/format';
import { loadOldBids, oldBidOf } from '@/workspace/oldBids';
import { OUT, stockEdit } from '@/features/stock/stockPlan';
import type { ChangeLine } from '@/stores/activity';
import { getStockSheet, markStockDone } from '@/workspace/shared';
import { useAccount } from '@/stores/account';
import type { StockRow, StockStatus } from '@/workspace/types';
import { defineWrite, expiredReason, getAdGroups, getCampaigns, type ExecutionResult } from './context';
import { PICK, applyGroups, cardLine, pmaxIO, shoppingIO, shownItems } from './google';

interface Planned {
  campaign: Campaign;
  pmax: boolean;
  groups: MirrorGroup[];
}

export const stockTools = [
  defineWrite({
    name: 'apply_stock_sheet',
    kind: 'write',
    description:
      'Apply the team\'s sold-out sheet (udsolgt-ark, Google Sheets: item id, status Udsolgt / Fjernet / På lager, expected date) to Microsoft: items Udsolgt or Fjernet are excluded in every active Shopping ad group and Performance Max asset group where they can show (only where Microsoft showed them in the last 90 days), items På lager that are excluded are shown again (exclusion removed – or bid on at the group\'s usual bid where "alt andet" is excluded). One approval card; each group sent in one call and read back. Use it when the user asks about the sold-out sheet, "udsolgte varer", or the dashboard\'s Lager tab. only: "exclude", "reactivate" or "both" (default). itemIds limits it to some of the sheet\'s items. Never use edit_product_groups or microsoft_ads_api for the sheet\'s items.',
    schema: z.object({
      only: z.enum(['exclude', 'reactivate', 'both']).optional(),
      itemIds: z.array(z.string().min(1).max(100)).max(1000).optional().describe('Only these of the sheet\'s item ids.'),
      campaignIds: z.array(z.string()).max(100).optional().describe('Only these Microsoft campaigns (default: all active Shopping and Performance Max).'),
      skip: z.array(z.string()).max(5000).optional().describe('Leave out – filled in from what the user ticks off on the card.'),
      reason: z.string().describe('Why, in Danish – shown on the approval card.'),
    }),
    label: () => 'Udsolgt-arket → produktgrupper',
    async plan(input, ctx) {
      if (!useAccount.getState().workspace?.stocksheet?.connected) throw new Error('Udsolgt-arket er ikke forbundet. En administrator forbinder det under Indstillinger → Forbindelser → Udsolgt-ark.');
      if (!ctx.backend.listProductPartitions || !ctx.backend.applyProductPartitionActions) throw new Error('Produktgrupper kan kun ændres på den rigtige Microsoft-konto (ikke demo).');
      const sheet = await getStockSheet(true);
      const only = input.only ?? 'both';
      const wanted = input.itemIds?.length ? new Set(input.itemIds.map((x) => x.trim().toLowerCase())) : null;
      const latest = new Map<string, StockRow>();
      for (const r of sheet.rows) if (!wanted || wanted.has(r.itemId.toLowerCase())) latest.set(r.itemId.toLowerCase(), r);
      const rows = [...latest.values()];
      const out = only === 'reactivate' ? [] : rows.filter((r) => OUT.has(r.status)).map((r) => r.itemId);
      const back = only === 'exclude' ? [] : rows.filter((r) => r.status === 'instock').map((r) => r.itemId);
      const unknown = rows.filter((r) => r.status === 'unknown');
      if (!out.length && !back.length) throw new Error(`Udsolgt-arket har ingen varer at ${only === 'reactivate' ? 'genaktivere' : only === 'exclude' ? 'udelukke' : 'udelukke eller genaktivere'}${wanted ? ' blandt de valgte varenumre' : ''}.`);

      const campaigns = (await getCampaigns(ctx)).filter((c: Campaign) =>
        input.campaignIds?.length ? input.campaignIds.includes(c.id) : c.status === 'Active' && (c.type === 'Shopping' || c.type === 'PerformanceMax'),
      );
      if (!campaigns.length) throw new Error('Ingen aktive Shopping- eller Performance Max-kampagner at rette i.');
      const planned: Planned[] = [];
      const notes: string[] = [];
      const old = await loadOldBids(ctx.accountId);
      let reused = 0;
      const raisedToMin: string[] = [];
      const touched = new Set<string>();
      for (const c of campaigns) {
        const pmax = c.type === 'PerformanceMax';
        if (c.type !== 'Shopping' && !pmax) continue;
        if (pmax && (!ctx.backend.listAssetGroupListingGroups || !ctx.backend.applyAssetGroupListingGroupActions)) continue;
        const shown = await shownItems(ctx, c.id, false);
        if (shown.error) notes.push(`"${c.name}": kunne ikke læse, hvilke produkter der er vist (${shown.error}) – udelukker alle varerne fra arket, hvor de kan vises.`);
        let trees: { id: string; name: string; cpcBid?: number | null; nodes: DListingNode[] }[];
        if (pmax) {
          const all = toListingNodes(await ctx.backend.listAssetGroupListingGroups!(ctx.accountId, c.id));
          const ids = [...new Set(all.map((n) => n.groupId).filter((x): x is string => !!x))];
          trees = ids.map((id) => {
            const nodes = all.filter((n) => n.groupId === id);
            return { id, name: nodes[0]!.group, nodes };
          });
        } else {
          const groups = (await getAdGroups(ctx, c.id)).filter((g: AdGroup) => g.status === 'Active' && !expiredReason(g));
          trees = await Promise.all(groups.map(async (g) => ({ id: g.id, name: g.name, cpcBid: g.cpcBid, nodes: toListingNodes(await ctx.backend.listProductPartitions!(ctx.accountId, g.id, g.name)) })));
        }
        const groups: MirrorGroup[] = [];
        for (const t of trees) {
          const req = stockEdit(t.nodes, out, back, shown.items ? (shown.items.byGroup.get(t.id) ?? new Set()) : null);
          if (!req.exclude.length && !req.remove.length && !req.include.length) continue;
          const group = { id: t.id, name: `${c.name} › ${t.name}`, cpcBid: t.cpcBid };
          let edit: EditRequest = { ...req, noBids: pmax };
          if (!pmax && (req.remove.length || req.include.length)) {
            // Back at the bid it had before it was excluded (workspace/oldBids.ts) – else under "alt andet"
            // again, or (where "alt andet" is excluded) at the group's bid, at least the minimum bid.
            const itemBids: Record<string, number> = {};
            const remove: string[] = [];
            const include: string[] = [];
            for (const id of [...req.remove, ...req.include]) {
              const bid = oldBidOf(old, t.id, id);
              if (bid) {
                itemBids[id] = bid;
                reused++;
              } else (req.remove.includes(id) ? remove : include).push(id);
            }
            edit = { ...edit, remove, include, itemBids };
            const first = planEdit(t.nodes, group, edit);
            const min = ctx.rules.minCpcBid;
            if (include.length && min && first.bid !== null && first.bid < min) {
              edit = { ...edit, include: [], itemBids: { ...itemBids, ...Object.fromEntries(include.map((id) => [id, min])) } };
              raisedToMin.push(...include);
            }
          }
          const g = planEdit(t.nodes, group, edit);
          if (g.status === 'unsupported') {
            notes.push(g.reason ?? `"${t.name}" kunne ikke rettes.`);
            continue;
          }
          if (!g.rows.length) continue;
          for (const r of g.rows) touched.add(r.itemId.toLowerCase());
          groups.push(g);
        }
        if (groups.length) planned.push({ campaign: c, pmax, groups });
      }

      const skip = new Set(input.skip ?? []);
      const lines: ChangeLine[] = planned.flatMap((p) => p.groups.flatMap((g) => g.rows.map((r) => cardLine(g, r, skip)).filter((l): l is ChangeLine => !!l)));
      const status = new Map(rows.map((r) => [r.itemId.toLowerCase(), r.status]));
      const considered = [...out, ...back];
      // Items with nothing to change anywhere are done already (not shown, or already as the sheet says).
      const nothing = considered.filter((id) => !touched.has(id.toLowerCase()));
      const doneItems = (ids: string[]) => ids.map((id) => ({ id, status: status.get(id.toLowerCase()) as StockStatus }));
      if (!lines.length) {
        if (nothing.length) await markStockDone(doneItems(nothing)).catch(() => undefined);
        throw new Error(
          `Intet at ændre: ${considered.length} ${considered.length === 1 ? 'vare' : 'varer'} fra udsolgt-arket er allerede, som arket siger – eller vises ikke i de aktive Shopping- og Performance Max-kampagner.`,
        );
      }
      const outCount = new Set(planned.flatMap((p) => p.groups.flatMap((g) => g.rows.filter((r) => r.action === 'add_exclude' || r.action === 'to_exclude').map((r) => r.itemId.toLowerCase())))).size;
      const backCount = new Set(planned.flatMap((p) => p.groups.flatMap((g) => g.rows.filter((r) => r.action === 'remove' || r.action === 'to_bid' || r.action === 'add_bid').map((r) => r.itemId.toLowerCase())))).size;
      return {
        plan: {
          kind: 'update',
          title: `Udsolgt-arket · ${[outCount ? `${outCount} udelukkes` : '', backCount ? `${backCount} genaktiveres` : ''].filter(Boolean).join(' · ')}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: backCount > 0,
          campaignIds: planned.map((p) => p.campaign.id),
          // The bids items get back – checked against the spending rules (minimum and maximum bid).
          newBids: planned.flatMap((p) => p.groups.flatMap((g) => g.rows.filter((r) => r.action === 'to_bid' || r.action === 'add_bid').map((r) => r.bid ?? g.bid).filter((b): b is number => !!b))),
          notes: [
            `Arket læst ${new Date(sheet.readAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}: ${out.length} udsolgte/fjernede og ${back.length} på lager.`,
            ...(nothing.length ? [`${nothing.length} ${nothing.length === 1 ? 'vare' : 'varer'} kræver intet: de er allerede som arket siger, eller Microsoft har ikke vist dem de seneste 90 dage.`] : []),
            ...(backCount
              ? [
                  `Genaktiverede varer får det bud, de havde, før de blev udelukket${reused ? ` (${reused} gemt)` : ''} – ellers falder de under "alt andet" igen, eller får gruppens bud, hvor "alt andet" er udelukket.`,
                ]
              : []),
            ...(raisedToMin.length && ctx.rules.minCpcBid
              ? [`${new Set(raisedToMin).size} ${new Set(raisedToMin).size === 1 ? 'vare' : 'varer'} uden gemt bud får mindstebuddet ${fmtMoney(ctx.rules.minCpcBid, ctx.currency, 2)}, fordi gruppens bud er lavere.`]
              : []),
            ...(unknown.length ? [`${unknown.length} ${unknown.length === 1 ? 'række' : 'rækker'} har en status, appen ikke kender (${unknown.slice(0, 3).map((r) => `række ${r.row}: "${r.statusText}"`).join(', ')}) – brug Udsolgt, Fjernet eller På lager.`] : []),
            ...notes,
          ],
          pick: { ...PICK, columns: [], groupBid: undefined },
        },
        execute: async (): Promise<ExecutionResult> => {
          const results: ExecutionResult[] = [];
          for (const p of planned) {
            const mine = lines.filter((l) => p.groups.some((g) => g.bingAdGroupId === l.entityId));
            if (!mine.length) continue;
            results.push(await applyGroups(ctx, p.groups, mine, '', p.pmax ? pmaxIO(ctx, p.campaign.id) : shoppingIO(ctx)));
          }
          const applied = results.flatMap((r) => r.changes ?? []);
          const keys = new Set(applied.map((l) => l.pickKey));
          const appliedIds = new Set(planned.flatMap((p) => p.groups.flatMap((g) => g.rows.filter((r) => keys.has(r.key)).map((r) => r.itemId.toLowerCase()))));
          // An item counts as done when every row chosen for it went through.
          const chosenIds = new Set(planned.flatMap((p) => p.groups.flatMap((g) => g.rows.filter((r) => !skip.has(r.key)).map((r) => r.itemId.toLowerCase()))));
          const failedIds = new Set(
            planned.flatMap((p) => p.groups.flatMap((g) => g.rows.filter((r) => !skip.has(r.key) && !keys.has(r.key)).map((r) => r.itemId.toLowerCase()))),
          );
          const done = [...nothing, ...[...chosenIds].filter((id) => appliedIds.has(id) && !failedIds.has(id))];
          if (done.length) await markStockDone(doneItems(done)).catch(() => undefined);
          const parts = results.map((r) => r.result as { outcome: string; confirmed: number; notConfirmed?: string[]; failed?: string[] });
          const confirmed = parts.reduce((n, r) => n + (r.confirmed ?? 0), 0);
          const problems = [...parts.flatMap((r) => r.notConfirmed ?? []), ...parts.flatMap((r) => r.failed ?? [])];
          const outcome = problems.length ? (confirmed ? 'partial' : 'failed') : 'confirmed';
          return {
            result: {
              outcome,
              verifiedByReadBack: true,
              confirmed,
              ...(problems.length ? { problems } : {}),
              instruction:
                outcome === 'confirmed'
                  ? 'Microsoft confirms every change. Tell the user briefly which items were excluded and re-activated, and in how many ad groups.'
                  : 'Tell the user exactly which ad groups failed or were not confirmed, and why.',
            },
            summary: outcome === 'confirmed' ? `Bekræftet hos Microsoft: ${confirmed} ændringer` : `${confirmed} bekræftet · ${problems.length} ikke gennemført`,
            changes: applied,
          };
        },
      };
    },
  }),
];
