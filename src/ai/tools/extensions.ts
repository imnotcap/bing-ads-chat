/**
 * What a full build plan (e.g. "Black Weeks 2026") needs beyond campaigns, ad groups,
 * keywords and ads:
 * - set_location_intent: show ads to people IN the places (Google's "tilstedeværelse") or also to
 *   people interested in them (Microsoft's default).
 * - add_sitelinks: sitelinks and a promotion, with their days, on campaigns or ad groups.
 * - check_item_ids: which item ids (varenumre) are in Microsoft's Merchant Center catalogue.
 * Every write is an approval card and is read back from Microsoft.
 */
import { z } from 'zod';
import type { ExtensionLevel, LocationIntent, NewAdExtension } from '@/bing/types';
import type { ChangeLine } from '@/stores/activity';
import { today } from '@/lib/format';
import { failedIndexes, readBack, report, verify, type LineCheck } from './checks';
import { defineRead, defineWrite, getAdGroups, getCampaign, memo } from './context';

const INTENT_LABEL: Record<LocationIntent, string> = {
  PeopleIn: 'Personer i området (tilstedeværelse)',
  PeopleInOrSearchingForOrViewingPages: 'Personer i eller interesseret i området',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dk = (iso?: string) => (iso ? iso.split('-').reverse().map((x, i) => (i < 2 ? String(Number(x)) : x)).join('-') : '');
const span = (a?: string, b?: string) => (a || b ? `${a ? dk(a) : 'nu'} – ${b ? dk(b) : 'ingen slut'}` : 'altid');

export const extensionTools = [
  defineWrite({
    name: 'set_location_intent',
    kind: 'write',
    description:
      'Who a campaign\'s locations reach: presence = only people in the places (Google\'s "tilstedeværelse" / "Presence"), presenceOrInterest = also people searching for or interested in them (Microsoft\'s default). Read back from Microsoft.',
    schema: z.object({ campaignId: z.string(), intent: z.enum(['presence', 'presenceOrInterest']), reason: z.string().describe('Why, in Danish – shown on the approval card.') }),
    label: () => 'Sætter placeringsindstilling',
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      if (!ctx.backend.getLocationIntent || !ctx.backend.setLocationIntent) throw new Error('Placeringsindstillingen kan kun sættes på den rigtige Microsoft-konto.');
      const want: LocationIntent = input.intent === 'presence' ? 'PeopleIn' : 'PeopleInOrSearchingForOrViewingPages';
      const now = await ctx.backend.getLocationIntent(ctx.accountId, c.id);
      if (now.intent === want) throw new Error(`"${c.name}" viser allerede annoncer til: ${INTENT_LABEL[want].toLowerCase()}.`);
      const line: ChangeLine = { entity: 'Kampagne', entityId: c.id, field: `${c.name} · placeringer gælder`, before: INTENT_LABEL[now.intent], after: INTENT_LABEL[want] };
      const checks: LineCheck<LocationIntent>[] = [{ line, index: 0, verify: (s) => (s === want ? null : INTENT_LABEL[s]) }];
      return {
        plan: { kind: 'update', title: `Placeringer · ${c.name}`, reason: input.reason, changes: [line], dailyBudgetDelta: 0, increasesSpend: want !== 'PeopleIn', campaignIds: [c.id] },
        execute: async () => {
          const res = await ctx.backend.setLocationIntent!(ctx.accountId, c.id, want);
          const state = await readBack(async () => (await ctx.backend.getLocationIntent!(ctx.accountId, c.id)).intent, checks, failedIndexes(res));
          return report(verify(checks, res, state), {
            noun: 'ændring',
            undo: { tool: 'set_location_intent', input: { campaignId: c.id, intent: now.intent === 'PeopleIn' ? 'presence' : 'presenceOrInterest', reason: 'Fortryd placeringsindstilling' } },
          });
        },
      };
    },
  }),

  defineWrite({
    name: 'add_sitelinks',
    kind: 'write',
    description:
      'Add sitelinks (and at most one promotion, e.g. "Op til 60 % på møbler og inventar") to a campaign or to some of its ad groups – with the days they may show. Microsoft: sitelink text max 25 characters with descriptions (35 without), the two descriptions max 35 each (both or none), at most 20 sitelinks per campaign or ad group; a promotion item max 20 characters, percentOff 60 = 60 %. Each sitelink is attached where it is listed (adGroupIds empty = the campaign). Read back from Microsoft; new extensions are reviewed by Microsoft before they show.',
    schema: z.object({
      campaignId: z.string(),
      sitelinks: z
        .array(
          z.object({
            text: z.string().min(1).max(35).describe('Max 25 characters with descriptions, 35 without.'),
            description1: z.string().max(35).optional(),
            description2: z.string().max(35).optional(),
            finalUrl: z.string().url(),
            adGroupIds: z.array(z.string()).max(100).optional().describe('Attach to these ad groups (empty: the campaign).'),
          }),
        )
        .max(200)
        .optional(),
      promotion: z
        .object({
          item: z.string().min(1).max(20).describe('What is on offer, e.g. "Møbler og inventar".'),
          percentOff: z.number().positive().max(100).optional(),
          amountOff: z.number().positive().optional(),
          upTo: z.boolean().optional().describe('"Op til" in front of the discount.'),
          code: z.string().max(15).optional(),
          finalUrl: z.string().url(),
          adGroupIds: z.array(z.string()).max(100).optional().describe('Attach to these ad groups (empty: the campaign).'),
        })
        .optional(),
      startDate: isoDate.optional().describe('First day they may show (YYYY-MM-DD).'),
      endDate: isoDate.optional().describe('Last day they may show (YYYY-MM-DD), included.'),
      reason: z.string().describe('Why, in Danish – shown on the approval card.'),
    }),
    label: (i) => `Tilføjer ${i.sitelinks?.length ?? 0} sitelinks${i.promotion ? ' og en kampagne' : ''}`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const b = ctx.backend;
      if (!b.addAdExtensions || !b.associateAdExtensions || !b.listAdExtensionAssociations) throw new Error('Sitelinks kan kun tilføjes på den rigtige Microsoft-konto.');
      if (!input.sitelinks?.length && !input.promotion) throw new Error('Angiv sitelinks eller en kampagne.');
      if (input.endDate && input.endDate < today()) throw new Error('Slutdatoen er passeret.');
      if (input.startDate && input.endDate && input.startDate > input.endDate) throw new Error('Startdatoen ligger efter slutdatoen.');
      if (input.promotion && !input.promotion.percentOff === !input.promotion.amountOff) throw new Error('En kampagne skal have enten procent eller beløb i rabat – ikke begge.');
      for (const s of input.sitelinks ?? []) {
        if (!!s.description1 !== !!s.description2) throw new Error(`Sitelinket "${s.text}" skal have begge beskrivelser eller ingen.`);
        if (s.description1 && s.text.length > 25) throw new Error(`Sitelinket "${s.text}" er for langt: med beskrivelser må teksten højst være 25 tegn (35 uden).`);
      }
      // Microsoft: at most 20 sitelinks per campaign or ad group.
      const perPlace = new Map<string, number>();
      for (const s of input.sitelinks ?? []) for (const w of s.adGroupIds?.length ? s.adGroupIds.map(String) : ['']) perPlace.set(w, (perPlace.get(w) ?? 0) + 1);
      const crowded = [...perPlace].find(([, n]) => n > 20);
      if (crowded) throw new Error(`Microsoft tillader højst 20 sitelinks pr. ${crowded[0] ? 'annoncegruppe' : 'kampagne'} – der er ${crowded[1]}.`);
      const groups = await getAdGroups(ctx, c.id);
      const nameOf = new Map(groups.map((g) => [g.id, g.name]));
      for (const id of [...(input.sitelinks ?? []).flatMap((s) => s.adGroupIds ?? []), ...(input.promotion?.adGroupIds ?? [])])
        if (!nameOf.has(String(id))) throw new Error(`Annoncegruppe ${id} findes ikke i "${c.name}".`);

      // One extension per item; attached to each place listed.
      const items: { ext: NewAdExtension; where: string[]; label: string }[] = [
        ...(input.sitelinks ?? []).map((s) => ({
          ext: { kind: 'sitelink' as const, text: s.text, description1: s.description1, description2: s.description2, finalUrl: s.finalUrl, startDate: input.startDate, endDate: input.endDate },
          where: (s.adGroupIds ?? []).map(String),
          label: s.text,
        })),
        ...(input.promotion
          ? [
              {
                ext: { kind: 'promotion' as const, item: input.promotion.item, percentOff: input.promotion.percentOff, amountOff: input.promotion.amountOff, upTo: input.promotion.upTo, code: input.promotion.code, finalUrl: input.promotion.finalUrl, language: 'Danish', currency: ctx.currency, startDate: input.startDate, endDate: input.endDate },
                where: (input.promotion.adGroupIds ?? []).map(String),
                label: input.promotion.item,
              },
            ]
          : []),
      ];
      const lines: ChangeLine[] = items.map((it) => ({
        entity: 'Annoncegruppe',
        field: it.ext.kind === 'sitelink' ? `Sitelink · ${it.where.length ? it.where.map((id) => nameOf.get(id)).join(', ') : 'hele kampagnen'}` : `Kampagne (promotion) · ${it.where.length ? it.where.map((id) => nameOf.get(id)).join(', ') : 'hele kampagnen'}`,
        after:
          it.ext.kind === 'sitelink'
            ? `${it.ext.text}${it.ext.description1 ? ` – ${it.ext.description1} / ${it.ext.description2}` : ''} → ${it.ext.finalUrl}`
            : `${it.ext.upTo ? 'Op til ' : ''}${it.ext.percentOff ? `${it.ext.percentOff} %` : `${it.ext.amountOff} ${ctx.currency}`} på ${it.ext.item}${it.ext.code ? ` (kode ${it.ext.code})` : ''} → ${it.ext.finalUrl}`,
        cells: { group: it.where.length ? it.where.map((id) => nameOf.get(id)).join(', ') : 'Hele kampagnen' },
      }));
      const notes = [`Vises ${span(input.startDate, input.endDate)}. Microsoft gennemgår nye udvidelser, før de vises.`];

      return {
        plan: { kind: 'create', title: `Sitelinks${input.promotion ? ' og kampagne' : ''} · ${c.name}`, reason: input.reason, changes: lines, dailyBudgetDelta: 0, increasesSpend: false, campaignIds: [c.id], notes },
        execute: async () => {
          const created = await b.addAdExtensions!(ctx.accountId, items.map((i) => i.ext));
          const ids: (string | null)[] = [];
          let k = 0;
          const failedAt = new Set((created.failed ?? []).map((f) => f.index));
          items.forEach((_, i) => ids.push(failedAt.has(i) ? null : (created.ids?.[k++] ?? null)));
          // Attach: per level, each extension to its places.
          const pairs = { Campaign: [] as { extensionId: string; entityId: string }[], AdGroup: [] as { extensionId: string; entityId: string }[] };
          items.forEach((it, i) => {
            const id = ids[i];
            if (!id) return;
            if (!it.where.length) pairs.Campaign.push({ extensionId: id, entityId: c.id });
            else for (const g of it.where) pairs.AdGroup.push({ extensionId: id, entityId: g });
          });
          const attachErrors: string[] = [];
          for (const level of ['Campaign', 'AdGroup'] as ExtensionLevel[]) {
            if (!pairs[level].length) continue;
            const r = await b.associateAdExtensions!(ctx.accountId, pairs[level], level);
            attachErrors.push(...(r.failed ?? []).map((f) => f.message));
          }
          // Read back what is attached where.
          type State = Map<string, Set<string>>;
          const read = async (): Promise<State> => {
            const out: State = new Map();
            for (const kind of ['sitelink', 'promotion'] as const)
              for (const level of ['Campaign', 'AdGroup'] as ExtensionLevel[]) {
                const entities = level === 'Campaign' ? [c.id] : [...new Set(items.flatMap((it) => it.where))];
                if (!entities.length) continue;
                for (const a of await b.listAdExtensionAssociations!(ctx.accountId, kind, level, entities).catch(() => []))
                  out.set(a.extensionId, (out.get(a.extensionId) ?? new Set()).add(a.entityId));
              }
            return out;
          };
          const checks: LineCheck<State>[] = items.map((it, i) => ({
            line: lines[i]!,
            index: i,
            verify: (s) => {
              const id = ids[i];
              if (!id) return 'ikke oprettet';
              const at = s.get(id) ?? new Set<string>();
              const want = it.where.length ? it.where : [c.id];
              const missing = want.filter((w) => !at.has(w));
              return missing.length ? `ikke tilknyttet ${missing.map((m) => nameOf.get(m) ?? 'kampagnen').join(', ')}` : null;
            },
          }));
          const state = await readBack(read, checks, failedIndexes(created));
          return report(verify(checks, created, state), {
            noun: ['udvidelse', 'udvidelser'],
            warnings: [...notes.slice(1), ...attachErrors.map((e) => `Tilknytning: ${e}`), 'Nye sitelinks og kampagner afventer Microsofts godkendelse, før de vises.'],
          });
        },
      };
    },
  }),

  defineRead({
    name: 'check_item_ids',
    kind: 'read',
    description:
      'Which item ids (varenumre / Merchant Item IDs) exist in Microsoft\'s Merchant Center catalogue – before Shopping ad groups are built on them. Returns the matched ids with their catalogue titles and the ones not found (often a different case or a missing leading letter: the closest catalogue ids are suggested). Reads the whole catalogue once per conversation.',
    schema: z.object({ itemIds: z.array(z.string().min(1).max(100)).min(1).max(3000) }),
    label: (i) => `Tjekker ${i.itemIds.length} varenumre mod kataloget`,
    async run(input, ctx) {
      if (!ctx.backend.catalogItems) throw new Error('Kataloget kan kun læses på den rigtige Microsoft-konto.');
      const catalog = await memo(ctx, 'catalog-items', () => ctx.backend.catalogItems!(ctx.accountId));
      const ids = [...new Set(input.itemIds.map((x) => x.trim()).filter(Boolean))];
      const found = ids.filter((id) => catalog.has(id.toLowerCase()));
      const missing = ids.filter((id) => !catalog.has(id.toLowerCase()));
      const keys = [...catalog.keys()];
      const near = (id: string) => {
        const k = id.toLowerCase().replace(/^[a-z]/, '');
        return keys.filter((x) => x.replace(/^[a-z]/, '') === k).slice(0, 2);
      };
      return {
        result: {
          catalogSize: catalog.size,
          matched: found.length,
          notFound: missing.length,
          matchedItems: found.slice(0, 400).map((id) => ({ id: catalog.get(id.toLowerCase())!.id, title: catalog.get(id.toLowerCase())!.title })),
          notFoundItems: missing.map((id) => ({ id, ...(near(id).length ? { closest: near(id) } : {}) })),
          note: 'Matching ignores upper/lower case; Microsoft stores the id as the feed writes it. Build product groups only on matched ids, and list the others for the user.',
        },
        summary: `${found.length} af ${ids.length} varenumre findes i kataloget`,
      };
    },
  }),

  defineRead({
    name: 'list_sitelinks',
    kind: 'read',
    description:
      'The sitelinks and promotions that can show on a campaign: the account\'s own (inherited – they show on every campaign unless the campaign or ad group has its own), the campaign\'s and its ad groups\'. Use it to check a build plan ("nedarvede sitelinks") and before adding new ones. Read only – never change account-level ones to fix one campaign.',
    schema: z.object({ campaignId: z.string() }),
    label: () => 'Henter sitelinks',
    async run(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const b = ctx.backend;
      if (!b.listAdExtensionAssociations) throw new Error('Sitelinks kan kun læses på den rigtige Microsoft-konto.');
      const groups = await getAdGroups(ctx, c.id);
      const nameOf = new Map(groups.map((g) => [g.id, g.name]));
      const read = async (kind: 'sitelink' | 'promotion') => ({
        account: await b.listAdExtensionAssociations!(ctx.accountId, kind, 'Account', [ctx.accountId]).catch(() => []),
        campaign: await b.listAdExtensionAssociations!(ctx.accountId, kind, 'Campaign', [c.id]).catch(() => []),
        adGroups: groups.length ? await b.listAdExtensionAssociations!(ctx.accountId, kind, 'AdGroup', groups.map((g) => g.id)).catch(() => []) : [],
      });
      const [sl, pr] = await Promise.all([read('sitelink'), read('promotion')]);
      const show = (list: { text: string; status?: string; entityId: string }[], withGroup = false) => list.map((x) => ({ text: x.text, ...(x.status ? { status: x.status } : {}), ...(withGroup ? { adGroup: nameOf.get(x.entityId) ?? x.entityId } : {}) }));
      return {
        result: {
          campaign: c.name,
          sitelinks: { inheritedFromAccount: show(sl.account), onCampaign: show(sl.campaign), onAdGroups: show(sl.adGroups, true) },
          promotions: { inheritedFromAccount: show(pr.account), onCampaign: show(pr.campaign), onAdGroups: show(pr.adGroups, true) },
          note: 'Microsoft uses the most specific level: ad group sitelinks replace the campaign\'s, and the campaign\'s replace the account\'s.',
        },
        summary: `${sl.account.length + sl.campaign.length + sl.adGroups.length} sitelinks · ${c.name}`,
      };
    },
  }),
];
