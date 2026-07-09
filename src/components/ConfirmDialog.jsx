import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="modal-enter relative rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}
            >
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="confirm-dialog-title" className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {title}
              </h2>
              <p id="confirm-dialog-message" className="text-sm mt-1.5 whitespace-pre-line" style={{ color: 'var(--text-2)' }}>
                {message}
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-ghost flex-1 justify-center" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn flex-1 justify-center text-white" style={{ background: 'var(--red)' }} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
