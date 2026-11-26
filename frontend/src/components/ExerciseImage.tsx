import { Dumbbell } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Imagem do exercício alternando posição inicial/final (efeito de movimento).
 * Exercícios personalizados sem imagem mostram um ícone.
 */
export function ExerciseImage({ image, name, size = 64, animate = true }: { image: string | null; name: string; size?: number; animate?: boolean }) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!image || !animate) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setFrame((f) => 1 - f), 900)
    return () => clearInterval(id)
  }, [image, animate])

  if (!image) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-2xl bg-soft text-primary" style={{ width: size, height: size }} aria-hidden>
        <Dumbbell style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    )
  }

  return (
    <div className="relative shrink-0 overflow-hidden rounded-2xl bg-white" style={{ width: size, height: size }}>
      {[0, 1].map((i) => (
        <img
          key={i}
          src={`${image}/${i}.webp`}
          alt={i === 0 ? name : ''}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-opacity duration-300"
          style={{ opacity: frame === i ? 1 : 0 }}
        />
      ))}
    </div>
  )
}
