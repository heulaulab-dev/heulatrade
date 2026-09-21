import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HeulaTrade | Authentication',
  description: 'Sign in to HeulaTrade Market Intelligence Terminal',
}

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
