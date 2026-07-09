import { useState, useRef, useMemo, Fragment } from "react"
import { X, Upload, FileSpreadsheet, AlertTriangle, Check, ChevronRight, ChevronLeft } from "lucide-react"
import { parseMastersheetCsv, previewRowsToImportPayload, summarizeImportPreview } from "../data/parseMastersheetCsv"
import { fmtCurrency } from "../data/store"

const STEPS = ["Upload", "Preview", "Import"]
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * Map Supabase / network errors to a short user-visible message.
 * @param {unknown} err
 * @returns {string}
 */
function formatImportError(err) {
  const msg = (err && typeof err === "object" && "message" in err)
    ? String(err.message)
    : (typeof err === "string" ? err : "Import failed")
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : ""
  if (code === "42501" || /row-level security|RLS|permission denied/i.test(msg)) {
    return "Permission denied (RLS). Sign in again and confirm your account owns this data."
  }
  if (/column|Could not find.*column/i.test(msg)) {
    return `Database schema mismatch: ${msg}. Run supabase-setup.sql or supabase-migration.sql.`
  }
  if (/network|Failed to fetch|fetch/i.test(msg)) {
    return "Network error talking to Supabase. Check your connection and env vars."
  }
  return msg || "Import failed"
}

export default function ImportModal({ onClose, onImport, projects }) {
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState("")
  const [year, setYear] = useState(new Date().getFullYear())
  const [previewRows, setPreviewRows] = useState([])
  const [warnings, setWarnings] = useState([])
  const [skipped, setSkipped] = useState(0)
  const [importMode, setImportMode] = useState("append")
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState(null)
  const fileRef = useRef(null)

  const summary = useMemo(() => summarizeImportPreview(previewRows), [previewRows])

  function handleFile(file) {
    if (!file) return
    setError("")
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== "string") {
        setError("Could not read file")
        return
      }
      try {
        const result = parseMastersheetCsv(text)
        setYear(result.year)
        setPreviewRows(result.rows)
        setWarnings(result.warnings)
        setSkipped(result.skipped)
        if (result.rows.length === 0) {
          setError(result.warnings[0] || "No expense rows found. Check month columns and section headers.")
          return
        }
        setStep(1)
      } catch (parseErr) {
        setError(formatImportError(parseErr))
      }
    }
    reader.onerror = () => setError("Could not read file")
    reader.readAsText(file)
  }

  function updateRow(id, patch) {
    setPreviewRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  /**
   * @param {string} id
   * @param {number} monthIdx - index into row.amounts
   * @param {string} raw
   */
  function updateAmount(id, monthIdx, raw) {
    setPreviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const amounts = [...r.amounts]
        const cleaned = String(raw).trim().replace(/^RM\s*/i, "").replace(/,/g, "")
        if (!cleaned) {
          amounts[monthIdx] = null
        } else {
          const n = parseFloat(cleaned)
          amounts[monthIdx] = Number.isFinite(n) ? n : null
        }
        return { ...r, amounts }
      })
    )
  }

  async function handleImport() {
    setImporting(true)
    setError("")
    try {
      const { expenses, recurring } = previewRowsToImportPayload(
        previewRows.filter((r) => r.selected),
        { billingDay: "last" }
      )
      if (expenses.length === 0 && recurring.length === 0) {
        setError("Nothing to import — select rows and enter at least one monthly amount.")
        return
      }
      await onImport({ expenses, recurring, mode: importMode, year })
      setStep(2)
    } catch (err) {
      setError(formatImportError(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="modal-enter relative rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>Import Mastersheet CSV</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Bootstrap from your spreadsheet — then manage everything in the app
            </p>
          </div>
          <button className="btn-ghost p-1.5 rounded-lg" style={{ border: "none" }} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  background: i <= step ? "var(--accent-dim)" : "transparent",
                  color: i <= step ? "var(--accent)" : "var(--text-3)",
                  border: i <= step ? "1px solid var(--accent)" : "1px solid var(--border)",
                }}
              >
                {i < step ? <Check size={10} className="inline mr-1" /> : null}
                {s}
              </span>
              {i < STEPS.length - 1 && <ChevronRight size={12} style={{ color: "var(--text-3)" }} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 0 && (
            <div
              className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors hover:border-violet-400"
              style={{ borderColor: "var(--border)" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFile(e.dataTransfer.files[0])
              }}
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <Upload size={32} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
              <p className="font-medium text-sm mb-1" style={{ color: "var(--text-1)" }}>
                Drop your P&L CSV here or click to browse
              </p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                Wide-format mastersheet with months as columns (January–December)
              </p>
              {error && <p className="text-xs text-red-500 mt-4">{error}</p>}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="card py-2 px-4 flex items-center gap-2">
                  <FileSpreadsheet size={14} style={{ color: "var(--accent)" }} />
                  <span className="text-xs" style={{ color: "var(--text-2)" }}>{fileName}</span>
                </div>
                <div className="card py-2 px-4 text-xs" style={{ color: "var(--text-2)" }}>
                  Year: <strong>{year}</strong>
                </div>
                <div className="card py-2 px-4 text-xs" style={{ color: "var(--text-3)" }}>
                  {skipped} rows skipped (totals, metrics)
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="card py-2 px-3 text-xs" style={{ color: "var(--text-2)" }}>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Expenses</div>
                  <strong>{summary.expenseCount}</strong>
                </div>
                <div className="card py-2 px-3 text-xs" style={{ color: "var(--text-2)" }}>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Recurring</div>
                  <strong>{summary.recurringCount}</strong>
                </div>
                <div className="card py-2 px-3 text-xs" style={{ color: "var(--text-2)" }}>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Credit reloads</div>
                  <strong>{summary.creditReloadCount}</strong>
                </div>
                <div className="card py-2 px-3 text-xs" style={{ color: "var(--text-2)" }}>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>One-time</div>
                  <strong>{summary.oneTimeCount}</strong>
                </div>
              </div>

              <div className="card py-2 px-4 text-xs" style={{ color: "var(--text-2)" }}>
                <span className="font-medium">By project: </span>
                {Object.entries(summary.byProject).length === 0
                  ? "—"
                  : Object.entries(summary.byProject).map(([name, info]) => (
                      <span key={name} className="inline-block mr-3">
                        {name}: {info.expenses} expenses ({info.lineItems} lines)
                      </span>
                    ))}
              </div>

              {warnings.length > 0 && (
                <div className="rounded-xl px-4 py-3 text-xs flex gap-2" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid #f59e0b", color: "#b45309" }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>{warnings.join(" ")}</div>
                </div>
              )}

              <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
                <strong style={{ color: "var(--text-2)" }}>Credit reloads (AS Credits):</strong> each month&apos;s value is a top-up amount, counted as spend when reloaded. Usage burn is not tracked separately.
                Historical dates use the <strong>last day of each month</strong>. Rows with warnings (e.g. Zoom add-ons) can edit monthly amounts below before import.
              </div>

              <div className="flex gap-3 items-center">
                <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>Import mode</label>
                <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-medium"
                    style={importMode === "append" ? { background: "var(--accent)", color: "white" } : { color: "var(--text-2)" }}
                    onClick={() => { setImportMode("append"); setReplaceConfirmed(false) }}
                  >
                    Append to existing
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-medium"
                    style={importMode === "replace" ? { background: "var(--accent)", color: "white" } : { color: "var(--text-2)" }}
                    onClick={() => setImportMode("replace")}
                  >
                    Replace all data
                  </button>
                </div>
              </div>

              {importMode === "replace" && (
                <>
                  <div
                    className="rounded-xl px-4 py-3 text-xs flex gap-2"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #ef4444", color: "#b91c1c" }}
                  >
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>This will permanently delete all your existing expenses and subscriptions before importing.</strong>
                      {" "}This action cannot be undone.
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: "var(--text-2)" }}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={replaceConfirmed}
                      onChange={(e) => setReplaceConfirmed(e.target.checked)}
                    />
                    <span>I understand this will replace all data</span>
                  </label>
                </>
              )}

              <div className="card p-0 overflow-x-auto max-h-80">
                <table className="data-table w-full text-xs">
                  <thead>
                    <tr>
                      <th className="w-8" />
                      <th>Name</th>
                      <th>Project</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Recurring</th>
                      <th>Months</th>
                      <th>Sample</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => {
                      const filled = row.amounts.filter((a) => a !== null && a > 0).length
                      const sample = row.amounts.find((a) => a !== null && a > 0)
                      const needsEdit = Boolean(row.warning) || filled === 0
                      const isOpen = expandedId === row.id
                      return (
                        <Fragment key={row.id}>
                          <tr style={{ opacity: row.selected ? 1 : 0.45 }}>
                            <td>
                              <input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.id, { selected: e.target.checked })} />
                            </td>
                            <td>
                              <input
                                className="input text-xs py-1"
                                value={row.name}
                                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                              />
                              {row.warning && (
                                <p className="text-[10px] mt-0.5 text-amber-600">{row.warning}</p>
                              )}
                            </td>
                            <td>
                              <select
                                className="input text-xs py-1 w-28"
                                value={row.project || ""}
                                onChange={(e) => updateRow(row.id, { project: e.target.value || null })}
                              >
                                <option value="">Company-wide</option>
                                {[...new Set([
                                  ...projects.map((p) => p.name),
                                  ...(row.project ? [row.project] : []),
                                ])].map((name) => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input className="input text-xs py-1 w-24" value={row.category} onChange={(e) => updateRow(row.id, { category: e.target.value })} />
                            </td>
                            <td>
                              <select
                                className="input text-xs py-1"
                                value={row.expenseType}
                                onChange={(e) => updateRow(row.id, { expenseType: e.target.value, recurring: e.target.value === "subscription" ? row.recurring : false })}
                              >
                                <option value="subscription">Subscription</option>
                                <option value="credit-reload">Credit reload</option>
                                <option value="one-time">One-time</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={row.recurring}
                                disabled={row.expenseType !== "subscription"}
                                onChange={(e) => updateRow(row.id, { recurring: e.target.checked })}
                              />
                            </td>
                            <td>{filled}</td>
                            <td>{sample != null ? fmtCurrency(sample, "MYR") : "—"}</td>
                            <td>
                              {(needsEdit || isOpen) && (
                                <button
                                  type="button"
                                  className="btn-ghost text-[10px] px-1.5 py-0.5"
                                  onClick={() => setExpandedId(isOpen ? null : row.id)}
                                >
                                  {isOpen ? "Hide" : "Edit months"}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={9} className="!p-3" style={{ background: "var(--surface-2)" }}>
                                <p className="text-[10px] mb-2" style={{ color: "var(--text-3)" }}>
                                  Edit monthly amounts (MYR). Clear a cell to skip that month.
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                  {row.monthCols.map((mc, i) => (
                                    <label key={mc.col} className="block text-[10px]" style={{ color: "var(--text-3)" }}>
                                      {MONTH_SHORT[mc.monthIndex] || `M${i + 1}`}
                                      <input
                                        className="input text-xs py-1 mt-0.5 w-full"
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="—"
                                        value={row.amounts[i] == null ? "" : String(row.amounts[i])}
                                        onChange={(e) => updateAmount(row.id, i, e.target.value)}
                                      />
                                    </label>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="rounded-xl px-4 py-3 text-xs flex gap-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", color: "#b91c1c" }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
                <Check size={28} className="text-green-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--text-1)" }}>Import complete</h3>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                {summary.expenseCount} expenses, {summary.recurringCount} recurring, {summary.creditReloadCount} credit reloads.
                Check the P&L Report tab to see your mastersheet view.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {step === 1 ? (
            <button className="btn-ghost text-xs gap-1" onClick={() => setStep(0)}>
              <ChevronLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            {step < 2 && (
              <button className="btn-ghost text-xs" onClick={onClose}>Cancel</button>
            )}
            {step === 1 && (
              <button
                className="btn-primary text-xs"
                disabled={importing || summary.lineItemCount === 0 || (importMode === "replace" && !replaceConfirmed)}
                onClick={handleImport}
              >
                {importing ? "Importing…" : `Import ${summary.expenseCount} expenses`}
              </button>
            )}
            {step === 2 && (
              <button className="btn-primary text-xs" onClick={onClose}>Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
