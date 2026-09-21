import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HeulaTrade — Market Intelligence Terminal',
  description: 'Research Indonesian equities through price action, broker flow, foreign activity, seasonality, fundamentals, insider activity, and order flow.',
  openGraph: {
    title: 'HeulaTrade — Market Intelligence Terminal',
    description: 'Research Indonesian equities through price action, broker flow, foreign activity, seasonality, fundamentals, insider activity, and order flow.',
    siteName: 'HeulaTrade',
    type: 'website',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
