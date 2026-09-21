'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
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
    setBusy(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setMessage('Password updated successfully.')
      setTimeout(() => router.push('/terminal'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4">
      <section className="w-full max-w-[390px] border border-[var(--color-iron)] bg-[var(--color-carbon)] p-6" aria-label="Reset password">
        <div className="mb-8 border-b border-[var(--color-iron)] pb-4">
          <div className="text-base font-bold tracking-tight">HEULA<span className="text-[var(--color-ember)]">/</span>TRADE</div>
          <p className="mt-2 text-[11px] text-[var(--color-ash)]">MARKET INTELLIGENCE TERMINAL · IDX</p>
        </div>
        <h1 className="mb-4 text-sm">NEW PASSWORD</h1>
        {!configured && (
          <p role="alert" className="mb-4 border-l-2 border-[var(--color-ember)] pl-3 text-[var(--color-fog)]">
            Supabase credentials are not configured.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 border-l-2 border-[var(--color-destructive)] pl-3 text-[var(--color-fog)]">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-4 border-l-2 border-[var(--terminal-cyan)] pl-3 text-[var(--color-fog)]">
            {message}
          </p>
        )}
        {!done && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[11px] text-[var(--color-fog)]">
              NEW PASSWORD
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy}
                  className="pr-16"
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 h-full px-3 text-[10px] text-[var(--color-ash)] hover:text-[var(--color-paper)]"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[var(--color-fog)]">
              CONFIRM NEW PASSWORD
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <Button type="submit" disabled={busy || !configured}>
              {busy ? 'WORKING...' : 'UPDATE PASSWORD →'}
            </Button>
          </form>
        )}
        <div className="mt-5 border-t border-[var(--color-iron)] pt-4">
          <Link href="/login" className="text-[11px] text-[var(--color-ash)] hover:text-[var(--color-paper)]">
            Back to sign in
          </Link>
        </div>
        <p className="mt-8 text-[10px] text-[var(--color-steel)]">Research and information only. No order execution.</p>
      </section>
    </main>
  )
}
