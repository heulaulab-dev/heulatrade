'use client'
import { useEffect, useRef } from 'react'
import { AreaSeries, CandlestickSeries, HistogramSeries, LineSeries, createChart, type CandlestickData, type LineData, type Time } from 'lightweight-charts'
import type { Candle } from '@/lib/market/contracts'

const NO_OVERLAYS: string[] = []

function ema(rows: Candle[], period: number): LineData<Time>[] {
  const alpha = 2 / (period + 1)
  let value: number | null = null
  return rows.map((row) => {
    value = value === null ? row.close : row.close * alpha + value * (1 - alpha)
    return { time: row.time as Time, value }
  })
}

export function PriceChart({ candles, mode = 'CANDLE', overlays = NO_OVERLAYS }: { candles: Candle[]; mode?: 'CANDLE' | 'LINE' | 'AREA'; overlays?: string[] }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const chart = createChart(container.current, {
      autoSize: true, layout: { background: { color: '#111111' }, textColor: '#7e7e7e', fontFamily: 'monospace', fontSize: 11 },
      grid: { vertLines: { color: '#202020' }, horzLines: { color: '#202020' } },
      rightPriceScale: { borderColor: '#3a3a3a' }, timeScale: { borderColor: '#3a3a3a' },
      crosshair: { vertLine: { color: '#606060' }, horzLine: { color: '#606060' } },
    })
    const sorted = [...candles].sort((a, b) => a.time.localeCompare(b.time))
    const complete = sorted.filter((row) => row.open !== null && row.high !== null && row.low !== null)
    if (mode === 'CANDLE' && complete.length) {
      const series = chart.addSeries(CandlestickSeries, { upColor: '#7eb89b', downColor: '#d08179', wickUpColor: '#7eb89b', wickDownColor: '#d08179', borderVisible: false })
      series.setData(complete.map((row): CandlestickData<Time> => ({ time: row.time as Time, open: row.open!, high: row.high!, low: row.low!, close: row.close })))
    } else if (mode === 'AREA') {
      const series = chart.addSeries(AreaSeries, { lineColor: '#b4b4b4', topColor: '#b4b4b422', bottomColor: '#11111100' })
      series.setData(sorted.map((row) => ({ time: row.time as Time, value: row.close })))
    } else {
      const series = chart.addSeries(LineSeries, { color: '#b4b4b4', lineWidth: 2 })
      series.setData(sorted.map((row) => ({ time: row.time as Time, value: row.close })))
    }
    for (const period of [20, 50, 200]) {
      if (!overlays.includes(`EMA${period}`)) continue
      chart.addSeries(LineSeries, { color: period === 20 ? '#da5c2c' : period === 50 ? '#8bbdcc' : '#b4b4b4', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(ema(sorted, period))
    }
    const volumeRows = sorted.filter((row) => row.volume !== null)
    if (volumeRows.length) {
      chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, 1)
        .setData(volumeRows.map((row) => ({ time: row.time as Time, value: row.volume!, color: '#606060' })))
      chart.panes()[1]?.setHeight(75)
    }
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [candles, mode, overlays])
  return <div ref={container} className="h-full min-h-48 w-full" aria-label="Historical price chart" role="img" />
}
