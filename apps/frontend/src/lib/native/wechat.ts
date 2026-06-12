import { CapacitorWechat } from '@capgo/capacitor-wechat'
import { isNative } from './platform'

let initialized = false

function createState() {
  return crypto.randomUUID()
}

export async function requestNativeWechatAuthCode() {
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
  const response = await CapacitorWechat.auth({
    scope: 'snsapi_userinfo',
    state,
  })

  if (!response.code || response.state !== state) {
    throw new Error('Invalid WeChat authorization response')
  }

  return response.code
}
