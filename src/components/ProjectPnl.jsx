import { useMemo, useState, useRef, Fragment, useEffect } from "react"
import { format } from "date-fns"
import { Download, Camera, ChevronLeft, ChevronRight, ChevronDown, Upload, Plus, X } from "lucide-react"
import { buildPnlGrid } from "../data/parseMastersheetCsv"
import { fmtAmount, getProjectColor, PNL_VIEW_MODES } from "../data/store"

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/**
 * Export P&L as wide-format CSV similar to the original mastersheet.
 * @param {ReturnType<typeof buildPnlGrid>} grid
 * @param {string} display - display currency code (for filename and header note)
 */
export function exportPnlCsv(grid, display = "MYR") {
  const monthHeaders = FULL_MONTHS
  const fmtCsvAmount = (v) => (v > 0.005 ? v.toFixed(2) : "")
  const lines = [
    `PROJECT COST,${grid.year} (Amounts in ${display})`,
    `,${monthHeaders.join(",")},Total`,
  ]

  for (const section of grid.sections) {
    lines.push(`${section.project}${",".repeat(13)}`)
    for (const group of section.groups || []) {
      const cells = group.months.map(fmtCsvAmount)
      const total = group.months.reduce((a, b) => a + b, 0)
      const safeName = group.name.includes(",") ? `"${group.name.replace(/"/g, '""')}"` : group.name
      lines.push(`${safeName},${cells.join(",")},${fmtCsvAmount(total)}`)
    }
    for (const row of section.rows) {
      const cells = row.months.map(fmtCsvAmount)
      const total = row.months.reduce((a, b) => a + b, 0)
      const safeName = row.name.includes(",") || row.name.includes('"')
        ? `"${row.name.replace(/"/g, '""')}"`
        : row.name
      lines.push(`${safeName},${cells.join(",")},${fmtCsvAmount(total)}`)
    }
    const totCells = section.monthTotals.map(fmtCsvAmount)
    lines.push(`TOTAL,${totCells.join(",")},${fmtCsvAmount(section.yearTotal)}`)
    lines.push("")
  }

  const grandCells = grid.grandTotals.map(fmtCsvAmount)
  lines.push(`Total Expenses,${grandCells.join(",")},${fmtCsvAmount(grid.grandYearTotal)}`)

  const csv = lines.join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `tech-pnl-${grid.year}-${display}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ProjectPnl({ expenses, recurring = [], projects, currencySettings, onImport, onAdd }) {
  const { display } = currencySettings
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [viewMode, setViewMode] = useState(PNL_VIEW_MODES.AMORTIZED)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [collapsedSections, setCollapsedSections] = useState({})
  const [screenshotMode, setScreenshotMode] = useState(false)
  const [screenshotHint, setScreenshotHint] = useState(false)
  const tableRef = useRef(null)
  const screenshotTimerRef = useRef(null)

  function enterScreenshotMode() {
    setScreenshotMode(true)
    setScreenshotHint(true)
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current)
    screenshotTimerRef.current = setTimeout(() => {
      setScreenshotMode(false)
      setScreenshotHint(false)
    }, 30000)
  }

  function exitScreenshotMode() {
    setScreenshotMode(false)
    setScreenshotHint(false)
    if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current)
  }

  useEffect(() => () => {
    if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current)
  }, [])

  const availableYears = useMemo(() => {
    const yrs = new Set(expenses.map((e) => e.date?.slice(0, 4)).filter(Boolean))
    yrs.add(String(currentYear))
    return [...yrs].sort((a, b) => Number(a) - Number(b))
  }, [expenses, currentYear])

  function toggleGroup(sectionProject, groupId) {
    const key = `${sectionProject}:${groupId}`
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function isGroupCollapsed(sectionProject, groupId) {
    const key = `${sectionProject}:${groupId}`
    // Collapsed by default so domain groups don't take up space
    return collapsedGroups[key] !== false
  }

  function toggleSection(project) {
    setCollapsedSections((prev) => ({ ...prev, [project]: !prev[project] }))
  }

  function isSectionCollapsed(project) {
    // Expanded by default — only collapse when user clicks
    return collapsedSections[project] === true
  }

  const grid = useMemo(
    () => buildPnlGrid(expenses, projects, year, currencySettings, { viewMode, recurring }),
    [expenses, projects, year, currencySettings, viewMode, recurring]
  )

  function changeYear(delta) {
    const idx = availableYears.indexOf(String(year))
    const next = availableYears[idx + delta]
    if (next) setYear(parseInt(next, 10))
  }

  const yearIdx = availableYears.indexOf(String(year))

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)

  return (
    <div
      className={`space-y-4 fade-in pnl-report-root${screenshotMode ? " pnl-screenshot-mode" : ""}`}
      ref={tableRef}
    >
      {screenshotHint && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium shadow-xl print:hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--accent)", color: "var(--text-1)" }}
        >
          <Camera size={14} style={{ color: "var(--accent)" }} />
          <span>
            {isMac
              ? "Press Cmd+Shift+4 (Mac) to capture this region."
              : "Use your OS screenshot tool to capture this view."}
          </span>
          <button type="button" className="btn-ghost p-1 rounded-lg" style={{ border: "none" }} onClick={exitScreenshotMode} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <div
        className="card p-3 print:hidden"
        style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-1)" }}>
              P&L view
            </span>
            <div
              className="inline-flex rounded-full p-0.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              role="group"
              aria-label="P&L view mode"
            >
              <button
                type="button"
                className={`pill ${viewMode === PNL_VIEW_MODES.AMORTIZED ? "active" : ""}`}
                style={{ margin: 0 }}
                onClick={() => setViewMode(PNL_VIEW_MODES.AMORTIZED)}
              >
                Monthly (amortized)
              </button>
              <button
                type="button"
                className={`pill ${viewMode === PNL_VIEW_MODES.CASH ? "active" : ""}`}
                style={{ margin: 0 }}
                onClick={() => setViewMode(PNL_VIEW_MODES.CASH)}
              >
                Cash (invoice date)
              </button>
            </div>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {viewMode === PNL_VIEW_MODES.AMORTIZED
                ? "Yearly costs spread evenly each month"
                : "Full charge in the month you paid"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost p-2"
                onClick={() => changeYear(-1)}
                disabled={yearIdx <= 0}
                aria-label="Previous year"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold min-w-[4rem] text-center" style={{ color: "var(--text-1)" }}>{year}</span>
              <button
                type="button"
                className="btn-ghost p-2"
                onClick={() => changeYear(1)}
                disabled={yearIdx < 0 || yearIdx >= availableYears.length - 1}
                aria-label="Next year"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {!screenshotMode && (
              <>
                <button type="button" className="btn-ghost text-xs gap-1.5" onClick={() => exportPnlCsv(grid, display)}>
                  <Download size={13} /> Export CSV
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs gap-1.5"
                  title="Hide toolbar and scroll report into frame for capture"
                  onClick={enterScreenshotMode}
                >
                  <Camera size={13} /> Ready to screenshot
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {grid.sections.length === 0 ? (
        <div className="card py-16 text-center px-6">
          <p className="text-sm mb-2" style={{ color: "var(--text-2)" }}>
            No expenses for {year}.
          </p>
          <p className="text-xs mb-6 max-w-md mx-auto" style={{ color: "var(--text-3)" }}>
            Import your mastersheet or add expenses to populate the P&amp;L grid.
            {!onImport && !onAdd && (
              <> Go to <strong style={{ color: "var(--text-2)" }}>Expenses → Import</strong> or{" "}
              <strong style={{ color: "var(--text-2)" }}>Settings → Import Mastersheet</strong>.</>
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onImport && (
              <button type="button" className="btn-primary text-xs gap-1.5" onClick={onImport}>
                <Upload size={13} /> Import Mastersheet
              </button>
            )}
            {onAdd && (
              <button type="button" className="btn-ghost text-xs gap-1.5" onClick={onAdd}>
                <Plus size={13} /> Add Expense
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="card p-0 overflow-x-auto pnl-table-wrap"
          id="pnl-report"
          style={{ background: "var(--surface)" }}
        >
          <table className="w-full text-xs border-collapse pnl-table" style={{ minWidth: "960px" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "2px solid var(--border)" }}>
                <th
                  className="text-left px-3 py-2.5 font-semibold sticky left-0 z-20 min-w-[200px] pnl-sticky"
                  style={{ background: "var(--surface-2)", color: "var(--text-1)", boxShadow: "2px 0 0 var(--border)" }}
                >
                  PROJECT COST · {year}
                </th>
                {grid.months.map((m) => (
                  <th key={m.key} className="px-2 py-2.5 font-medium text-right min-w-[76px]" style={{ color: "var(--text-2)" }}>
                    {FULL_MONTHS[m.index]?.slice(0, 3) || m.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 font-semibold text-right min-w-[88px]" style={{ color: "var(--text-1)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {grid.sections.map((section) => {
                const sectionColor = getProjectColor(
                  section.project === "Company-wide" ? null : section.project,
                  projects
                )
                const sectionCollapsed = isSectionCollapsed(section.project)
                return (
                  <Fragment key={section.project}>
                    <tr style={{ background: `${sectionColor}22` }}>
                      <td
                        className="px-3 py-2 font-bold text-sm sticky left-0 z-10 pnl-sticky"
                        style={{
                          color: sectionColor,
                          background: `${sectionColor}22`,
                          boxShadow: sectionCollapsed ? "2px 0 0 var(--border)" : undefined,
                        }}
                        colSpan={sectionCollapsed ? undefined : grid.months.length + 2}
                      >
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-left w-full"
                          style={{ border: "none", background: "transparent", color: "inherit" }}
                          onClick={() => toggleSection(section.project)}
                        >
                          {sectionCollapsed
                            ? <ChevronRight size={14} style={{ color: sectionColor, flexShrink: 0 }} />
                            : <ChevronDown size={14} style={{ color: sectionColor, flexShrink: 0 }} />}
                          <span>{section.project}</span>
                        </button>
                      </td>
                      {sectionCollapsed && section.monthTotals.map((v, mi) => (
                        <td
                          key={mi}
                          className="px-2 py-2 text-right font-bold tabular-nums text-sm"
                          style={{ color: sectionColor, background: `${sectionColor}22` }}
                        >
                          {v > 0.005 ? fmtAmount(v) : ""}
                        </td>
                      ))}
                      {sectionCollapsed && (
                        <td
                          className="px-3 py-2 text-right font-bold tabular-nums text-sm"
                          style={{ color: sectionColor, background: `${sectionColor}22` }}
                        >
                          {section.yearTotal > 0.005 ? fmtAmount(section.yearTotal) : ""}
                        </td>
                      )}
                    </tr>
                    {!sectionCollapsed && section.groups?.map((group) => {
                      const collapsed = isGroupCollapsed(section.project, group.id)
                      const addonCount = group.lines.filter((l) => l.isAddon).length
                      const groupTotal = group.months.reduce((a, b) => a + b, 0)
                      return (
                        <Fragment key={`${section.project}-group-${group.id}`}>
                          <tr className="pnl-row">
                            <td
                              className="px-3 py-1.5 sticky left-0 z-10 font-medium pnl-sticky"
                              style={{
                                background: "var(--surface)",
                                color: "var(--text-1)",
                                borderBottom: "1px solid var(--border)",
                                boxShadow: "2px 0 0 var(--border)",
                              }}
                            >
                              <button
                                type="button"
                                className="flex items-center gap-1.5 text-left w-full"
                                style={{ border: "none", background: "transparent", color: "inherit" }}
                                onClick={() => toggleGroup(section.project, group.id)}
                              >
                                {collapsed
                                  ? <ChevronRight size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                                  : <ChevronDown size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                                <span>{group.name}</span>
                                {group.id.startsWith("r_domains_") ? (
                                  <span className="text-xs font-normal" style={{ color: "var(--text-3)" }}>
                                    {group.lines.length} domain{group.lines.length !== 1 ? "s" : ""}
                                  </span>
                                ) : addonCount > 0 ? (
                                  <span className="text-xs font-normal" style={{ color: "var(--text-3)" }}>
                                    +{addonCount} add-on{addonCount !== 1 ? "s" : ""}
                                  </span>
                                ) : null}
                              </button>
                            </td>
                            {group.months.map((v, mi) => (
                              <td
                                key={mi}
                                className="px-2 py-1.5 text-right tabular-nums font-medium"
                                style={{
                                  color: v > 0 ? "var(--text-1)" : "var(--text-3)",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {v > 0.005 ? fmtAmount(v) : ""}
                              </td>
                            ))}
                            <td
                              className="px-3 py-1.5 text-right font-semibold tabular-nums"
                              style={{ color: "var(--text-1)", borderBottom: "1px solid var(--border)" }}
                            >
                              {groupTotal > 0.005 ? fmtAmount(groupTotal) : ""}
                            </td>
                          </tr>
                          {!collapsed && group.lines.map((line) => {
                            const lineTotal = line.months.reduce((a, b) => a + b, 0)
                            return (
                              <tr key={`${section.project}-${group.id}-${line.recId}`} className="pnl-row">
                                <td
                                  className="px-3 py-1.5 sticky left-0 z-10 pnl-sticky"
                                  style={{
                                    background: "var(--surface-2)",
                                    color: "var(--text-2)",
                                    borderBottom: "1px solid var(--border)",
                                    boxShadow: "2px 0 0 var(--border)",
                                    paddingLeft: "2rem",
                                  }}
                                >
                                  <span className="text-xs">
                                    {line.isAddon ? "↳ " : ""}{line.label}
                                  </span>
                                </td>
                                {line.months.map((v, mi) => (
                                  <td
                                    key={mi}
                                    className="px-2 py-1.5 text-right tabular-nums text-xs"
                                    style={{
                                      color: v > 0 ? "var(--text-2)" : "var(--text-3)",
                                      borderBottom: "1px solid var(--border)",
                                      background: "var(--surface-2)",
                                    }}
                                  >
                                    {v > 0.005 ? fmtAmount(v) : ""}
                                  </td>
                                ))}
                                <td
                                  className="px-3 py-1.5 text-right tabular-nums text-xs"
                                  style={{
                                    color: "var(--text-2)",
                                    borderBottom: "1px solid var(--border)",
                                    background: "var(--surface-2)",
                                  }}
                                >
                                  {lineTotal > 0.005 ? fmtAmount(lineTotal) : ""}
                                </td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                    {!sectionCollapsed && section.rows.map((row) => {
                      const rowTotal = row.months.reduce((a, b) => a + b, 0)
                      return (
                        <tr key={`${section.project}-${row.name}`} className="pnl-row">
                          <td
                            className="px-3 py-1.5 sticky left-0 z-10 font-medium pnl-sticky"
                            style={{
                              background: "var(--surface)",
                              color: "var(--text-1)",
                              borderBottom: "1px solid var(--border)",
                              boxShadow: "2px 0 0 var(--border)",
                            }}
                          >
                            {row.name}
                          </td>
                          {row.months.map((v, mi) => (
                            <td
                              key={mi}
                              className="px-2 py-1.5 text-right tabular-nums"
                              style={{
                                color: v > 0 ? "var(--text-1)" : "var(--text-3)",
                                borderBottom: "1px solid var(--border)",
                              }}
                            >
                              {v > 0.005 ? fmtAmount(v) : ""}
                            </td>
                          ))}
                          <td
                            className="px-3 py-1.5 text-right font-semibold tabular-nums"
                            style={{ color: "var(--text-1)", borderBottom: "1px solid var(--border)" }}
                          >
                            {rowTotal > 0.005 ? fmtAmount(rowTotal) : ""}
                          </td>
                        </tr>
                      )
                    })}
                    {!sectionCollapsed && (
                    <tr style={{ background: "var(--surface-2)" }}>
                      <td
                        className="px-3 py-2 font-bold sticky left-0 z-10 pnl-sticky"
                        style={{ background: "var(--surface-2)", color: "var(--text-1)", boxShadow: "2px 0 0 var(--border)" }}
                      >
                        TOTAL
                      </td>
                      {section.monthTotals.map((v, mi) => (
                        <td key={mi} className="px-2 py-2 text-right font-bold tabular-nums" style={{ color: "var(--text-1)" }}>
                          {v > 0.005 ? fmtAmount(v) : ""}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                        {fmtAmount(section.yearTotal)}
                      </td>
                    </tr>
                    )}
                    <tr><td colSpan={grid.months.length + 2} className="h-2" /></tr>
                  </Fragment>
                )
              })}
              <tr style={{ background: "rgba(124,58,237,0.08)", borderTop: "2px solid var(--accent)" }}>
                <td
                  className="px-3 py-3 font-bold text-sm sticky left-0 z-10 pnl-sticky"
                  style={{ background: "var(--surface)", color: "var(--text-1)", boxShadow: "2px 0 0 var(--border)" }}
                >
                  Total Expenses
                </td>
                {grid.grandTotals.map((v, mi) => (
                  <td key={mi} className="px-2 py-3 text-right font-bold tabular-nums" style={{ color: "var(--text-1)" }}>
                    {v > 0.005 ? fmtAmount(v) : ""}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-bold text-sm tabular-nums" style={{ color: "var(--accent)" }}>
                  {fmtAmount(grid.grandYearTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!screenshotMode && (
      <p className="text-xs text-center print:hidden" style={{ color: "var(--text-3)" }}>
        Generated {format(new Date(), "d MMM yyyy, HH:mm")} · {viewMode === PNL_VIEW_MODES.AMORTIZED ? "Amortized monthly" : "Cash basis"} · Amounts in {display} · Grand total: {fmtAmount(grid.grandYearTotal)}
      </p>
      )}
    </div>
  )
}
