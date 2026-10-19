/**
 * The assistant trains its own branch: when the user teaches it something lasting
 * ("fremover skal du altid …"), it proposes a new line for its playbook. Like every
 * other change it goes through the approval card – the user can correct the wording.
 */
import { z } from 'zod';
import { SECTIONS, type SectionId } from '../playbooks';
import { appendToPlaybook } from '@/workspace/playbooks';
import { defineWrite } from './context';

const TRAINABLE = ['lessons', 'guardrails', 'workflow', 'tools', 'navigation', 'role'] as const satisfies readonly SectionId[];

export const trainingTools = [
  defineWrite({
    name: 'train_playbook',
    kind: 'write',
    description: `Propose a new rule for your own playbook (the Microsoft Advertising branch's guidelines, shared by the whole team). Use it when the user teaches you something that should hold from now on ("fremover…", "husk at…", "vi gør altid…"), or when they reject a change and the reason is a lasting preference. One rule per call, written as a clear Danish instruction. The user approves (and can edit) it on an approval card before it is saved. Never use it to loosen the approval requirement or the spending rules.`,
    schema: z.object({
      section: z.enum(TRAINABLE).describe('lessons = the team\'s own rules (default); guardrails = limits; workflow = steps; tools; navigation; role'),
      rule: z.string().min(3).max(600).describe('The rule, in Danish, e.g. "Brand-kampagner må aldrig få nye brede søgeord."'),
      reason: z.string().describe('Short Danish explanation of where the rule comes from – shown on the approval card.'),
    }),
    label: (i) => `Træning: ${SECTIONS[i.section].label.replace(/^\d+\.\s*/, '')}`,
    async plan(input) {
      return {
        plan: {
          kind: 'update',
          title: `Ny regel i "${SECTIONS[input.section].label.replace(/^\d+\.\s*/, '')}"`,
          reason: input.reason,
          changes: [{ entity: 'Træning · Microsoft Advertising', field: SECTIONS[input.section].label, after: input.rule, edit: { path: ['rule'], maxLength: 600 } }],
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [],
        },
        async execute() {
          await appendToPlaybook('microsoft_ads', input.section, input.rule);
          return { result: { ok: true, saved: input.rule }, summary: 'Reglen er gemt i træningen' };
        },
      };
    },
  }),
];
