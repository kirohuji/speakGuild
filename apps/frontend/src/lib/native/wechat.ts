// import { CapacitorWechat } from '@capgo/capacitor-wechat'
// import { isNative } from './platform'

// function createState() {
//   return crypto.randomUUID()
// }

// export async function requestNativeWechatAuthCode() {
//   if (!isNative()) {
//     throw new Error('Native WeChat login is only available inside the mobile app')
//   }

//   const appId = import.meta.env.VITE_WECHAT_APP_ID
//   const universalLink = import.meta.env.VITE_WECHAT_UNIVERSAL_LINK

//   if (appId) {
//     await CapacitorWechat.initialize({ appId, universalLink })
//   }

//   const { installed } = await CapacitorWechat.isInstalled()
//   if (!installed) {
//     throw new Error('WeChat is not installed on this device')
//   }

//   const state = createState()
//   const response = await CapacitorWechat.auth({
//     scope: 'snsapi_userinfo',
//     state,
//   })

//   if (!response.code || response.state !== state) {
//     throw new Error('Invalid WeChat authorization response')
//   }

//   return response.code
// }
