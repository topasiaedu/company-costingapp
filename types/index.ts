/** App branding settings stored in Supabase `settings` table. */
export interface AppSettings {
  companyName: string;
  tagline: string;
  theme: "light" | "dark";
}

export type ExpenseType = "subscription" | "one-time" | "credit-reload";

export type RecurringFrequency = "monthly" | "yearly";

export type BillingStatus =
  | "billed"
  | "due"
  | "skipped"
  | "not-due"
  | "paused";

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  project: string | null;
  expenseType: ExpenseType | null;
  recurringId: string | null;
  notes: string;
  /** P&L virtual row flag (not persisted). */
  _pnlVirtual?: boolean;
  /** Legacy snake_case from DB reads. */
  recurring_id?: string | null;
}

export interface Recurring {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  project: string | null;
  billingDay: number;
  billingMonth: number;
  frequency: RecurringFrequency;
  active: boolean;
  notes: string;
  endDate: string | null;
  parentId: string | null;
  skippedMonths: string[];
  /** Visual-only domain group marker. */
  _isDomainGroup?: boolean;
}

export interface Category {
  id?: string;
  name: string;
  color: string;
}

export interface Project {
  id?: string;
  name: string;
  color: string;
}

export interface CurrencySettings {
  display: string;
  rates: Record<string, number>;
}

export interface ExpenseSavePayload extends Expense {
  isRecurring?: boolean;
  frequency?: RecurringFrequency | null;
  billingDay?: number | null;
  billingMonth?: number | null;
  endDate?: string | null;
}

export interface ImportPayload {
  expenses: Expense[];
  recurring: Recurring[];
  mode: "append" | "replace";
  year?: number;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface MonthCol {
  col: number;
  monthIndex: number;
}

export interface ImportPreviewRow {
  id: string;
  name: string;
  category: string;
  project: string | null;
  expenseType: ExpenseType;
  currency: string;
  amounts: (number | null)[];
  monthCols: MonthCol[];
  year: number;
  notes: string;
  selected: boolean;
  recurring: boolean;
  warning: string | null;
}

/** OpenAI token usage event stored in `openai_usage_events`. */
export interface OpenAiUsageEvent {
  id: string;
  appId: string;
  appName: string | null;
  requestId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  feature: string | null;
  occurredAt: string;
  estimatedCostUsd: number;
  priceSnapshot: string | null;
  ingestedAt: string;
}
