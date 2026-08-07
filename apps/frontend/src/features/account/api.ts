import { authClient } from '@/features/auth/client'
import { isIOS, isNative, requestNativeAppleSignIn, requestNativeWechatAuthCode } from '@/lib/native'
import { post } from '@/lib/request'

export interface LinkedAccount {
  id: string
  providerId: string
  accountId: string
  userId: string
  scopes: string[]
  createdAt: Date
  updatedAt: Date
}

export async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  const res = await authClient.listAccounts()
  return res?.data ?? []
}

export async function linkSocialAccount(provider: 'wechat' | 'apple') {
  // 移动端原生绑定：
  // - 微信：native SDK 拿 code → 后端 native 绑定端点（Web OAuth 在 WebView 里不可行）
  // - Apple：native Sign in with Apple 拿 idToken → better-auth linkSocial idToken 校验
  if (provider === 'wechat' && isNative()) {
    const code = await requestNativeWechatAuthCode()
    await post('/auth/wechat/native/bind', { code })
    return
  }
  if (provider === 'apple' && isNative() && isIOS()) {
    const result = await requestNativeAppleSignIn()
    return authClient.linkSocial({
      provider: 'apple',
      callbackURL: window.location.href,
      idToken: {
        token: result.idToken,
      },
    })
  }

  return authClient.linkSocial({
    provider,
    callbackURL: window.location.href,
  })
}

export async function unlinkAccount(account: Pick<LinkedAccount, 'providerId' | 'accountId'>) {
  return authClient.unlinkAccount({
    providerId: account.providerId,
    accountId: account.accountId,
  })
}
