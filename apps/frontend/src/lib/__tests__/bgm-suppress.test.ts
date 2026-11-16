import { afterEach, describe, expect, it } from 'vitest'
import {
  isBgmSuppressed,
  isPracticeBgmRoute,
  setBgmSuppressed,
  subscribeBgmSuppress,
} from '@/lib/bgm-suppress'

afterEach(() => {
  setBgmSuppressed('practice', false)
  setBgmSuppressed('insight', false)
  setBgmSuppressed('immersive', false)
})

describe('bgm suppress reason-set', () => {
  it('suppresses while any reason is active and clears when the last reason leaves', () => {
    expect(isBgmSuppressed()).toBe(false)
    setBgmSuppressed('practice', true)
    expect(isBgmSuppressed()).toBe(true)
    setBgmSuppressed('insight', true)
    expect(isBgmSuppressed()).toBe(true)
    setBgmSuppressed('practice', false)
    expect(isBgmSuppressed()).toBe(true)
    setBgmSuppressed('insight', false)
    expect(isBgmSuppressed()).toBe(false)
  })

  it('notifies subscribers only when the suppressed state changes', () => {
    const seen: boolean[] = []
    const unsubscribe = subscribeBgmSuppress(() => seen.push(isBgmSuppressed()))
    setBgmSuppressed('practice', true)
    setBgmSuppressed('practice', true)
    setBgmSuppressed('practice', false)
    unsubscribe()
    setBgmSuppressed('practice', true)
    expect(seen).toEqual([true, false])
  })
})

describe('isPracticeBgmRoute', () => {
  it('matches practice and immersive learning routes', () => {
    expect(isPracticeBgmRoute('/practice/session/abc')).toBe(true)
    expect(isPracticeBgmRoute('/learning/writing/1')).toBe(true)
    expect(isPracticeBgmRoute('/learning/reading/1')).toBe(true)
    expect(isPracticeBgmRoute('/learning/listening/1')).toBe(true)
    expect(isPracticeBgmRoute('/scripts/player/ep-1')).toBe(true)
    expect(isPracticeBgmRoute('/scripts/nqtr/scene-1')).toBe(true)
  })

  it('does not suppress teaching docs or notebook browsing', () => {
    expect(isPracticeBgmRoute('/expressions/book-1')).toBe(false)
    expect(isPracticeBgmRoute('/learning/units/u1')).toBe(false)
    expect(isPracticeBgmRoute('/scripts')).toBe(false)
    expect(isPracticeBgmRoute('/today')).toBe(false)
  })
})
