import { describe, expect, it, vi } from 'vitest';
import { BRANCH_IDS, SECTION_IDS, cleanSections, defaultPlaybook, effectivePlaybook, playbookPrompt } from '@/ai/playbooks';
import { buildSystemPrompt } from '@/ai/prompt';
import { evaluateGuardrails } from '@/ai/guardrails';
import { getTool } from '@/ai/tools';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

const appended: unknown[] = [];
vi.mock('@/workspace/playbooks', () => ({ appendToPlaybook: async (...args: unknown[]) => void appended.push(args) }));

const business = { companyName: '', website: '', description: '', targetCpa: null, targetRoas: null, grossMarginPct: null, toneOfVoice: '', instructions: '' };

describe('playbooks', () => {
  it('every branch has a playbook, and the Microsoft one is fully written', () => {
    for (const id of BRANCH_IDS) expect(defaultPlaybook(id).role.length).toBeGreaterThan(20);
    const ms = defaultPlaybook('microsoft_ads');
    for (const s of SECTION_IDS.filter((x) => x !== 'lessons')) expect(ms[s].length, s).toBeGreaterThan(200);
  });

  it("the team's changes replace only the sections they changed", () => {
    const p = effectivePlaybook('microsoft_ads', { sections: { lessons: '- Aldrig broad match på brand.' }, updatedBy: 'Casper', updatedAt: 1 });
    expect(p.lessons).toBe('- Aldrig broad match på brand.');
    expect(p.role).toBe(defaultPlaybook('microsoft_ads').role);
  });

  it('goes into the system prompt, below the hard rule that it cannot loosen', () => {
    const prompt = buildSystemPrompt(business, { sections: { lessons: '- Aldrig broad match på brand.' }, updatedBy: null, updatedAt: null });
    expect(prompt).toContain('# Your playbook – Microsoft Advertising branch');
    expect(prompt).toContain('- Aldrig broad match på brand.');
    expect(prompt).toContain('You NEVER change anything on your own');
    expect(prompt.indexOf('You NEVER change anything')).toBeLessThan(prompt.indexOf('# Your playbook'));
    expect(playbookPrompt('microsoft_ads', null)).toMatch(/can never loosen/);
  });

  it('cleans section updates from the app', () => {
    expect(cleanSections({ role: 'a\r\nb', lessons: null, hacker: 'x', tools: 5 })).toEqual({ role: 'a\nb', lessons: null });
    expect(cleanSections({ role: 'x'.repeat(20_000) }).role).toHaveLength(12_000);
  });

  it('a rule from the chat is saved only after approval – like every other change', async () => {
    const tool = getTool('train_playbook')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const input = tool.schema.parse({ section: 'lessons', rule: 'Brand-kampagner må aldrig få brede søgeord.', reason: 'Du sagde det i chatten.' });
    const change = await tool.plan(input, {} as never);
    expect(change.plan?.changes[0]).toMatchObject({ field: '6. Lærte regler', after: 'Brand-kampagner må aldrig få brede søgeord.', edit: { path: ['rule'] } });
    expect(evaluateGuardrails(change.plan!, DEFAULT_SPEND_RULES, { currency: 'DKK', totalActiveDailyBudget: 0, monthToDateSpend: 0, daysLeftInMonth: 1 }).verdict).toBe('approve');
    expect(appended).toEqual([]);
    await change.execute();
    expect(appended).toEqual([['microsoft_ads', 'lessons', 'Brand-kampagner må aldrig få brede søgeord.']]);
  });
});
