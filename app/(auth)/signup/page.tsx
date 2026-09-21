'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      if (signUpError) throw signUpError
      setMessage('Check your email to confirm your account.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4">
      <section className="w-full max-w-[390px] border border-[var(--color-iron)] bg-[var(--color-carbon)] p-6" aria-label="Sign up">
        <div className="mb-8 border-b border-[var(--color-iron)] pb-4">
          <div className="text-base font-bold tracking-tight">HEULA<span className="text-[var(--color-ember)]">/</span>TRADE</div>
          <p className="mt-2 text-[11px] text-[var(--color-ash)]">MARKET INTELLIGENCE TERMINAL · IDX</p>
        </div>
        <h1 className="mb-4 text-sm">CREATE ACCOUNT</h1>
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
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[11px] text-[var(--color-fog)]">
            EMAIL
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[var(--color-fog)]">
            PASSWORD
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
            CONFIRM PASSWORD
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
            {busy ? 'WORKING...' : 'CREATE ACCOUNT →'}
          </Button>
        </form>
        <div className="mt-5 border-t border-[var(--color-iron)] pt-4">
          <Link href="/login" className="text-[11px] text-[var(--color-ash)] hover:text-[var(--color-paper)]">
            Already have an account? Sign in
          </Link>
        </div>
        <p className="mt-8 text-[10px] text-[var(--color-steel)]">Research and information only. No order execution.</p>
      </section>
    </main>
  )
}
