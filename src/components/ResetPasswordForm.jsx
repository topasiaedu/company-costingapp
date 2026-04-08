import { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../data/supabase'

export default function ResetPasswordForm({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
      } else {
        setError('Invalid or expired reset link. Please try again.')
      }
    }
    checkSession()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error: err } = await supabase.auth.updateUser({ password })

      if (err) {
        setError(err.message)
      } else {
        setMessage('✅ Password reset successful! Redirecting...')
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <p style={{ color: 'var(--text-1)' }}>{error || 'Checking reset link...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
            CC
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>New Password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Create a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>New Password</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <Lock size={16} style={{ color: 'var(--text-3)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-1)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ color: 'var(--text-3)' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>Confirm Password</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <Lock size={16} style={{ color: 'var(--text-3)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-1)' }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold transition-opacity"
            style={{
              background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
              color: 'white',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
