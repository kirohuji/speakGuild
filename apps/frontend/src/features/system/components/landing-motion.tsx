import { useRef } from 'react'
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from 'motion/react'
import { cn } from '@/lib/cn'

export const landingEase = [0.22, 1, 0.36, 1] as const

/** 滚动入场：模糊上浮 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  blur = true,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  blur?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })

  return (
    <motion.div
      ref={ref}
      initial={
        reduce
          ? false
          : { opacity: 0, y, filter: blur ? 'blur(8px)' : 'blur(0px)' }
      }
      animate={
        inView || reduce
          ? { opacity: 1, y: 0, filter: 'blur(0px)' }
          : { opacity: 0, y, filter: blur ? 'blur(8px)' : 'blur(0px)' }
      }
      transition={{ duration: 0.75, delay, ease: landingEase }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** 逐字 / 逐词淡入（中文按字，英文按词） */
export function StaggerText({
  text,
  className,
  unitClassName,
  delay = 0,
}: {
  text: string
  className?: string
  unitClassName?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  const units = /[\u4e00-\u9fff]/.test(text)
    ? Array.from(text)
    : text.split(/(\s+)/).filter((u) => u.length > 0)

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : 0.035,
        delayChildren: delay,
      },
    },
  }

  const child: Variants = {
    hidden: reduce
      ? { opacity: 1, y: 0, filter: 'blur(0px)' }
      : { opacity: 0, y: 18, filter: 'blur(6px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.55, ease: landingEase },
    },
  }

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      className={cn('inline', className)}
      aria-label={text}
    >
      {units.map((unit, i) => (
        <motion.span
          key={`${unit}-${i}`}
          variants={child}
          className={cn('inline-block whitespace-pre', unitClassName)}
        >
          {unit === ' ' ? '\u00A0' : unit}
        </motion.span>
      ))}
    </motion.span>
  )
}

/** 缓慢漂移光雾 */
export function DriftAtmosphere({
  className,
  variant = 'soft',
}: {
  className?: string
  variant?: 'soft' | 'dots'
}) {
  const reduce = useReducedMotion()

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <motion.div
        className="absolute -left-1/4 top-0 h-[70%] w-[70%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,46,95,0.10),transparent_68%)]"
        animate={
          reduce
            ? undefined
            : {
                x: [0, 36, -12, 0],
                y: [0, 20, -16, 0],
                scale: [1, 1.06, 0.98, 1],
              }
        }
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-[12%] bottom-[-10%] h-[55%] w-[55%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.09),transparent_70%)]"
        animate={
          reduce
            ? undefined
            : {
                x: [0, -28, 18, 0],
                y: [0, -22, 14, 0],
                scale: [1, 0.96, 1.05, 1],
              }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      {variant === 'dots' ? (
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,rgba(148,163,184,.32)_1px,transparent_1px)] [background-size:22px_22px]" />
      ) : (
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(105deg,transparent_40%,rgba(148,163,184,0.07)_50%,transparent_60%)]" />
      )}
    </div>
  )
}

/** 轻浮图标容器 */
export function Float({
  children,
  className,
  amplitude = 4,
  duration = 3.4,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  amplitude?: number
  duration?: number
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { y: [0, -amplitude, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  )
}
