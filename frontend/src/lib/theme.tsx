import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Temas visuais. Cada tema troca cores (CSS em index.css), mascote, logo, favicon
 * e a cor da barra do celular. O ícone do app INSTALADO não muda (o sistema guarda
 * o ícone no momento da instalação).
 */
export type ThemeId = 'neutro' | 'coelhinha' | 'onca' | 'dark' | 'tigrao'

export interface ThemeInfo {
  id: ThemeId
  name: string
  description: string
  assets: string // pasta em /themes
  themeColor: string // barra de status / navegador
  heart: string // emoji do "Oi, nome"
  preview: { bg: string; surface: string; accent: string; accent2: string }
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'neutro',
    name: 'Neutro',
    description: 'Escuro e laranja',
    assets: '/themes/neutro',
    themeColor: '#141518',
    heart: '🧡',
    preview: { bg: '#141518', surface: '#1e2024', accent: '#ff8a3d', accent2: '#a5acb8' },
  },
  {
    id: 'coelhinha',
    name: 'Coelhinha',
    description: 'Rosa e lilás',
    assets: '/themes/coelhinha',
    themeColor: '#F8CCDB',
    heart: '💜',
    preview: { bg: '#fbf7fc', surface: '#ffffff', accent: '#cc6cd7', accent2: '#d66baa' },
  },
  {
    id: 'onca',
    name: 'Onça',
    description: 'Bege e caramelo',
    assets: '/themes/onca',
    themeColor: '#FDE7D3',
    heart: '🤎',
    preview: { bg: '#fdf6ee', surface: '#ffffff', accent: '#d4955a', accent2: '#e8919c' },
  },
  {
    id: 'dark',
    name: 'Ratão',
    description: 'Escuro, grafite e vermelho',
    assets: '/themes/rato',
    themeColor: '#141518',
    heart: '❤️',
    preview: { bg: '#141518', surface: '#1f2125', accent: '#d6343a', accent2: '#9fb0c4' },
  },
  {
    id: 'tigrao',
    name: 'Tigrão',
    description: 'Cinza e azul',
    assets: '/themes/tigrao',
    themeColor: '#E3EAF3',
    heart: '💙',
    preview: { bg: '#f3f5f8', surface: '#ffffff', accent: '#3b82c4', accent2: '#e8894a' },
  },
]

const KEY = 'dt_theme'

export function storedTheme(): ThemeId {
  const t = localStorage.getItem(KEY)
  return THEMES.some((x) => x.id === t) ? (t as ThemeId) : 'neutro'
}

function setLink(rel: string, href: string, sizes?: string) {
  const sel = sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]:not([sizes])`
  let el = document.head.querySelector<HTMLLinkElement>(sel)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    if (sizes) el.setAttribute('sizes', sizes)
    document.head.appendChild(el)
  }
  el.href = href
}

/** Aplica no documento: atributo data-theme, favicon, ícone do iPhone e cor da barra. */
export function applyTheme(id: ThemeId) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0]
  document.documentElement.dataset.theme = t.id
  setLink('icon', `${t.assets}/favicon-32.png`, '32x32')
  setLink('icon', `${t.assets}/favicon.png`, '64x64')
  setLink('apple-touch-icon', `${t.assets}/apple-touch-icon.png`)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.themeColor)
}

interface ThemeState {
  theme: ThemeInfo
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeState>({ theme: THEMES[0], setTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeId>(storedTheme)

  useEffect(() => applyTheme(id), [id])

  const setTheme = useCallback((next: ThemeId) => {
    const root = document.documentElement
    root.classList.add('theme-switching')
    localStorage.setItem(KEY, next)
    setId(next)
    window.setTimeout(() => root.classList.remove('theme-switching'), 450)
  }, [])

  return <ThemeContext.Provider value={{ theme: THEMES.find((t) => t.id === id)!, setTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
