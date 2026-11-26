import { motion } from 'framer-motion'
import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { parseIso } from '../lib/date'
import type { Weight } from '../lib/types'

const W = 340
const H = 180
const PAD = { top: 16, right: 12, bottom: 24, left: 34 }

const kg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const shortDate = (s: string) => parseIso(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

/**
 * Linha única de peso ao longo do tempo (eixo x proporcional às datas).
 * Uma série: sem legenda (o título da seção nomeia). Grade discreta, linha 2px,
 * marcador no último ponto, crosshair + tooltip ao tocar/passar o mouse.
 */
export function WeightChart({ data, label = 'peso' }: { data: Weight[]; label?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const geo = useMemo(() => {
    const t = data.map((d) => parseIso(d.date).getTime())
    const v = data.map((d) => d.kg)
    const t0 = Math.min(...t)
    const t1 = Math.max(...t)
    // Eixo com 4 marcações inteiras e espaçamento igual (mín. 1 kg; faixa mínima de 3 kg
    // para não exagerar variações pequenas)
    const vMin = Math.min(...v)
    const vMax = Math.max(...v)
    const step = Math.max(1, Math.ceil((vMax - vMin + 1) / 3))
    const lo = Math.floor((vMin + vMax) / 2 - (step * 3) / 2)
    const hi = lo + step * 3
    const x = (ms: number) => PAD.left + (t1 === t0 ? (W - PAD.left - PAD.right) / 2 : ((ms - t0) / (t1 - t0)) * (W - PAD.left - PAD.right))
    const y = (k: number) => PAD.top + (1 - (k - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
    const pts = data.map((d, i) => ({ x: x(t[i]), y: y(d.kg), d }))
    const ticks = [0, 1, 2, 3].map((i) => lo + step * i)
    return { pts, ticks, y }
  }, [data])

  const path = geo.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    geo.pts.forEach((p, i) => {
      if (Math.abs(p.x - px) < Math.abs(geo.pts[best].x - px)) best = i
    })
    setHover(best)
  }

  const last = geo.pts[geo.pts.length - 1]
  const h = hover !== null ? geo.pts[hover] : null

  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`Gráfico de ${label} de ${shortDate(data[0].date)} a ${shortDate(data[data.length - 1].date)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* grade e eixo y recessivos */}
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={geo.y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-muted)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {/* eixo x: primeira e última data */}
        <text x={geo.pts[0].x} y={H - 6} fontSize={10} fill="var(--color-muted)" textAnchor="start">
          {shortDate(data[0].date)}
        </text>
        {data.length > 1 && (
          <text x={last.x} y={H - 6} fontSize={10} fill="var(--color-muted)" textAnchor="end">
            {shortDate(data[data.length - 1].date)}
          </text>
        )}

        <motion.path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* pontos pequenos para medições esparsas */}
        {data.length <= 40 && geo.pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--color-primary)" />)}
        {/* último ponto com anel na cor da superfície */}
        <circle cx={last.x} cy={last.y} r={5} fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth={2} />

        {h && (
          <g pointerEvents="none">
            <line x1={h.x} x2={h.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={h.x} cy={h.y} r={5} fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute -top-2 rounded-xl bg-scrim px-3 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: `${(h.x / W) * 100}%`, transform: `translateX(${h.x > W * 0.7 ? '-100%' : h.x < W * 0.3 ? '0' : '-50%'})` }}
        >
          <span className="font-bold">{kg(h.d.kg)} kg</span> · {shortDate(h.d.date)}
        </div>
      )}
    </div>
  )
}
