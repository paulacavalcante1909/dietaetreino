import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Field, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { num } from '../lib/nutrition'
import type { FoodDetail } from '../lib/types'

const NUTRIENTS = [
  { key: 'kcal', label: 'Calorias', suffix: 'kcal' },
  { key: 'carbs', label: 'Carboidratos', suffix: 'g' },
  { key: 'protein', label: 'Proteínas', suffix: 'g' },
  { key: 'fat', label: 'Gorduras', suffix: 'g' },
  { key: 'sodium', label: 'Sódio', suffix: 'mg' },
] as const

interface Form {
  name: string
  brand: string
  ean: string
  base_qty: string
  base_unit: 'g' | 'ml'
  kcal: string
  carbs: string
  protein: string
  fat: string
  sodium: string
  portions: { label: string; qty: string }[]
}

const empty = (name = '', ean = ''): Form => ({
  name, brand: '', ean, base_qty: '100', base_unit: 'g',
  kcal: '', carbs: '', protein: '', fat: '', sodium: '', portions: [],
})

const s = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

/** Cadastro/edição manual de alimento (valores como no rótulo). */
export function FoodFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<Form>(() => empty(params.get('nome') ?? '', params.get('ean') ?? ''))
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!id) return
    api<{ food: FoodDetail }>(`/foods/${id}`).then(({ food: f }) => {
      setForm({
        name: f.name, brand: f.brand ?? '', ean: f.ean ?? '', base_qty: s(f.base_qty), base_unit: f.base_unit,
        kcal: s(f.kcal), carbs: s(f.carbs), protein: s(f.protein), fat: s(f.fat), sodium: s(f.sodium),
        portions: f.portions.map((p) => ({ label: p.label, qty: s(p.qty) })),
      })
      setLoading(false)
    })
  }, [id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const decimal = (v: string) => v.replace(/[^\d.,]/g, '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const body = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      ean: form.ean.trim() || null,
      base_qty: num(form.base_qty),
      base_unit: form.base_unit,
      ...Object.fromEntries(NUTRIENTS.map((n) => [n.key, num(form[n.key] || '0')])),
      portions: form.portions.filter((p) => p.label.trim() && num(p.qty) > 0).map((p) => ({ label: p.label.trim(), qty: num(p.qty) })),
    }
    try {
      const r = await api<{ food: FoodDetail }>(id ? `/foods/${id}` : '/foods', { method: id ? 'PUT' : 'POST', body })
      toast({ text: id ? 'Alimento atualizado ✓' : 'Alimento cadastrado ✓' })
      const back = params.get('refeicao')
      if (!id && back) navigate(`/adicionar?data=${params.get('data')}&refeicao=${back}&novo=${r.food.id}`, { replace: true })
      else navigate(-1)
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!id || !confirm('Excluir este alimento? Os registros que você já fez continuam no histórico.')) return
    await api(`/foods/${id}`, { method: 'DELETE' })
    toast({ text: 'Alimento excluído' })
    navigate(-1)
  }

  if (loading) return <Spinner />

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">{id ? 'Editar alimento' : 'Cadastrar alimento'}</h1>
      </header>

      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{Object.keys(error.errors).length > 0 ? 'Confira os campos destacados.' : error.message}</Alert>}

        <Field label="Nome" name="name" required placeholder="ex.: Iogurte grego natural" value={form.name} onChange={(e) => set('name', e.target.value)} error={error?.field('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marca (opcional)" name="brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} error={error?.field('brand')} />
          <Field label="Cód. de barras" name="ean" inputMode="numeric" placeholder="opcional" value={form.ean} onChange={(e) => set('ean', e.target.value.replace(/\D/g, ''))} error={error?.field('ean')} />
        </div>

        <div className="rounded-2xl bg-soft p-4">
          <p className="mb-3 text-sm font-semibold">Informação nutricional por</p>
          <div className="flex gap-3">
            <Field label="Quantidade" name="base_qty" inputMode="decimal" required className="flex-1" value={form.base_qty} onChange={(e) => set('base_qty', decimal(e.target.value))} error={error?.field('base_qty')} />
            <div className="w-32">
              <span className="mb-1.5 block text-sm font-medium text-muted">Unidade</span>
              <div className="flex h-12 rounded-2xl bg-surface p-1">
                {(['g', 'ml'] as const).map((u) => (
                  <button key={u} type="button" onClick={() => set('base_unit', u)} className={`flex-1 rounded-xl text-sm font-semibold transition-colors ${form.base_unit === u ? 'bg-primary text-white' : 'text-muted'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">Dica: copie a “porção” do rótulo (ex.: 30 g) e os valores dessa porção.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {NUTRIENTS.map((n) => (
            <Field
              key={n.key}
              className={n.key === 'kcal' ? 'col-span-2' : ''}
              label={n.label}
              name={n.key}
              suffix={n.suffix}
              inputMode="decimal"
              required
              value={form[n.key]}
              onChange={(e) => set(n.key, decimal(e.target.value))}
              error={error?.field(n.key)}
            />
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Porções caseiras (opcional)</p>
          <AnimatePresence initial={false}>
            {form.portions.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2 flex items-end gap-2">
                <Field label="Nome" name={`portion_label_${i}`} placeholder="ex.: 1 fatia" className="flex-1" value={p.label} onChange={(e) => set('portions', form.portions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Field label={form.base_unit} name={`portion_qty_${i}`} inputMode="decimal" className="w-24" value={p.qty} onChange={(e) => set('portions', form.portions.map((x, j) => (j === i ? { ...x, qty: decimal(e.target.value) } : x)))} />
                <button type="button" aria-label="Remover porção" onClick={() => set('portions', form.portions.filter((_, j) => j !== i))} className="mb-1 flex size-10 items-center justify-center rounded-full text-xl text-muted hover:bg-soft">
                  ×
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {form.portions.length < 10 && (
            <button type="button" onClick={() => set('portions', [...form.portions, { label: '', qty: '' }])} className="text-sm font-semibold text-primary">
              + Adicionar porção
            </button>
          )}
        </div>

        <Button type="submit" loading={saving}>
          {id ? 'Salvar alterações' : 'Cadastrar'}
        </Button>
        {id && (
          <Button type="button" variant="danger" onClick={remove}>
            Excluir alimento
          </Button>
        )}
      </form>
    </div>
  )
}
