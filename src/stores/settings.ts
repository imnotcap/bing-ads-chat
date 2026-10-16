import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectorId } from '@/ai/connectors';
import type { Effort, ModelId, ModelInfo } from '@/ai/models';
import type { DatePreset } from '@/lib/format';

/** How changes proposed by the assistant are approved. */
export type ApprovalMode = 'all' | 'spend' | 'none';

export interface SpendRules {
  approvalMode: ApprovalMode;
  /** Total monthly ad budget for the account (account currency). */
  monthlyBudget: number | null;
  /** Warn when month-to-date spend passes this share of the monthly budget. */
  warnAtPct: number;
  /** Pause all active campaigns automatically when the monthly budget is used (while the app is open). */
  autoPauseAtMonthlyBudget: boolean;
  maxDailyBudgetPerCampaign: number | null;
  /** Sum of the daily budgets of all active campaigns. */
  maxTotalDailyBudget: number | null;
  /** Budget increases above this share always need approval, even in autopilot. */
  maxBudgetIncreasePct: number | null;
  maxCpcBid: number | null;
  allowCreateCampaigns: boolean;
  allowDelete: boolean;
  /** New campaigns and ad groups are always created paused. */
  newEntitiesPaused: boolean;
  /** Campaigns the assistant may never change. */
  protectedCampaignIds: string[];
}

export interface AiSettings {
  model: ModelId;
  effort: Effort;
  showThinking: boolean;
  /** Monthly cap for Claude API usage in USD; sending is blocked when reached. */
  monthlyAiBudgetUsd: number | null;
  usdToDkk: number;
  maxToolRounds: number;
  /** Models users may pick (set by the admin). Empty = all. */
  enabledModels: ModelId[];
  /** Gemini models added by the admin (with their prices). */
  customModels: ModelInfo[];
  /** Connectors switched on/off in the chat field. */
  connectors: Partial<Record<ConnectorId, boolean>>;
}

export interface BusinessProfile {
  companyName: string;
  website: string;
  description: string;
  targetCpa: number | null;
  targetRoas: number | null;
  grossMarginPct: number | null;
  toneOfVoice: string;
  instructions: string;
}

export interface Appearance {
  animations: 'system' | 'full' | 'reduced';
  clickSpark: boolean;
  insightsPanel: boolean;
  /** Which sections of the insights panel are expanded. */
  insightSections: Record<string, boolean>;
  sidebarCollapsed: boolean;
  /** Closing the window keeps the app running in the system tray. */
  closeToTray: boolean;
  /** Dashboard sidebar: collapsed categories. */
  navCollapsed: Record<string, boolean>;
  /** Dashboard sidebar: categories hidden with the eye (e.g. Paid for the SEO team). */
  navHidden: string[];
  /** Planning board cards: compact (text and icons) or detailed (description, checklist, people). */
  boardCards: 'simple' | 'detailed';
}

export const DEFAULT_SPEND_RULES: SpendRules = {
  approvalMode: 'spend',
  monthlyBudget: null,
  warnAtPct: 80,
  autoPauseAtMonthlyBudget: false,
  maxDailyBudgetPerCampaign: null,
  maxTotalDailyBudget: null,
  maxBudgetIncreasePct: 50,
  maxCpcBid: null,
  allowCreateCampaigns: true,
  allowDelete: false,
  newEntitiesPaused: true,
  protectedCampaignIds: [],
};

interface SettingsState {
  spend: SpendRules;
  ai: AiSettings;
  business: BusinessProfile;
  appearance: Appearance;
  datePreset: DatePreset;
  onboarded: boolean;
  setSpend: (patch: Partial<SpendRules>) => void;
  setAi: (patch: Partial<AiSettings>) => void;
  setBusiness: (patch: Partial<BusinessProfile>) => void;
  setAppearance: (patch: Partial<Appearance>) => void;
  setDatePreset: (p: DatePreset) => void;
  setOnboarded: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      spend: DEFAULT_SPEND_RULES,
      ai: { model: 'claude-opus-5-5', effort: 'medium', showThinking: true, monthlyAiBudgetUsd: 25, usdToDkk: 6.9, maxToolRounds: 30, enabledModels: [], customModels: [], connectors: {} },
      business: {
        companyName: '',
        website: '',
        description: '',
        targetCpa: null,
        targetRoas: null,
        grossMarginPct: null,
        toneOfVoice: '',
        instructions: '',
      },
      appearance: {
        animations: 'full',
        clickSpark: false,
        insightsPanel: true,
        insightSections: { kpis: true, budget: true, alerts: true, campaigns: false },
        sidebarCollapsed: false,
        closeToTray: true,
        navCollapsed: {},
        navHidden: [],
        boardCards: 'detailed',
      },
      datePreset: 'last30',
      onboarded: false,
      setSpend: (patch) => set((s) => ({ spend: { ...s.spend, ...patch } })),
      setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      setBusiness: (patch) => set((s) => ({ business: { ...s.business, ...patch } })),
      setAppearance: (patch) => set((s) => ({ appearance: { ...s.appearance, ...patch } })),
      setDatePreset: (datePreset) => set({ datePreset }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: 'bac.settings',
      version: 3,
      // v2: simpler design – click sparks are opt-in.
      // v3: the aurora background is gone, and animations no longer follow Windows by
      //     default (with Windows' animation effects off the orb and ASCII stood still).
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 2 && p.appearance) p.appearance = { ...p.appearance, clickSpark: false };
        if (version < 3 && p.appearance) {
          const { auroraBackground: _removed, ...appearance } = p.appearance as SettingsState['appearance'] & { auroraBackground?: boolean };
          p.appearance = { ...appearance, animations: appearance.animations === 'reduced' ? 'reduced' : 'full' };
        }
        return p as SettingsState;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          spend: { ...current.spend, ...p.spend },
          ai: { ...current.ai, ...p.ai },
          business: { ...current.business, ...p.business },
          appearance: { ...current.appearance, ...p.appearance },
        };
      },
    },
  ),
);
