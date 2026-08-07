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
    const res = await authClient.linkSocial({
      provider: 'apple',
      callbackURL: window.location.href,
      idToken: {
        token: result.idToken,
      },
    })
    if (res?.error) {
      throw new Error(res.error.message || 'Apple 绑定失败')
    }
    return res
  }

  const res = await authClient.linkSocial({
    provider,
    callbackURL: window.location.href,
  })
  if (res?.error) {
    throw new Error(res.error.message || '绑定失败')
  }
  return res
}

export async function unlinkAccount(account: Pick<LinkedAccount, 'providerId' | 'accountId'>) {
  const result = await authClient.unlinkAccount({
    providerId: account.providerId,
    accountId: account.accountId,
  })
  if (result?.error) {
    const message = result.error.message || '解绑失败'
    // better-auth 的英文提示翻译成用户可读的中文
    if (result.error.code === 'FAILED_TO_UNLINK_LAST_ACCOUNT' || /last account/i.test(message)) {
      throw new Error('至少需要保留一种登录方式，不能解绑最后一个登录账号')
    }
    throw new Error(message)
  }
  return result
}
