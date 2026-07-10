// @ts-nocheck

import { endOfMonth, format } from "date-fns"
import {
  guessCategory,
  genId,
  convertToDisplay,
  PNL_VIEW_MODES,
  EXPENSE_NOTE_AMORTIZED,
  EXPENSE_NOTE_ANNUAL_INVOICE,
  resolveRecurringGroupId,
} from "@/lib/data/store"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const SKIP_ROW_PATTERNS = [
  /^total$/i,
  /^total registers$/i,
  /^total show up$/i,
  /^total cash collection$/i,
  /^cost %$/i,
  /^tech cost per lead$/i,
  /^cost per show up$/i,
  /^software cost$/i,
  /^project cost$/i,
  /^total expenses$/i,
]

const CREDIT_RELOAD_PATTERNS = [/as credits?/i]

/**
 * Parse a single CSV line respecting quoted fields with newlines.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === "\"" && next === "\"") {
        field += "\""
        i++
      } else if (ch === "\"") {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === "\"") {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field)
      field = ""
      if (row.some((c) => c.trim() !== "")) rows.push(row)
      row = []
      if (ch === "\r") i++
    } else if (ch !== "\r") {
      field += ch
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.trim() !== "")) rows.push(row)
  }

  return rows
}

/**
 * @param {string} raw
 * @returns {number|null}
 */
export function parseRmAmount(raw) {
  if (!raw || typeof raw !== "string") return null
  const cleaned = raw.trim().replace(/^RM\s*/i, "").replace(/,/g, "").trim()
  if (!cleaned || cleaned === "-" || cleaned === "—") return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Split multi-line cell into separate expense line items.
 * @param {string} rawLabel
 * @returns {{ name: string, notes: string }[]}
 */
export function splitExpenseLabel(rawLabel) {
  const lines = rawLabel
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length <= 1) {
    return [{ name: lines[0] || rawLabel.trim(), notes: "" }]
  }

  const parent = lines[0].replace(/:$/, "").trim()
  const bullets = lines.slice(1).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean)

  if (bullets.length === 0) {
    return [{ name: parent, notes: lines.slice(1).join("; ") }]
  }

  return bullets.map((bullet) => ({
    name: `${parent} - ${bullet}`,
    notes: "",
  }))
}

function shouldSkipRow(label) {
  const t = label.trim()
  if (!t) return true
  return SKIP_ROW_PATTERNS.some((p) => p.test(t))
}

function isProjectHeader(label, monthValues) {
  const t = label.trim()
  if (!t || shouldSkipRow(t)) return false
  const hasAmount = monthValues.some((v) => v !== null)
  if (hasAmount) return false
  if (/^(mac|antigravity)$/i.test(t)) return false
  return true
}

function linesFirst(rawLabel) {
  return rawLabel.split("\n")[0]?.trim() || rawLabel
}

function detectExpenseType(name) {
  if (CREDIT_RELOAD_PATTERNS.some((p) => p.test(name))) return "credit-reload"
  if (/^mac$/i.test(linesFirst(name))) return "one-time"
  if (/automatic sales|automate plan/i.test(name)) return "subscription"
  if (/^domain$/i.test(linesFirst(name))) return "subscription"
  return "subscription"
}

function lastDayOfMonth(year, monthIndex) {
  const d = endOfMonth(new Date(year, monthIndex, 1))
  return format(d, "yyyy-MM-dd")
}

function isStableRecurring(monthAmounts) {
  const values = monthAmounts.filter((v) => v !== null)
  if (values.length < 2) return false
  const first = values[0]
  return values.every((v) => Math.abs(v - first) < 0.01)
}

/**
 * Parse wide-format P&L mastersheet CSV into importable rows.
 * @param {string} csvText
 * @returns {{ year: number, rows: object[], warnings: string[], skipped: number }}
 */
export function parseMastersheetCsv(csvText) {
  const rawRows = parseCsvRows(csvText)
  const warnings = []
  let skipped = 0

  if (rawRows.length < 2) {
    return { year: new Date().getFullYear(), rows: [], warnings: ["File is empty or not a valid mastersheet."], skipped: 0 }
  }

  let year = new Date().getFullYear()
  // Year may be in col 0 ("PROJECT COST 2026") or col 1 ("PROJECT COST", "2026")
  const titleYear = rawRows[0].map((c) => (c || "").match(/(\d{4})/)).find(Boolean)
  if (titleYear) year = parseInt(titleYear[1], 10)

  const headerRow = rawRows[1]
  const monthCols = []
  for (let c = 1; c < headerRow.length; c++) {
    const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === (headerRow[c] || "").trim().toLowerCase())
    if (idx >= 0) monthCols.push({ col: c, monthIndex: idx })
  }

  if (monthCols.length === 0) {
    return { year, rows: [], warnings: ["Could not find month columns (January–December)."], skipped: 0 }
  }

  let currentProject = null
  let inSoftwareSection = false
  const parsedRows = []

  for (let r = 2; r < rawRows.length; r++) {
    const cells = rawRows[r]
    const label = (cells[0] || "").trim()

    const monthAmounts = monthCols.map(({ col }) => parseRmAmount(cells[col] || ""))

    if (/^software cost$/i.test(label)) {
      inSoftwareSection = true
      currentProject = null
      skipped++
      continue
    }

    if (isProjectHeader(label, monthAmounts)) {
      currentProject = label
      inSoftwareSection = false
      skipped++
      continue
    }

    if (shouldSkipRow(label)) {
      skipped++
      continue
    }

    const project = inSoftwareSection || currentProject === null ? null : currentProject
    const expenseType = detectExpenseType(label)
    const lineItems = splitExpenseLabel(label)

    const hasAnyAmount = monthAmounts.some((v) => v !== null)
    if (!hasAnyAmount && /^mac$/i.test(label.trim())) {
      parsedRows.push({
        id: genId("imp"),
        name: "Mac",
        category: guessCategory("Mac") || "Other",
        project,
        expenseType: "one-time",
        currency: "MYR",
        amounts: monthCols.map(() => null),
        monthCols,
        year,
        notes: "One-time cost — set amount and date when purchased",
        selected: true,
        recurring: false,
        warning: "No amounts in CSV — add purchase date & amount after import",
      })
      continue
    }

    if (!hasAnyAmount) {
      skipped++
      continue
    }

    const stable = expenseType === "subscription" && isStableRecurring(monthAmounts)

    for (let li = 0; li < lineItems.length; li++) {
      const item = lineItems[li]
      const isAddon = lineItems.length > 1 && li > 0

      if (isAddon) {
        parsedRows.push({
          id: genId("imp"),
          name: item.name,
          category: guessCategory(item.name) || guessCategory(label) || "Other",
          project,
          expenseType: "subscription",
          currency: "MYR",
          amounts: monthCols.map(() => null),
          monthCols,
          year,
          notes: `Split from "${linesFirst(label)}" — set monthly amount`,
          selected: true,
          recurring: stable,
          warning: "Add-on line — enter monthly amount in preview",
        })
        continue
      }

      parsedRows.push({
        id: genId("imp"),
        name: item.name,
        category: guessCategory(item.name) || guessCategory(label) || "Other",
        project,
        expenseType,
        currency: "MYR",
        amounts: monthAmounts,
        monthCols,
        year,
        notes: item.notes || (lineItems.length === 1 && label.includes("\n") ? label.split("\n").slice(1).join("; ") : ""),
        selected: true,
        recurring: stable && expenseType === "subscription",
        warning: expenseType === "credit-reload" ? "Credit reload — each month is a top-up, not usage burn" : null,
      })
    }
  }

  return { year, rows: parsedRows, warnings, skipped }
}

/**
 * Convert parsed preview rows into app expenses + recurring templates.
 * @param {object[]} previewRows
 * @param {{ billingDay: string }} options - 'last' | 'actual' (import uses last)
 */
export function previewRowsToImportPayload(previewRows, options = {}) {
  const expenses = []
  const recurring = []
  const billingMode = options.billingDay || "last"

  for (const row of previewRows) {
    if (!row.selected) continue

    let recurringId = null

    if (row.recurring) {
      const activeAmounts = row.amounts.filter((a) => a !== null)
      const amount = activeAmounts[0] ?? 0
      if (amount > 0) {
        recurringId = genId("r")
        const firstMonthIdx = row.amounts.findIndex((a) => a !== null)
        // Billing day = last day of a mid-year month as a proxy for "last day of month"
        const sampleMonth = firstMonthIdx >= 0 ? firstMonthIdx : 0
        const lastDay = parseInt(lastDayOfMonth(row.year, sampleMonth).slice(8, 10), 10)
        recurring.push({
          id: recurringId,
          name: row.name,
          category: row.category,
          amount,
          currency: row.currency,
          project: row.project,
          billingDay: billingMode === "last" ? lastDay : 1,
          billingMonth: 1,
          frequency: "monthly",
          active: true,
          notes: row.notes || "",
          endDate: null,
        })
      }
    }

    row.amounts.forEach((amount, i) => {
      if (amount === null || amount <= 0) return
      const { monthIndex } = row.monthCols[i]
      const date =
        billingMode === "last"
          ? lastDayOfMonth(row.year, monthIndex)
          : format(new Date(row.year, monthIndex, 1), "yyyy-MM-dd")

      const expenseType = row.recurring
        ? "subscription"
        : (row.expenseType || "one-time")

      expenses.push({
        id: genId("e"),
        name: row.name,
        category: row.category,
        amount,
        currency: row.currency,
        date,
        project: row.project,
        expenseType,
        recurringId: row.recurring ? recurringId : null,
        notes: row.notes || "",
      })
    })
  }

  return { expenses, recurring }
}

/**
 * Summarize selected preview rows for the import confirmation UI.
 * @param {object[]} previewRows
 */
export function summarizeImportPreview(previewRows) {
  const selected = previewRows.filter((r) => r.selected)
  let expenseCount = 0
  let recurringCount = 0
  let creditReloadCount = 0
  let oneTimeCount = 0
  const byProject = {}

  for (const row of selected) {
    const filled = row.amounts.filter((a) => a !== null && a > 0).length
    expenseCount += filled
    if (row.recurring) recurringCount++
    if (row.expenseType === "credit-reload") creditReloadCount++
    if (row.expenseType === "one-time") oneTimeCount++
    const key = row.project || "Company-wide"
    if (!byProject[key]) byProject[key] = { lineItems: 0, expenses: 0 }
    byProject[key].lineItems++
    byProject[key].expenses += filled
  }

  return { expenseCount, recurringCount, creditReloadCount, oneTimeCount, byProject, lineItemCount: selected.length }
}

function filterExpensesForPnlView(expenses, viewMode, recurring = [], currencySettings) {
  const yearlyById = new Map(
    recurring
      .filter((r) => (r.frequency || "monthly") === "yearly" && Number(r.amount) > 0)
      .map((r) => [r.id, r])
  )
  return expenses.filter((e) => {
    const notes = e.notes || ""
    const rid = e.recurringId || e.recurring_id
    if (viewMode === PNL_VIEW_MODES.AMORTIZED) {
      if (notes.includes(EXPENSE_NOTE_ANNUAL_INVOICE)) return false
      // Exclude any full-year charge tied to a yearly subscription (cash belongs in cash view only)
      const yr = rid ? yearlyById.get(rid) : null
      if (yr && Number(e.amount) >= Number(yr.amount) * 0.99) return false
      return true
    }
    if (e._pnlVirtual) return false
    return !notes.includes(EXPENSE_NOTE_AMORTIZED)
  })
}

/**
 * Fill missing months for active monthly subscriptions (e.g. Vercel/WABA imported with only one month).
 * Sparse coverage (≤3 months in year) fills the full year; otherwise only gaps between first/last charge.
 */
function expandMonthlyRecurringVirtual(recurring, year, currencySettings, expensesInYear) {
  const virtual = []

  for (const r of recurring) {
    if (!r.active || (r.frequency || "monthly") !== "monthly") continue
    if (!r.amount || Number(r.amount) <= 0) continue

    const endDate = r.endDate || r.end_date
    const billingDay = r.billingDay || r.billing_day || 1
    const recExpenses = expensesInYear.filter(
      (e) => (e.recurringId === r.id || e.recurring_id === r.id) && !e._pnlVirtual
    )
    const monthsWithData = new Set(recExpenses.map((e) => e.date?.slice(0, 7)).filter(Boolean))
    const count = monthsWithData.size
    const fillAllYear = count <= 3

    let minMi = 0
    let maxMi = 11
    if (!fillAllYear && count > 0) {
      const monthIndices = [...monthsWithData].map((ym) => parseInt(ym.slice(5, 7), 10) - 1)
      minMi = Math.min(...monthIndices)
      maxMi = Math.max(...monthIndices)
      // Project active subs forward through year-end after the last actual charge
      if (!endDate) maxMi = 11
    }

    for (let mi = 0; mi < 12; mi++) {
      if (!fillAllYear && mi < minMi) continue
      if (!fillAllYear && mi > maxMi) continue

      const ym = `${year}-${String(mi + 1).padStart(2, "0")}`
      if (endDate && endDate < `${ym}-01`) continue

      const hasActual = monthsWithData.has(ym)
      if (hasActual) continue

      const monthlyDisplay = convertToDisplay(Number(r.amount), r.currency, currencySettings)
      const day = Math.min(billingDay, 28)
      virtual.push({
        id: `virtual_monthly_${r.id}_${year}_${mi}`,
        name: r.name,
        category: r.category,
        amount: monthlyDisplay,
        currency: currencySettings.display,
        date: format(new Date(year, mi, day), "yyyy-MM-dd"),
        project: r.project || null,
        expenseType: "subscription",
        recurringId: r.id,
        notes: "",
        _pnlVirtual: true,
      })
    }
  }
  return virtual
}

/**
 * Spread active yearly subscriptions monthly when no amortized rows exist for that year.
 */
function expandYearlyRecurringAmortized(recurring, year, currencySettings, expensesInYear) {
  const virtual = []
  for (const r of recurring) {
    if (!r.active || (r.frequency || "monthly") !== "yearly") continue
    if (!r.amount || Number(r.amount) <= 0) continue
    const hasAmortized = expensesInYear.some(
      (e) => (e.recurringId === r.id || e.recurring_id === r.id)
        && (e.notes || "").includes(EXPENSE_NOTE_AMORTIZED)
    )
    if (hasAmortized) continue
    const monthlyDisplay = convertToDisplay(Number(r.amount) / 12, r.currency, currencySettings)
    const billingMi = (r.billingMonth || 1) - 1
    for (let mi = billingMi; mi < 12; mi++) {
      virtual.push({
        id: `virtual_${r.id}_${year}_${mi}`,
        name: r.name,
        category: r.category,
        amount: monthlyDisplay,
        currency: currencySettings.display,
        date: format(new Date(year, mi, 28), "yyyy-MM-dd"),
        project: r.project || null,
        expenseType: "subscription",
        recurringId: r.id,
        notes: EXPENSE_NOTE_AMORTIZED,
        _pnlVirtual: true,
      })
    }
  }
  return virtual
}

/**
 * Build P&L grid data from expenses for the report view.
 * @param {object} [options]
 * @param {'amortized'|'cash'} [options.viewMode]
 * @param {object[]} [options.recurring]
 */
export function buildPnlGrid(expenses, projects, year, currencySettings, options = {}) {
  const viewMode = options.viewMode || PNL_VIEW_MODES.AMORTIZED
  const recurring = options.recurring || []

  const yearExpenses = expenses.filter((e) => e.date?.startsWith(String(year)))
  let pnlExpenses = filterExpensesForPnlView(yearExpenses, viewMode, recurring, currencySettings)
  pnlExpenses = [
    ...pnlExpenses,
    ...expandMonthlyRecurringVirtual(recurring, year, currencySettings, yearExpenses),
  ]
  if (viewMode === PNL_VIEW_MODES.AMORTIZED) {
    pnlExpenses = [
      ...pnlExpenses,
      ...expandYearlyRecurringAmortized(recurring, year, currencySettings, pnlExpenses),
    ]
  }

  const months = MONTH_NAMES.map((_, i) => ({
    index: i,
    label: MONTH_NAMES[i].slice(0, 3),
    key: format(new Date(year, i, 1), "yyyy-MM"),
  }))

  const projectOrder = [
    ...projects.map((p) => p.name),
  ]

  const sections = []
  const sharedLabel = "Company-wide"

  const recurringList = recurring

  function pnlRowKey(e) {
    const rid = e.recurringId || e.recurring_id
    if (rid) return `rec:${rid}`
    const domainRec = recurringList.find(
      (r) => r.id.startsWith("r_domain_") && !r.id.startsWith("r_domains_") && r.name === e.name
    )
    if (domainRec) return `rec:${domainRec.id}`
    return `name:${e.name}`
  }

  function pnlRowLabel(e) {
    const rid = e.recurringId || e.recurring_id
    if (rid) {
      const r = recurringList.find((x) => x.id === rid)
      if (r?.name) return r.name
    }
    return e.name
  }

  const PROJECT_DOMAIN_GROUP = {
    CAE: "r_domains_cae",
    "Dr Jasmine": "r_domains_drjasmine",
    Jeff: "r_domains_jeff",
  }

  function resolvePnlGroupId(recId) {
    const rec = recurringList.find((r) => r.id === recId)
    if (rec?.parentId) return resolveRecurringGroupId(recId, recurringList)
    if (recId.startsWith("r_domain_") && !recId.startsWith("r_domains_")) {
      if (rec?.project && PROJECT_DOMAIN_GROUP[rec.project]) return PROJECT_DOMAIN_GROUP[rec.project]
      if (!rec?.project) return "r_domains_company"
    }
    return resolveRecurringGroupId(recId, recurringList)
  }

  function domainGroupHeader(parentRec, groupId) {
    if (!groupId?.startsWith("r_domains_")) return parentRec?.name
    const childCount = recurringList.filter(
      (r) => r.parentId === groupId && r.active !== false && Number(r.amount) > 0
    ).length
    return `Domains (${childCount})`
  }

  function organizePnlRows(rows) {
    const entries = Object.entries(rows).map(([key, row]) => ({ key, ...row }))
    const groups = new Map()
    const ungroupedRows = []

    for (const row of entries) {
      let recId = row.key.startsWith("rec:") ? row.key.slice(4) : null
      if (!recId && row.key.startsWith("name:")) {
        const rowName = row.key.slice(5)
        const domainRec = recurringList.find(
          (r) => r.id.startsWith("r_domain_") && !r.id.startsWith("r_domains_") && r.name === rowName
        )
        if (domainRec) recId = domainRec.id
      }
      if (!recId) {
        ungroupedRows.push(row)
        continue
      }
      const groupId = resolvePnlGroupId(recId)
      const isDomainChild = recId.startsWith("r_domain_") && !recId.startsWith("r_domains_")
      const hasChildren = isDomainChild
        || recurringList.some((r) => r.parentId === groupId && r.active !== false)
      const isAddon = recId !== groupId

      if (!hasChildren && !isAddon) {
        ungroupedRows.push(row)
        continue
      }

      // Domain group parents are placeholders — only show child domain rows
      if (recId === groupId && groupId.startsWith("r_domains_")) {
        continue
      }

      if (!groups.has(groupId)) {
        const parentRec = recurringList.find((r) => r.id === groupId)
        groups.set(groupId, {
          id: groupId,
          name: domainGroupHeader(parentRec, groupId) ?? row.name,
          months: months.map(() => 0),
          lines: [],
        })
      }
      const childRec = recurringList.find((r) => r.id === recId)
      const group = groups.get(groupId)
      group.lines.push({
        ...row,
        recId,
        isAddon: recId !== groupId,
        label: childRec?.name ?? row.name,
      })
      group.months = group.months.map((v, i) => v + row.months[i])
    }

    return {
      groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
      rows: ungroupedRows.sort((a, b) => a.name.localeCompare(b.name)),
    }
  }

  function addSection(projectName, projectExpenses) {
    const rows = {}
    for (const e of projectExpenses) {
      if (!e.date?.startsWith(String(year))) continue
      const key = pnlRowKey(e)
      if (!rows[key]) {
        rows[key] = {
          name: pnlRowLabel(e),
          months: months.map(() => 0),
          expenseType: e.expenseType || (e.recurringId || e.recurring_id ? "subscription" : "one-time"),
        }
      }
      const m = parseInt(e.date.slice(5, 7), 10) - 1
      if (m >= 0 && m < 12) {
        const value = e._pnlVirtual
          ? e.amount
          : convertToDisplay(e.amount, e.currency, currencySettings)
        rows[key].months[m] += value
      }
    }

    const { groups, rows: rowList } = organizePnlRows(rows)
    const monthTotals = months.map((_, mi) =>
      groups.reduce((s, g) => s + g.months[mi], 0)
      + rowList.reduce((s, r) => s + r.months[mi], 0)
    )

    if (rowList.length > 0 || groups.length > 0) {
      sections.push({
        project: projectName,
        groups,
        rows: rowList,
        monthTotals,
        yearTotal: monthTotals.reduce((a, b) => a + b, 0),
      })
    }
  }

  const byProject = {}
  for (const e of pnlExpenses) {
    const p = e.project || sharedLabel
    if (!byProject[p]) byProject[p] = []
    byProject[p].push(e)
  }

  for (const pname of projectOrder) {
    if (byProject[pname]) addSection(pname, byProject[pname])
  }
  if (byProject[sharedLabel]) addSection(sharedLabel, byProject[sharedLabel])

  for (const [pname, pexp] of Object.entries(byProject)) {
    if (!projectOrder.includes(pname) && pname !== sharedLabel) {
      addSection(pname, pexp)
    }
  }

  const grandTotals = months.map((_, mi) =>
    sections.reduce((s, sec) => s + sec.monthTotals[mi], 0)
  )

  return {
    year,
    months,
    sections,
    grandTotals,
    grandYearTotal: grandTotals.reduce((a, b) => a + b, 0),
    viewMode,
  }
}

const PNL_ZERO_THRESHOLD = 0.005

/**
 * Slice a full P&L grid to a single month for vertical month view.
 * @param {ReturnType<typeof buildPnlGrid>} grid
 * @param {number} monthIndex - 0–11
 * @returns {{
 *   year: number,
 *   monthIndex: number,
 *   monthLabel: string,
 *   viewMode: string,
 *   grandTotal: number,
 *   prevMonthTotal: number|null,
 *   prevYear: number,
 *   prevMonthIndex: number,
 *   ytdTotal: number,
 *   sections: Array<{
 *     project: string,
 *     monthTotal: number,
 *     groups: Array<{ id: string, name: string, amount: number, lines: Array<{ label: string, amount: number, isAddon: boolean }> }>,
 *     rows: Array<{ name: string, amount: number }>,
 *   }>,
 * }}
 */
export function slicePnlMonth(grid, monthIndex) {
  const mi = Math.max(0, Math.min(11, monthIndex))
  const monthLabel = MONTH_NAMES[mi] || grid.months[mi]?.label || ""
  const grandTotal = grid.grandTotals[mi] ?? 0
  const ytdTotal = grid.grandTotals.slice(0, mi + 1).reduce((a, b) => a + b, 0)

  let prevMonthTotal = null
  let prevYear = grid.year
  let prevMonthIndex = mi - 1

  if (mi > 0) {
    prevMonthTotal = grid.grandTotals[mi - 1] ?? 0
  } else {
    prevYear = grid.year - 1
    prevMonthIndex = 11
  }

  const sections = []

  for (const section of grid.sections) {
    const groups = []

    for (const group of section.groups || []) {
      const lines = (group.lines || [])
        .map((line) => ({
          label: line.label,
          amount: line.months[mi] ?? 0,
          isAddon: !!line.isAddon,
        }))
        .filter((line) => line.amount > PNL_ZERO_THRESHOLD)

      const amount = lines.reduce((sum, line) => sum + line.amount, 0)
      if (amount > PNL_ZERO_THRESHOLD) {
        groups.push({ id: group.id, name: group.name, amount, lines })
      }
    }

    const rows = (section.rows || [])
      .map((row) => ({
        name: row.name,
        amount: row.months[mi] ?? 0,
      }))
      .filter((row) => row.amount > PNL_ZERO_THRESHOLD)

    const monthTotal = section.monthTotals[mi] ?? 0
    if (monthTotal > PNL_ZERO_THRESHOLD) {
      sections.push({
        project: section.project,
        monthTotal,
        groups,
        rows,
      })
    }
  }

  return {
    year: grid.year,
    monthIndex: mi,
    monthLabel,
    viewMode: grid.viewMode,
    grandTotal,
    prevMonthTotal,
    prevYear,
    prevMonthIndex,
    ytdTotal,
    sections,
  }
}
