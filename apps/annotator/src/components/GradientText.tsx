import type { ReactNode } from 'react'

interface GradientTextProps {
  children: ReactNode
  className?: string
}

/** ReactBits-inspired gradient display text. */
export function GradientText({ children, className = '' }: GradientTextProps) {
  return (
    <span
      className={`bg-gradient-to-r from-[var(--ink)] via-[var(--accent-strong)] to-[var(--accent)] bg-clip-text text-transparent ${className}`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </span>
  )
}
