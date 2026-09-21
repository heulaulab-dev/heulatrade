'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      const supabase = createClient()
      const result = mode === 'signin' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
      if (result.error) throw result.error
      if (result.data.session) { router.push('/terminal'); router.refresh() }
      else setMessage('Check your email to confirm your account.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed') }
    finally { setBusy(false) }
  }
  async function google() {
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } })
      if (error) throw error
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Google sign-in failed') }
  }
  return <main className="flex min-h-screen items-center justify-center bg-black p-4">
    <section className="w-full max-w-[390px] border border-[var(--color-iron)] bg-[var(--color-carbon)] p-6" aria-label="Authentication">
      <div className="mb-8 border-b border-[var(--color-iron)] pb-4">
        <div className="text-base font-bold tracking-tight">HEULA<span className="text-[var(--color-ember)]">/</span>TRADE</div>
        <p className="mt-2 text-[11px] text-[var(--color-ash)]">MARKET INTELLIGENCE TERMINAL · IDX</p>
      </div>
      <h1 className="mb-4 text-sm">{mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</h1>
      {!configured && <p role="alert" className="mb-4 border-l-2 border-[var(--color-ember)] pl-3 text-[var(--color-fog)]">Supabase credentials are not configured.</p>}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-[var(--color-fog)]">EMAIL<Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="flex flex-col gap-1 text-[11px] text-[var(--color-fog)]">PASSWORD<Input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <Button type="submit" disabled={busy || !configured}>{busy ? 'WORKING…' : mode === 'signin' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}</Button>
      </form>
      {message && <p role="status" className="mt-3 text-[var(--color-fog)]">{message}</p>}
      <div className="mt-5 flex gap-2 border-t border-[var(--color-iron)] pt-4">
        <Button type="button" variant="outline" disabled={!configured} onClick={google}>GOOGLE</Button>
        <Button type="button" variant="ghost" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'CREATE ACCOUNT' : 'SIGN IN'}</Button>
      </div>
      <p className="mt-8 text-[10px] text-[var(--color-steel)]">Research and information only. No order execution.</p>
    </section>
  </main>
}
