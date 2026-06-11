import { useState, useEffect, useCallback } from 'react'

/**
 * 倒计时 Hook
 *
 * @param seconds 倒计时总秒数，默认 60
 * @returns [remaining, start, reset]
 *   - remaining: 剩余秒数（0 表示未开始或已结束）
 *   - start: 开始倒计时
 *   - reset: 重置倒计时
 *
 * @example
 * const [countdown, startCountdown, resetCountdown] = useCountdown(60)
 * // 按钮文案: countdown > 0 ? `${countdown}s后重发` : '获取验证码'
 */
export function useCountdown(seconds = 60): [number, () => void, () => void] {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [remaining])

  const start = useCallback(() => {
    setRemaining(seconds)
  }, [seconds])

  const reset = useCallback(() => {
    setRemaining(0)
  }, [])

  return [remaining, start, reset]
}
