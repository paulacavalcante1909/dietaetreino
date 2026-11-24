/** Datas no formato YYYY-MM-DD no fuso local (sem surpresas de UTC). */
export function isoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseIso(s)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export function dayLabel(s: string): string {
  const today = isoDate()
  if (s === today) return 'Hoje'
  if (s === addDays(today, -1)) return 'Ontem'
  if (s === addDays(today, 1)) return 'Amanhã'
  return parseIso(s).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')
}
