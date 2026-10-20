import { describe, expect, it, vi } from 'vitest';

vi.mock('@/workspace/shared', () => ({ sharedKey: async () => null }));

describe('Danish language check', () => {
  it('spots German, Swedish and Norwegian look-alikes and suggests the Danish word', async () => {
    const { foreignWords } = await import('@/ai/proofread');
    expect(foreignWords('lagerregal')).toMatchObject({ suggestion: 'lagerreol' });
    expect(foreignWords('Lagerregale til værksted')?.suggestion).toBe('Lagerreoler til værksted');
    expect(foreignWords('skrivbord hæve sænke')?.suggestion).toBe('skrivebord hæve sænke');
    expect(foreignWords('verktøyskab')?.suggestion).toBe('værktøjskab');
    for (const ok of ['lagerreol', 'butiksinventar', 'stålskabe til værksted', 'kontorstole', 'hylder', 'hyllest', 'værktøjsvæg']) expect(foreignWords(ok)).toBeNull();
  });

  it('puts a one-click correction on the line and a note on the card', async () => {
    const { proofreadPlan } = await import('@/ai/proofread');
    const plan = await proofreadPlan({
      kind: 'create',
      title: 'Nye søgeord',
      changes: [
        { entity: 'Søgeord', field: 'Søgeord · udtryk', after: 'lagerregal', edit: { path: ['keywords', 0, 'text'] } },
        { entity: 'Søgeord', field: 'Søgeord · udtryk', after: 'lagerreol', edit: { path: ['keywords', 1, 'text'] } },
        { entity: 'Annonce', field: 'Slut-URL', after: 'https://example.com/regal' },
      ],
      dailyBudgetDelta: 0,
      increasesSpend: false,
      campaignIds: [],
    });
    expect(plan.changes[0]!.suggestion).toMatchObject({ value: 'lagerreol' });
    expect(plan.changes[1]!.suggestion).toBeUndefined();
    expect(plan.changes[2]!.suggestion).toBeUndefined();
    expect(plan.notes?.[0]).toMatch(/Sprogtjek: 1 tekst/);
  });
});
