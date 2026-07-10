import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  AppSettings,
  Category,
  CurrencySettings,
  Expense,
  Project,
  Recurring,
} from "@/types";

export { isSupabaseConfigured };

/** Singleton browser client; null when env vars are missing. */
export const supabase = createClient();

function getClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  return supabase;
}

interface DbRecurring {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  project: string | null;
  billing_day: number;
  billing_month: number | null;
  frequency: string | null;
  active: boolean;
  notes: string | null;
  end_date: string | null;
  parent_id: string | null;
  skipped_months: string[] | null;
}

interface DbExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  project: string | null;
  expense_type: string | null;
  recurring_id: string | null;
  notes: string | null;
}

interface DbSettings {
  company_name: string | null;
  tagline: string | null;
  theme: string | null;
}

interface SupabaseError {
  message?: string;
  code?: string;
}

type DataResult<T> = { data: T; error: SupabaseError | null };

// ── Auth ────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  const { data, error } = await getClient().auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  return getClient().auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await getClient().auth.getUser();
  return user;
}

// ── Helpers: DB (snake_case) <-> App (camelCase) ────────────────────

function recurringFromDB(r: DbRecurring): Recurring {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    amount: Number(r.amount),
    currency: r.currency,
    project: r.project || null,
    billingDay: r.billing_day,
    billingMonth: r.billing_month || 1,
    frequency: (r.frequency || "monthly") as Recurring["frequency"],
    active: r.active,
    notes: r.notes || "",
    endDate: r.end_date,
    parentId: r.parent_id || null,
    skippedMonths: Array.isArray(r.skipped_months) ? r.skipped_months : [],
  };
}

function recurringToDB(r: Recurring, userId: string) {
  return {
    id: r.id,
    user_id: userId,
    name: r.name,
    category: r.category,
    amount: Number(r.amount),
    currency: r.currency,
    project: r.project || null,
    billing_day: r.billingDay,
    billing_month: r.billingMonth || 1,
    frequency: r.frequency || "monthly",
    active: r.active,
    notes: r.notes || "",
    end_date: r.endDate || null,
    parent_id: r.parentId || null,
    skipped_months: r.skippedMonths || [],
  };
}

function expenseFromDB(e: DbExpense): Expense {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    amount: Number(e.amount),
    currency: e.currency,
    date: e.date,
    project: e.project || null,
    expenseType: (e.expense_type || null) as Expense["expenseType"],
    recurringId: e.recurring_id || null,
    notes: e.notes || "",
  };
}

// ── Expenses ────────────────────────────────────────────────────────

export async function loadExpenses(userId: string): Promise<DataResult<Expense[]>> {
  const { data, error } = await getClient()
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) console.error("loadExpenses:", error);
  return { data: (data || []).map((row) => expenseFromDB(row as DbExpense)), error };
}

export async function saveExpense(expense: Expense, userId: string) {
  const row = {
    id: expense.id,
    user_id: userId,
    name: expense.name,
    category: expense.category,
    amount: Number(expense.amount),
    currency: expense.currency,
    date: expense.date,
    project: expense.project || null,
    expense_type: expense.expenseType || (expense.recurringId ? "subscription" : "one-time"),
    recurring_id: expense.recurringId || expense.recurring_id || null,
    notes: expense.notes || "",
  };
  const { data, error } = await getClient().from("expenses").upsert([row], { onConflict: "id" });
  if (error) console.error("saveExpense:", error);
  return { data, error };
}

export async function deleteExpense(id: string) {
  const { error } = await getClient().from("expenses").delete().eq("id", id);
  if (error) {
    console.error("deleteExpense:", error);
    return { error };
  }
  return { error: null };
}

export async function deleteExpensesByRecurringId(recurringId: string) {
  const { error } = await getClient().from("expenses").delete().eq("recurring_id", recurringId);
  if (error) {
    console.error("deleteExpensesByRecurringId:", error);
    return { error };
  }
  return { error: null };
}

// ── Recurring ───────────────────────────────────────────────────────

export async function loadRecurring(userId: string): Promise<DataResult<Recurring[]>> {
  const { data, error } = await getClient()
    .from("recurring")
    .select("*")
    .eq("user_id", userId);
  if (error) console.error("loadRecurring:", error);
  return { data: (data || []).map((row) => recurringFromDB(row as DbRecurring)), error };
}

export async function saveOneRecurring(item: Recurring, userId: string) {
  const row = recurringToDB(item, userId);
  const { data, error } = await getClient().from("recurring").upsert([row], { onConflict: "id" });
  if (error) console.error("saveOneRecurring:", error);
  return { data, error };
}

export async function deleteRecurring(id: string) {
  const { error } = await getClient().from("recurring").delete().eq("id", id);
  if (error) {
    console.error("deleteRecurring:", error);
    return { error };
  }
  return { error: null };
}

// ── Settings ────────────────────────────────────────────────────────

function settingsFromDB(s: DbSettings | null): AppSettings | null {
  if (!s) return null;
  return {
    companyName: s.company_name || "Company Costs",
    tagline: s.tagline || "Cost tracking dashboard",
    theme: (s.theme === "dark" ? "dark" : "light"),
  };
}

export async function loadSettings(userId: string): Promise<DataResult<AppSettings | null>> {
  const { data, error } = await getClient().from("settings").select("*").eq("user_id", userId).single();
  if (error && error.code !== "PGRST116") console.error("loadSettings:", error);
  return {
    data: settingsFromDB(data as DbSettings | null),
    error: error?.code === "PGRST116" ? null : error,
  };
}

export async function saveSettings(settings: AppSettings, userId: string) {
  const row = {
    id: `settings_${userId}`,
    user_id: userId,
    company_name: settings.companyName || "Company Costs",
    tagline: settings.tagline || "Cost tracking dashboard",
    theme: settings.theme || "light",
  };
  const { data, error } = await getClient().from("settings").upsert([row], { onConflict: "user_id" });
  if (error) console.error("saveSettings:", error);
  return { data, error };
}

// ── Categories ──────────────────────────────────────────────────────

export async function loadCategories(userId: string): Promise<DataResult<Category[]>> {
  const { data, error } = await getClient().from("categories").select("*").eq("user_id", userId);
  if (error) console.error("loadCategories:", error);
  return { data: (data || []) as Category[], error };
}

export async function saveCategories(categories: Category[], userId: string) {
  const { error: delErr } = await getClient().from("categories").delete().eq("user_id", userId);
  if (delErr) {
    console.error("saveCategories delete:", delErr);
    return { error: delErr };
  }
  if (categories.length === 0) return { error: null };
  const rows = categories.map((c) => ({
    id: c.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    name: c.name,
    color: c.color,
  }));
  const { data, error } = await getClient().from("categories").insert(rows);
  if (error) console.error("saveCategories insert:", error);
  return { data, error };
}

// ── Currency Settings ───────────────────────────────────────────────

export async function loadCurrencySettings(userId: string): Promise<DataResult<CurrencySettings | null>> {
  const { data, error } = await getClient()
    .from("currency_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") console.error("loadCurrencySettings:", error);
  const mapped = data
    ? {
        display: (data as { display_currency?: string }).display_currency || "MYR",
        rates: ((data as { rates?: Record<string, number> }).rates) || {},
      }
    : null;
  return { data: mapped, error: error?.code === "PGRST116" ? null : error };
}

export async function saveCurrencySettings(settings: CurrencySettings, userId: string) {
  const row = {
    id: `currency_${userId}`,
    user_id: userId,
    display_currency: settings.display || "MYR",
    rates: settings.rates || {},
  };
  const { data, error } = await getClient().from("currency_settings").upsert([row], { onConflict: "user_id" });
  if (error) console.error("saveCurrencySettings:", error);
  return { data, error };
}

// ── Projects ────────────────────────────────────────────────────────

export async function loadProjects(userId: string): Promise<DataResult<Project[]>> {
  const { data, error } = await getClient().from("projects").select("*").eq("user_id", userId);
  if (error) {
    console.error("loadProjects:", error);
    return { data: [], error };
  }
  return { data: (data || []) as Project[], error: null };
}

export async function saveProjects(projects: Project[], userId: string) {
  const { error: delErr } = await getClient().from("projects").delete().eq("user_id", userId);
  if (delErr) {
    console.error("saveProjects delete:", delErr);
    return { error: delErr };
  }
  if (projects.length === 0) return { error: null };
  const rows = projects.map((p) => ({
    id: p.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    name: p.name,
    color: p.color,
  }));
  const { data, error } = await getClient().from("projects").insert(rows);
  if (error) console.error("saveProjects insert:", error);
  return { data, error };
}

export async function saveExpensesBatch(expenses: Expense[], userId: string) {
  if (!expenses.length) return { error: null };
  const rows = expenses.map((expense) => ({
    id: expense.id,
    user_id: userId,
    name: expense.name,
    category: expense.category,
    amount: Number(expense.amount),
    currency: expense.currency,
    date: expense.date,
    project: expense.project || null,
    expense_type: expense.expenseType || (expense.recurringId ? "subscription" : "one-time"),
    recurring_id: expense.recurringId || null,
    notes: expense.notes || "",
  }));
  const { error } = await getClient().from("expenses").upsert(rows, { onConflict: "id" });
  if (error) console.error("saveExpensesBatch:", error);
  return { error };
}

export async function saveRecurringBatch(items: Recurring[], userId: string) {
  if (!items.length) return { error: null };
  const rows = items.map((r) => recurringToDB(r, userId));
  const { error } = await getClient().from("recurring").upsert(rows, { onConflict: "id" });
  if (error) console.error("saveRecurringBatch:", error);
  return { error };
}

export async function deleteAllUserExpenses(userId: string) {
  const { error } = await getClient().from("expenses").delete().eq("user_id", userId);
  if (error) console.error("deleteAllUserExpenses:", error);
  return { error };
}

export async function deleteAllUserRecurring(userId: string) {
  const { error } = await getClient().from("recurring").delete().eq("user_id", userId);
  if (error) console.error("deleteAllUserRecurring:", error);
  return { error };
}
