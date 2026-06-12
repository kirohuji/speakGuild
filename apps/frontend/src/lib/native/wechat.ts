import { CapacitorWechat } from '@capgo/capacitor-wechat'
import { isNative } from './platform'

let initialized = false
let pendingAuthCode: Promise<string> | null = null

const WECHAT_AUTH_TIMEOUT_MS = 90_000

function createState() {
  return crypto.randomUUID()
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

export async function requestNativeWechatAuthCode() {
  if (pendingAuthCode) {
    return pendingAuthCode
  }

  pendingAuthCode = requestNativeWechatAuthCodeOnce().finally(() => {
    pendingAuthCode = null
  })

  return pendingAuthCode
}

async function requestNativeWechatAuthCodeOnce() {
  if (!isNative()) {
    throw new Error('Native WeChat login is only available inside the mobile app')
  }

  const appId = import.meta.env.VITE_WECHAT_APP_ID
  const universalLink = import.meta.env.VITE_WECHAT_UNIVERSAL_LINK

  if (!appId) {
    throw new Error('WeChat App ID is not configured')
  }

  if (!initialized) {
    await CapacitorWechat.initialize({ appId, universalLink })
    initialized = true
  }

  const { installed } = await CapacitorWechat.isInstalled()
  if (!installed) {
    throw new Error('WeChat is not installed on this device')
  }

  const state = createState()
  const response = await withTimeout(
    CapacitorWechat.auth({
      scope: 'snsapi_userinfo',
      state,
    }),
    WECHAT_AUTH_TIMEOUT_MS,
    'WeChat authorization timed out',
  )

  if (!response.code || response.state !== state) {
    throw new Error('Invalid WeChat authorization response')
  }

  return response.code
}
