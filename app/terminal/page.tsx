import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Terminal } from '@/components/terminal/terminal'

export const dynamic = 'force-dynamic'

export default async function TerminalPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return <Terminal userId={null} configurationMissing />
  }
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  return <Terminal userId={data.claims.sub} />
}
