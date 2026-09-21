export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
}
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const magnitude = Math.abs(value)
  const [divisor, suffix] = magnitude >= 1e12 ? [1e12, 'T'] : magnitude >= 1e9 ? [1e9, 'B'] : magnitude >= 1e6 ? [1e6, 'M'] : [1, '']
  return `${formatNumber(value / Number(divisor), suffix ? 2 : 0)}${suffix}`
}
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}
export function marketDirection(value: number | null | undefined) {
  return value == null ? 'neutral' : value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
}
