"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Bot,
  CalendarDays,
  Coins,
  Cpu,
  Hash,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { LucideIcon } from "lucide-react";
import type { CurrencySettings } from "@/types";
import { convertToDisplay, fmtCurrency } from "@/lib/data/store";
import {
  fetchUsageSummary,
  type OpenAiUsageByApp,
  type OpenAiUsageByModel,
  type OpenAiUsageSummary,
} from "@/lib/data/openai-usage";

interface OpenAiUsageProps {
  currencySettings: CurrencySettings;
}

const MODEL_COLORS = [
  "#7c3aed",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
];

const QUICK_RANGES = [
  {
    label: "This month",
    getRange: () => ({
      from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last 3 mo",
    getRange: () => ({
      from: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"),
      to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last 6 mo",
    getRange: () => ({
      from: format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"),
      to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last 12 mo",
    getRange: () => ({
      from: format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd"),
      to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    }),
  },
];

function formatPeriodLabel(dateFrom: string, dateTo: string): string {
  const from = parseISO(dateFrom);
  const to = parseISO(dateTo);
  if (dateFrom.slice(0, 7) === dateTo.slice(0, 7)) {
    return format(from, "MMMM yyyy");
  }
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
}

function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function usdToDisplay(amountUsd: number, currencySettings: CurrencySettings): number {
  return convertToDisplay(amountUsd, "USD", currencySettings);
}

function calcTrendPercent(current: number, previous: number): number | undefined {
  if (previous <= 0) {
    return undefined;
  }
  return ((current - previous) / previous) * 100;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: number;
  iconColor: string;
}

function StatCard({ label, value, sub, icon: Icon, trend, iconColor }: StatCardProps) {
  return (
    <div className="card fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: `${iconColor}18` }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend >= 0 ? "text-red-500" : "text-green-500"
            }`}
            style={{
              background: trend >= 0 ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
            }}
          >
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="section-label mb-1">{label}</p>
      <p className="text-2xl font-bold gradient-text leading-tight">{value}</p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

interface CostTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  currencySettings: CurrencySettings;
}

function CostTooltip({ active, payload, label, currencySettings }: CostTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const usd = payload[0].value;
  const display = currencySettings.display;
  const displayAmount = usdToDisplay(usd, currencySettings);

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p className="font-bold" style={{ color: "var(--text-1)" }}>
        {fmtCurrency(usd, "USD")}
      </p>
      {display !== "USD" && (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
          ≈ {fmtCurrency(displayAmount, display)}
        </p>
      )}
    </div>
  );
}

interface PieTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { percent: number } }[];
  currencySettings: CurrencySettings;
}

function PieTooltip({ active, payload, currencySettings }: PieTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const usd = payload[0].value;
  const display = currencySettings.display;
  const displayAmount = usdToDisplay(usd, currencySettings);

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-3)" }}>
        {payload[0].name}
      </p>
      <p className="font-bold" style={{ color: "var(--text-1)" }}>
        {fmtCurrency(usd, "USD")}
      </p>
      {display !== "USD" && (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
          ≈ {fmtCurrency(displayAmount, display)}
        </p>
      )}
      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
        {payload[0].payload.percent}%
      </p>
    </div>
  );
}

function UsageEmptyState() {
  return (
    <div className="card fade-in py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: "var(--accent-dim)" }}
      >
        <Bot size={28} style={{ color: "var(--accent)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-1)" }}>
        No usage recorded yet
      </h3>
      <p className="text-sm max-w-md mx-auto mb-4" style={{ color: "var(--text-2)" }}>
        Internal apps can report OpenAI token usage after each API call. Events appear here once ingested.
      </p>
      <div
        className="text-xs max-w-lg mx-auto rounded-xl p-4 text-left font-mono"
        style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
      >
        POST /api/openai-usage
        <br />
        {"{ appId, model, promptTokens, completionTokens, totalTokens, occurredAt }"}
      </div>
    </div>
  );
}

export default function OpenAiUsage({ currencySettings }: OpenAiUsageProps) {
  const { display } = currencySettings;
  const defaultFrom = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
  const defaultTo = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [summary, setSummary] = useState<OpenAiUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchUsageSummary(dateFrom, dateTo);
      setSummary(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load usage summary";
      setError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  function applyRange(range: (typeof QUICK_RANGES)[number]) {
    const next = range.getRange();
    setDateFrom(next.from);
    setDateTo(next.to);
  }

  function isRangeActive(range: (typeof QUICK_RANGES)[number]): boolean {
    const next = range.getRange();
    return next.from === dateFrom && next.to === dateTo;
  }

  const periodLabel = formatPeriodLabel(dateFrom, dateTo);
  const totals = summary?.totals;
  const previous = summary?.previous_period;
  const hasData = (totals?.request_count ?? 0) > 0;

  const costTrend = useMemo(
    () => calcTrendPercent(totals?.total_cost_usd ?? 0, previous?.total_cost_usd ?? 0),
    [totals, previous]
  );

  const appChartData = useMemo(
    () =>
      (summary?.by_app ?? []).map((row: OpenAiUsageByApp) => ({
        name: row.app_name || row.app_id,
        cost_usd: row.cost_usd,
        tokens: row.tokens,
      })),
    [summary]
  );

  const modelChartData = useMemo(() => {
    const rows = summary?.by_model ?? [];
    const totalCost = rows.reduce((sum, row) => sum + row.cost_usd, 0);
    return rows.map((row: OpenAiUsageByModel) => ({
      name: row.model,
      value: row.cost_usd,
      percent: totalCost > 0 ? +((row.cost_usd / totalCost) * 100).toFixed(1) : 0,
    }));
  }, [summary]);

  const dailyChartData = useMemo(
    () =>
      (summary?.daily_trend ?? []).map((row) => ({
        label: format(parseISO(row.date), "MMM d"),
        cost_usd: row.cost_usd,
        tokens: row.tokens,
      })),
    [summary]
  );

  const estimatedCostDisplay = totals
    ? usdToDisplay(totals.total_cost_usd, currencySettings)
    : 0;

  if (loading && !summary) {
    return (
      <div className="card fade-in py-20 text-center text-sm" style={{ color: "var(--text-3)" }}>
        Loading AI usage…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card fade-in py-12 px-6 text-center">
        <p className="text-sm font-medium mb-2" style={{ color: "var(--text-1)" }}>
          Could not load AI usage
        </p>
        <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
          {error}
        </p>
        <button type="button" className="btn-primary text-xs" onClick={() => void loadSummary()}>
          Retry
        </button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-5 fade-in">
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_RANGES.map((range) => (
              <button
                key={range.label}
                type="button"
                className={`pill ${isRangeActive(range) ? "active" : ""}`}
                onClick={() => applyRange(range)}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays size={14} style={{ color: "var(--text-3)" }} />
            <input
              type="date"
              className="input w-auto text-xs"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              →
            </span>
            <input
              type="date"
              className="input w-auto text-xs"
              value={dateTo}
              min={dateFrom}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>
        <UsageEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_RANGES.map((range) => (
            <button
              key={range.label}
              type="button"
              className={`pill ${isRangeActive(range) ? "active" : ""}`}
              onClick={() => applyRange(range)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays size={14} style={{ color: "var(--text-3)" }} />
          <input
            type="date"
            className="input w-auto text-xs"
            value={dateFrom}
            max={dateTo}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            →
          </span>
          <input
            type="date"
            className="input w-auto text-xs"
            value={dateTo}
            min={dateFrom}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <span
            className="ml-auto text-xs px-2 py-1 rounded-lg font-medium"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            Estimates in USD
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Tokens"
          value={formatTokenCount(totals?.total_tokens ?? 0)}
          sub={periodLabel}
          icon={Cpu}
          iconColor="#7c3aed"
        />
        <StatCard
          label="Est. Cost"
          value={fmtCurrency(totals?.total_cost_usd ?? 0, "USD")}
          sub={
            display !== "USD"
              ? `≈ ${fmtCurrency(estimatedCostDisplay, display)} at ${display} rate`
              : "Server-computed from model pricing"
          }
          icon={Coins}
          trend={costTrend}
          iconColor="#22c55e"
        />
        <StatCard
          label="Requests"
          value={formatTokenCount(totals?.request_count ?? 0)}
          sub="OpenAI API calls in period"
          icon={Activity}
          iconColor="#3b82f6"
        />
        <StatCard
          label="Avg Tokens / Request"
          value={formatTokenCount(totals?.avg_tokens_per_request ?? 0)}
          sub={
            previous && previous.request_count > 0
              ? `Prior period avg: ${formatTokenCount(previous.avg_tokens_per_request)}`
              : "No prior-period baseline"
          }
          icon={Hash}
          iconColor="#f59e0b"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-1)" }}>
            Cost by App <span className="text-xs font-normal ml-1" style={{ color: "var(--text-3)" }}>(USD)</span>
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={appChartData} barSize={22} barCategoryGap="30%">
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(value: number) => fmtCurrency(value, "USD")}
              />
              <Tooltip
                content={<CostTooltip currencySettings={currencySettings} />}
                cursor={{ fill: "var(--surface-2)", radius: 6 }}
              />
              <Bar dataKey="cost_usd" radius={[6, 6, 2, 2]}>
                {appChartData.map((_, index) => (
                  <Cell key={index} fill={MODEL_COLORS[index % MODEL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-1)" }}>
            By Model
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>
            Estimated cost share (USD)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={modelChartData}
                cx="50%"
                cy="44%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {modelChartData.map((entry, index) => (
                  <Cell key={entry.name} fill={MODEL_COLORS[index % MODEL_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip currencySettings={currencySettings} />} />
              <Legend
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>{value}</span>
                )}
                iconSize={7}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-1)" }}>
          Daily Trend <span className="text-xs font-normal ml-1" style={{ color: "var(--text-3)" }}>(USD)</span>
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dailyChartData}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(value: number) => fmtCurrency(value, "USD")}
            />
            <Tooltip
              content={<CostTooltip currencySettings={currencySettings} />}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="cost_usd"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ r: 3, fill: "#7c3aed" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-1)" }}>
          Apps by Cost
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: "var(--text-3)" }}>
                <th className="pb-3 font-medium">App</th>
                <th className="pb-3 font-medium">App ID</th>
                <th className="pb-3 font-medium text-right">Tokens</th>
                <th className="pb-3 font-medium text-right">Est. Cost (USD)</th>
                {display !== "USD" && (
                  <th className="pb-3 font-medium text-right">Est. Cost ({display})</th>
                )}
                <th className="pb-3 font-medium text-right">Requests</th>
                <th className="pb-3 font-medium text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.by_app ?? []).map((row, index, rows) => (
                <tr
                  key={row.app_id}
                  className={index < rows.length - 1 ? "border-b" : ""}
                  style={{ borderColor: "var(--border-2)" }}
                >
                  <td className="py-3 font-medium" style={{ color: "var(--text-1)" }}>
                    {row.app_name}
                  </td>
                  <td className="py-3 font-mono text-xs" style={{ color: "var(--text-3)" }}>
                    {row.app_id}
                  </td>
                  <td className="py-3 text-right tabular-nums" style={{ color: "var(--text-1)" }}>
                    {formatTokenCount(row.tokens)}
                  </td>
                  <td className="py-3 text-right tabular-nums font-semibold" style={{ color: "var(--text-1)" }}>
                    {fmtCurrency(row.cost_usd, "USD")}
                  </td>
                  {display !== "USD" && (
                    <td className="py-3 text-right tabular-nums" style={{ color: "var(--text-2)" }}>
                      {fmtCurrency(usdToDisplay(row.cost_usd, currencySettings), display)}
                    </td>
                  )}
                  <td className="py-3 text-right tabular-nums" style={{ color: "var(--text-2)" }}>
                    {formatTokenCount(row.request_count)}
                  </td>
                  <td className="py-3 text-right tabular-nums" style={{ color: "var(--text-3)" }}>
                    {row.pct_of_total}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
