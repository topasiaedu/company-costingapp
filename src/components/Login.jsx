import { useState } from 'react'
import { Mail, Lock, LogIn } from 'lucide-react'
import { signUp, signIn } from '../data/supabase'

export default function Login({ onLoginSuccess, onForgotPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let result
      if (isSignUp) {
        result = await signUp(email, password)
      } else {
        result = await signIn(email, password)
      }

      if (result.error) {
        setError(result.error.message)
      } else {
        onLoginSuccess(result.data.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
            CC
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Company Costing</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Track your expenses in the cloud</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>Email</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <Mail size={16} style={{ color: 'var(--text-3)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-1)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>Password</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <Lock size={16} style={{ color: 'var(--text-3)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-opacity"
            style={{
              background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
              color: 'white',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <LogIn size={16} />
            {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        {/* Forgot Password & Toggle Sign Up */}
        <div className="mt-6 space-y-3">
          {!isSignUp && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="w-full text-sm"
              style={{ color: '#7c3aed' }}
            >
              Forgot password?
            </button>
          )}
          
          <div className="text-center text-sm">
            <span style={{ color: 'var(--text-3)' }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="font-semibold"
              style={{ color: '#7c3aed' }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
