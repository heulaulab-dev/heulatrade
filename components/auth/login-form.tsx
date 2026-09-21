'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      router.push('/terminal')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4">
      <section className="w-full max-w-[390px] border border-[var(--color-iron)] bg-[var(--color-carbon)] p-6" aria-label="Authentication">
        <div className="mb-8 border-b border-[var(--color-iron)] pb-4">
          <div className="text-base font-bold tracking-tight">HEULA<span className="text-[var(--color-ember)]">/</span>TRADE</div>
          <p className="mt-2 text-[11px] text-[var(--color-ash)]">MARKET INTELLIGENCE TERMINAL · IDX</p>
        </div>
        <h1 className="mb-4 text-sm">SIGN IN</h1>
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
                autoComplete="current-password"
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
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-[10px] text-[var(--color-ash)] hover:text-[var(--color-paper)]">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" disabled={busy || !configured}>
            {busy ? 'WORKING...' : 'SIGN IN →'}
          </Button>
        </form>
        <div className="mt-5 flex gap-2 border-t border-[var(--color-iron)] pt-4">
          <Button type="button" variant="outline" disabled={!configured} onClick={google}>
            GOOGLE
          </Button>
          <Link href="/signup" className="flex items-center justify-center flex-1">
            <Button type="button" variant="ghost" className="w-full">
              CREATE ACCOUNT
            </Button>
          </Link>
        </div>
        <p className="mt-8 text-[10px] text-[var(--color-steel)]">Research and information only. No order execution.</p>
      </section>
    </main>
  )
}
