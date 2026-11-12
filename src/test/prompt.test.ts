import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '@/ai/prompt';
import { ALL_TOOLS } from '@/ai/tools';

const business = { companyName: '', website: '', description: '', targetCpa: null, targetRoas: null, grossMarginPct: null, toneOfVoice: '', instructions: '' };
const prompt = buildSystemPrompt(business);

describe('the assistant\'s rules – quality checks', () => {
  it('names only tools that exist', () => {
    const tools = new Set(ALL_TOOLS.map((t) => t.name));
    // Words with an underscore that are not tools: result fields, input values, server tools.
    const notTools = new Set(['bid_on', 'partially_applied', 'sent_unverified', 'microsoft_ads', 'web_fetch', 'web_search', 'ad_groups', 'negative_keywords', 'ad_storage']);
    const named = [...new Set(prompt.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [])].filter((w) => !notTools.has(w));
    expect(named.filter((w) => !tools.has(w))).toEqual([]);
  });

  it('has every section once, with the reasoning before the data rules and the changes', () => {
    const heads = prompt.split('\n').filter((l) => l.startsWith('# '));
    expect(new Set(heads).size).toBe(heads.length);
    const at = (h: string) => heads.findIndex((x) => x.startsWith(h));
    for (const h of ['# How you reason', '# Standard diagnoses', '# When not to recommend', '# Permission', '# Honesty about results', '# Making changes', '# Safety']) expect(at(h)).toBeGreaterThanOrEqual(0);
    expect(at('# How you reason')).toBeLessThan(at('# Working with data'));
    expect(at('# Standard diagnoses')).toBeLessThan(at('# Making changes'));
  });

  it('states no rule twice and gives one set of data limits', () => {
    const bullets = prompt.split('\n').map((l) => l.trim()).filter((l) => l.length > 60);
    expect(bullets.filter((l, i) => bullets.indexOf(l) !== i)).toEqual([]);
    // The limits the verdicts rest on are each stated in one place.
    expect(prompt.match(/100 clicks or 10 conversions/g)).toHaveLength(1);
    expect(prompt.match(/7 full days and 30 clicks/g)).toHaveLength(1);
  });

  it('stays within a size the model reads in full', () => {
    expect(prompt.length).toBeLessThan(60_000);
  });
});
