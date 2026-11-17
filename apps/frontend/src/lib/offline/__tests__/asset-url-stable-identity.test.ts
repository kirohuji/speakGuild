import { describe, expect, it } from 'vitest'
import { createFileAssetReference } from '@/lib/file-asset-reference'
import {
  audioUrlRank,
  canonicalContentUrl,
  isCollapsedOpaqueStableUrl,
  isExternalAudioUrl,
  isManagedAudioUrl,
  preferAudioUrl,
  stableRemoteUrl,
} from '../asset-url-identity'

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

describe('preferAudioUrl offline identity', () => {
  const asset = createFileAssetReference('audio-us')
  const content = 'http://localhost:3001/api/v1/manyu/file-assets/audio-us/content'
  const wiki = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/En-us-get.ogg'

  it('treats asset:// and file-assets content as managed', () => {
    expect(isManagedAudioUrl(asset)).toBe(true)
    expect(isManagedAudioUrl(content)).toBe(true)
    expect(isManagedAudioUrl(wiki)).toBe(false)
    expect(isExternalAudioUrl(wiki)).toBe(true)
    expect(isExternalAudioUrl(asset)).toBe(false)
  })

  it('prefers managed asset:// over Wikimedia', () => {
    expect(preferAudioUrl(wiki, asset)).toBe(asset)
    expect(preferAudioUrl(asset, wiki)).toBe(asset)
  })

  it('prefers asset:// over content URL; same rank keeps current', () => {
    expect(preferAudioUrl(content, asset)).toBe(asset)
    expect(preferAudioUrl(wiki, content)).toBe(content)
    expect(preferAudioUrl(asset, createFileAssetReference('other'))).toBe(asset)
    expect(audioUrlRank(asset)).toBeGreaterThan(audioUrlRank(content))
  })

  it('fills empty and canonicalizes by fileAssetId', () => {
    expect(preferAudioUrl(null, asset)).toBe(asset)
    expect(preferAudioUrl(wiki, null)).toBe(wiki)
    expect(canonicalContentUrl('audio-us')).toBe(asset)
    expect(canonicalContentUrl(null, content)).toBe(asset)
    expect(canonicalContentUrl(null, wiki)).toBe(wiki)
  })
})
