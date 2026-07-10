"use client";

interface ResetPasswordProps {
  onBack: () => void;
}


import { useState } from 'react'
import { Mail, ArrowLeft } from 'lucide-react'
import { supabase } from "@/lib/data/supabase"

export default function ResetPassword({ onBack }: ResetPasswordProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (!supabase) {
      setError("Supabase is not configured");
      setLoading(false);
      return;
    }

    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (err) {
        setError(err.message);
      } else {
        setMessage(`✅ Password reset link sent to ${email}. Check your email!`);
        setEmail("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm mb-6"
          style={{ color: '#7c3aed' }}
        >
          <ArrowLeft size={14} />
          Back to login
        </button>

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
            CC
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Reset Password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Enter your email to receive a reset link</p>
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
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
