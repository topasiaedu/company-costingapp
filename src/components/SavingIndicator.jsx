import { CheckCircle, AlertCircle } from 'lucide-react'

export default function SavingIndicator({ status }) {
  // status: 'idle', 'saving', 'saved', 'error'
  
  if (status === 'idle') return null
  
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm"
      style={{
        background: status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        border: status === 'error' ? '1px solid #ef4444' : '1px solid #22c55e',
      }}>
      {status === 'saving' && (
        <>
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm" style={{ color: '#3b82f6' }}>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle size={16} style={{ color: '#22c55e' }} />
          <span className="text-sm" style={{ color: '#22c55e' }}>Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle size={16} style={{ color: '#ef4444' }} />
          <span className="text-sm" style={{ color: '#ef4444' }}>Save failed</span>
        </>
      )}
    </div>
  )
}
