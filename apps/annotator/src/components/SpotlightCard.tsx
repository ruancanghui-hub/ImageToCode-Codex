import type { CSSProperties, ReactNode } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** ReactBits-inspired spotlight panel (light theme). */
export function SpotlightCard({ children, className = '', style }: SpotlightCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_10px_28px_rgba(15,23,42,0.05)] ${className}`}
      style={style}
      onMouseMove={(e) => {
        const el = e.currentTarget
        const rect = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
        el.style.setProperty('--my', `${e.clientY - rect.top}px`)
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(420px circle at var(--mx, 30%) var(--my, 20%), rgba(0,180,216,0.12), transparent 45%)',
        }}
      />
      <div className="relative z-10 flex min-h-0 h-full flex-col">{children}</div>
    </div>
  )
}
