/**
 * A note in the team's notes sheet when the user asks for one ("lav et notat om …", "lav et
 * test-notat"). The card shows the row, editable; it is written – added at the bottom of the
 * sheet's table, never anything else – only when the user approves. Changes made through the
 * app get their notes by themselves (ai/notes.ts → startNoteDrafts).
 */
import { z } from 'zod';
import type { ChangeLine } from '@/stores/activity';
import { useAccount } from '@/stores/account';
import { writeNotes } from '@/workspace/shared';
import { defineWrite } from './context';

export const noteTools = [
  defineWrite({
    name: 'add_note_to_sheet',
    kind: 'write',
    description:
      "Add a row to the team's notes sheet in Google Sheets (\"Notatark\": Dato, Tid, Kampagne, Annoncegruppe, Emne, Status, Etiket, Kommentar) – when the user asks for a note or a test note. Date, time, status and the user's name are filled in by the app. The user sees and can edit the row on the card before it is written. Changes made through the app (cards, campaign pages) get their rows by themselves – don't add notes for those. Never make a CSV or other file instead.",
    schema: z.object({
      campaign: z.string().max(300).optional().describe('The Microsoft campaign name, if the note is about one.'),
      adGroup: z.string().max(300).optional().describe('The ad group name, if the note is about one.'),
      topic: z.string().max(60).optional().describe('Emne: Produkter, Annoncegruppe, Kampagne, Søgeord … (default Kampagne).'),
      comment: z.string().min(1).max(1000).describe('The note, short and concrete in Danish, like the team writes them ("Ekskluderede 2712160205", "Test fra XavierOS – kan slettes").'),
      reason: z.string().describe('Why, in Danish – shown on the card.'),
    }),
    label: () => 'Skriver i notatarket',
    async plan(input) {
      const ns = useAccount.getState().workspace?.notesheet;
      if (!ns?.connected) throw new Error('Notatarket er ikke forbundet. En administrator forbinder det under Indstillinger → Forbindelser → Notatark (Google Sheets).');
      const lines: ChangeLine[] = [
        { entity: 'Notat', field: 'Kampagne', after: input.campaign ?? '', edit: { path: ['campaign'], maxLength: 300 } },
        { entity: 'Notat', field: 'Annoncegruppe', after: input.adGroup ?? '', edit: { path: ['adGroup'], maxLength: 300 } },
        { entity: 'Notat', field: 'Emne', after: input.topic ?? 'Kampagne', edit: { path: ['topic'], maxLength: 60 } },
        { entity: 'Notat', field: 'Kommentar', after: input.comment, edit: { path: ['comment'], maxLength: 1000 } },
      ];
      return {
        plan: {
          kind: 'update',
          title: `Notat i ${ns.name ?? 'notatarket'}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [],
          notes: [`Tilføjes nederst i fanen "${ns.tab}". Dato, tid, status og dit navn sættes på. Intet andet i arket ændres.`],
          approvalReasons: ['Rækken skrives i jeres fælles notatark.'],
        },
        execute: async () => {
          await writeNotes([{ campaign: input.campaign ?? '', adGroup: input.adGroup ?? '', topics: [input.topic || 'Kampagne'], comment: input.comment }]);
          return { result: { outcome: 'written', sheet: ns.name, tab: ns.tab }, summary: 'Skrevet i notatarket' };
        },
      };
    },
  }),
];
