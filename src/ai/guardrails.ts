/**
 * Spending guardrails ("Forbrugsregler"). Every change the assistant proposes is
 * turned into a ChangePlan and evaluated here before anything is sent to
 * Microsoft Advertising:
 *  - block   → never executed; the assistant is told which rule stopped it
 *  - approve → the user must approve it in the chat
 *  - allow   → executed right away (autopilot within the limits)
 */
import { fmtMoney } from '@/lib/format';
import type { ChangeLine, UndoSpec } from '@/stores/activity';
import type { SpendRules } from '@/stores/settings';

export interface ChangePlan {
  kind: 'update' | 'create' | 'delete' | 'raw';
  title: string;
  reason?: string;
  changes: ChangeLine[];
  /** Change in the sum of daily budgets of active campaigns. */
  dailyBudgetDelta: number;
  /** True when the change can increase spend (activations, higher bids, new keywords …). */
  increasesSpend: boolean;
  campaignIds: string[];
  /** Largest relative budget increase in the plan (0.4 = +40 %). */
  maxBudgetIncrease?: number | null;
  newDailyBudgets?: number[];
  newBids?: number[];
  notes?: string[];
  undo?: UndoSpec;
}

export interface SpendContext {
  currency: string;
  totalActiveDailyBudget: number | null;
  monthToDateSpend: number | null;
  daysLeftInMonth: number;
}

export interface GuardrailDecision {
  verdict: 'allow' | 'approve' | 'block';
  reasons: string[];
}

export function evaluateGuardrails(plan: ChangePlan, rules: SpendRules, ctx: SpendContext): GuardrailDecision {
  const block: string[] = [];
  const approve: string[] = [];
  const money = (v: number) => fmtMoney(v, ctx.currency);

  const protectedHit = plan.campaignIds.filter((id) => rules.protectedCampaignIds.includes(id));
  if (protectedHit.length) block.push(`Kampagne ${protectedHit.join(', ')} er beskyttet og må ikke ændres af assistenten.`);
  if (plan.kind === 'delete' && !rules.allowDelete) block.push('Sletning er slået fra i forbrugsreglerne.');
  if (plan.kind === 'create' && plan.changes.some((c) => c.entity === 'Kampagne') && !rules.allowCreateCampaigns) {
    block.push('Oprettelse af nye kampagner er slået fra i forbrugsreglerne.');
  }
  if (rules.maxDailyBudgetPerCampaign !== null) {
    const over = (plan.newDailyBudgets ?? []).filter((b) => b > rules.maxDailyBudgetPerCampaign!);
    if (over.length) block.push(`Dagsbudget på ${money(Math.max(...over))} overstiger loftet på ${money(rules.maxDailyBudgetPerCampaign)} pr. kampagne.`);
  }
  if (rules.maxCpcBid !== null) {
    const over = (plan.newBids ?? []).filter((b) => b > rules.maxCpcBid!);
    if (over.length) block.push(`Bud på ${money(Math.max(...over))} overstiger det maksimale CPC-bud på ${money(rules.maxCpcBid)}.`);
  }
  if (rules.maxTotalDailyBudget !== null && plan.dailyBudgetDelta > 0 && ctx.totalActiveDailyBudget !== null) {
    const after = ctx.totalActiveDailyBudget + plan.dailyBudgetDelta;
    if (after > rules.maxTotalDailyBudget) {
      block.push(`Samlet dagsbudget ville blive ${money(after)}, hvilket overstiger loftet på ${money(rules.maxTotalDailyBudget)}.`);
    }
  }

  if (plan.kind === 'raw') approve.push('Direkte API-ændringer kræver altid godkendelse.');
  if (rules.approvalMode === 'all') approve.push('Alle ændringer kræver din godkendelse (Forbrug → Godkendelse).');
  if (rules.approvalMode === 'spend' && (plan.increasesSpend || plan.kind === 'create' || plan.kind === 'delete')) {
    approve.push(plan.kind === 'delete' ? 'Sletning kræver godkendelse.' : 'Ændringen kan øge forbruget.');
  }
  if (rules.maxBudgetIncreasePct !== null && (plan.maxBudgetIncrease ?? 0) * 100 > rules.maxBudgetIncreasePct) {
    approve.push(`Budgetstigning på ${Math.round((plan.maxBudgetIncrease ?? 0) * 100)} % er over grænsen på ${rules.maxBudgetIncreasePct} %.`);
  }
  if (rules.monthlyBudget !== null && plan.dailyBudgetDelta > 0 && ctx.totalActiveDailyBudget !== null && ctx.monthToDateSpend !== null) {
    const projected = ctx.monthToDateSpend + (ctx.totalActiveDailyBudget + plan.dailyBudgetDelta) * ctx.daysLeftInMonth;
    if (projected > rules.monthlyBudget) {
      approve.push(`Prognosen for måneden bliver op til ${money(projected)} – over månedsbudgettet på ${money(rules.monthlyBudget)}.`);
    }
  }

  if (block.length) return { verdict: 'block', reasons: block };
  if (approve.length) return { verdict: 'approve', reasons: [...new Set(approve)] };
  return { verdict: 'allow', reasons: [] };
}
