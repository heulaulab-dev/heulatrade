'use client'
import { useEffect, useRef } from 'react'
import { AreaSeries, CandlestickSeries, HistogramSeries, LineSeries, createChart, type CandlestickData, type Time } from 'lightweight-charts'
import type { Candle } from '@/lib/market/contracts'
import { calculateMacd, calculateSimpleMovingAverage } from '@/lib/market/indicators'

const NO_OVERLAYS: string[] = []

export function PriceChart({ candles, mode = 'CANDLE', overlays = NO_OVERLAYS, macd = false }: { candles: Candle[]; mode?: 'CANDLE' | 'LINE' | 'AREA'; overlays?: string[]; macd?: boolean }) {
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
    for (const period of [5, 20, 50]) {
      if (!overlays.includes(`MA${period}`)) continue
      chart.addSeries(LineSeries, { title: `MA${period}`, color: period === 5 ? '#d8c47a' : period === 20 ? '#da5c2c' : '#8bbdcc', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        .setData(calculateSimpleMovingAverage(sorted, period).map((point) => ({ time: point.time as Time, value: point.value })))
    }
    const volumeRows = sorted.filter((row) => row.volume !== null)
    if (volumeRows.length) {
      chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, 1)
        .setData(volumeRows.map((row) => ({ time: row.time as Time, value: row.volume!, color: '#606060' })))
      chart.panes()[1]?.setHeight(75)
    }
    if (macd) {
      const points = calculateMacd(sorted)
      if (points.length) {
        const pane = volumeRows.length ? 2 : 1
        chart.addSeries(HistogramSeries, { title: 'MACD HIST', priceLineVisible: false, lastValueVisible: false }, pane).setData(points.map((point) => ({ time: point.time as Time, value: point.histogram, color: point.histogram >= 0 ? '#7eb89b88' : '#d0817988' })))
        chart.addSeries(LineSeries, { title: 'MACD', color: '#8bbdcc', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane).setData(points.map((point) => ({ time: point.time as Time, value: point.macd })))
        chart.addSeries(LineSeries, { title: 'SIGNAL', color: '#da5c2c', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane).setData(points.map((point) => ({ time: point.time as Time, value: point.signal })))
        chart.panes()[pane]?.setHeight(80)
      }
    }
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [candles, mode, overlays, macd])
  return <div ref={container} className="h-full min-h-48 w-full" aria-label="Historical price chart" role="img" />
}
