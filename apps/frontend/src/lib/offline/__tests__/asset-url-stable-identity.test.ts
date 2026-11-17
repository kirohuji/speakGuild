import { describe, expect, it } from 'vitest'
import { createFileAssetReference } from '@/lib/file-asset-reference'
import { isCollapsedOpaqueStableUrl, stableRemoteUrl } from '../asset-url-identity'

describe('stableRemoteUrl for asset:// playback identity', () => {
  it('keeps distinct asset:// ids from collapsing to opaque origin null', () => {
    const exampleA = createFileAssetReference('example-audio-a')
    const exampleB = createFileAssetReference('example-audio-b')
    const wordUs = createFileAssetReference('word-pronunciation-us')

    // Pre-fix browser behavior: origin is the opaque string "null".
    expect(new URL(exampleA).origin).toBe('null')
    expect(new URL(exampleB).origin).toBe('null')
    expect(`${new URL(exampleA).origin}${new URL(exampleA).pathname}`).toBe('null')

    const stableA = stableRemoteUrl(exampleA)
    const stableB = stableRemoteUrl(exampleB)
    const stableWord = stableRemoteUrl(wordUs)

    expect(isCollapsedOpaqueStableUrl(stableA)).toBe(false)
    expect(isCollapsedOpaqueStableUrl(stableB)).toBe(false)
    expect(stableA).not.toBe(stableB)
    expect(stableA).not.toBe(stableWord)
    expect(stableA).toBe(exampleA)
    expect(stableB).toBe(exampleB)

    // deferredLookupKeys secondary keys must not share a url:null bucket.
    expect(`url:${stableA}`).not.toBe(`url:${stableWord}`)
    expect(`url:${stableA}`).not.toBe('url:null')
  })

  it('still strips COS signature query params for https media', () => {
    const signed = 'https://cdn.example.com/audio/word.mp3?sign=abc&t=1'
    expect(stableRemoteUrl(signed)).toBe('https://cdn.example.com/audio/word.mp3')
  })
})
