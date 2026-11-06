import { describe, expect, it } from 'vitest'
import { digestSync } from '../sha256'
import { digestBuffer } from '../sha256-worker.service'

const encode = (value: string) => new TextEncoder().encode(value).buffer as ArrayBuffer

describe('offline SHA-256', () => {
  it('matches standard SHA-256 vectors', () => {
    expect(digestSync(encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(digestSync(encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('uses the worker service API without crypto.subtle', async () => {
    await expect(digestBuffer(encode('speakguild'))).resolves.toBe(
      digestSync(encode('speakguild')),
    )
  })
})
