import { authClient, clearBearerToken, setBearerToken } from './client'
import { del, get, post } from '@/lib/request'
import { isIOS, isNative, requestNativeAppleSignIn, requestNativeWechatAuthCode } from '@/lib/native'

export async function signInWithEmailPassword(email: string, password: string) {
  return authClient.signIn.email({ email, password })
}

export async function signUpWithEmailPassword(email: string, password: string, name: string) {
  return authClient.signUp.email({ email, password, name })
}

function throwIfAuthError(result: { error?: { message?: string } | null }, fallback: string) {
  if (result?.error) {
    throw new Error(result.error.message || fallback)
  }
  return result
}

export async function sendEmailOtp(email: string) {
  const result = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: 'email-verification',
  })
  return throwIfAuthError(result, '验证码发送失败')
}

export async function verifyEmailOtp(email: string, otp: string) {
  const result = await authClient.emailOtp.verifyEmail({ email, otp })
  return throwIfAuthError(result, '邮箱验证失败')
}

/** 已登录用户：向新邮箱发送改邮验证码 */
export async function requestEmailChange(newEmail: string) {
  const result = await authClient.emailOtp.requestEmailChange({ newEmail })
  return throwIfAuthError(result, '验证码发送失败')
}

/** 已登录用户：用新邮箱验证码确认改邮 */
export async function confirmEmailChange(newEmail: string, otp: string) {
  const result = await authClient.emailOtp.changeEmail({ newEmail, otp })
  return throwIfAuthError(result, '修改邮箱失败')
}

export function mapEmailChangeError(message: string | undefined, t: (key: string) => string): string {
  const raw = (message || '').toLowerCase()
  if (raw.includes('already in use') || raw.includes('email already')) {
    return t('profile.emailAlreadyInUse')
  }
  if (raw.includes('email is the same') || raw.includes('same')) {
    return t('profile.emailSameAsCurrent')
  }
  if (raw.includes('invalid email') || raw.includes('invalid_email')) {
    return t('auth.enterEmail')
  }
  if (raw.includes('expired') || raw.includes('otp_expired')) {
    return t('auth.otpExpired')
  }
  if (raw.includes('too many') || raw.includes('too_many')) {
    return t('auth.otpTooManyAttempts')
  }
  if (raw.includes('otp') || raw.includes('verification code') || raw.includes('invalid')) {
    return t('auth.invalidOtp')
  }
  return message || t('profile.changeEmailFailed')
}

export async function signInWithEmailOtp(email: string, otp: string) {
  return authClient.signIn.emailOtp({
    email,
    otp,
  })
}

export async function sendPhoneOtp(phoneNumber: string) {
  return authClient.phoneNumber.sendOtp({ phoneNumber })
}

export async function verifyPhoneOtp(phoneNumber: string, code: string) {
  return authClient.phoneNumber.verify({
    phoneNumber,
    code,
    disableSession: false,
  })
}

/**
 * 已登录用户绑定手机号：发送验证码到新手机号
 */
export async function sendBindPhoneOtp(phoneNumber: string) {
  const result = await authClient.phoneNumber.sendOtp({ phoneNumber })
  if (result?.error) {
    throw new Error(result.error.message || '验证码发送失败')
  }
  return result
}

/**
 * 已登录用户绑定手机号：验证 OTP 并更新用户 phoneNumber 字段
 * 传入 updatePhoneNumber: true 表示将手机号写入当前用户记录
 */
export async function bindPhoneNumber(phoneNumber: string, code: string) {
  const result = await authClient.phoneNumber.verify({
    phoneNumber,
    code,
    updatePhoneNumber: true,  // ← 关键：更新用户 phoneNumber 字段
  })
  if (result?.error) {
    throw new Error(result.error.message || '手机号绑定失败')
  }
  return result?.data ?? result
}

// wechat plugin removed — signInWithWechat() is unavailable
// export async function signInWithWechat() {
//   if (isNative()) {
//     const code = await requestNativeWechatAuthCode()
//     const result = await post<{ token: string }>('/auth/wechat/native', { code })
//     setBearerToken(result.token)
//     return result
//   }
//
//   return authClient.signIn.social({
//     provider: 'wechat',
//     callbackURL: window.location.href,
//   })
// }

export async function signInWithWechat() {
  if (isNative()) {
    const code = await requestNativeWechatAuthCode()
    const result = await post<{ token: string }>('/auth/wechat/native', { code })
    setBearerToken(result.token)
    return result
  }

  return authClient.signIn.social({
    provider: 'wechat',
    callbackURL: window.location.href,
  })
}

export async function signInWithApple() {
  if (isNative() && isIOS()) {
    const result = await requestNativeAppleSignIn()
    const authResult = await authClient.signIn.social({
      provider: 'apple',
      callbackURL: window.location.href,
      idToken: {
        token: result.idToken,
        user: {
          email: result.email,
          name: {
            firstName: result.firstName,
            lastName: result.lastName,
          },
        },
      },
    })

    const token = authResult?.data?.token || authResult?.token
    if (token) {
      setBearerToken(token)
    }
    return authResult
  }

  return authClient.signIn.social({
    provider: 'apple',
    callbackURL: window.location.href,
  })
}

export async function getAuthSession() {
  return authClient.getSession()
}

export async function signOutAuth() {
  await authClient.signOut()
  clearBearerToken()
}

export async function revokeOtherSessions(): Promise<{ revoked: number }> {
  return post('/auth/sessions/revoke-others')
}

// ─── 忘记密码 ──────────────────────────────────────────────────

export async function sendForgotPasswordOtp(email: string) {
  await post('/auth/forgot-password', { email })
  const result = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: 'forget-password',
  })
  return throwIfAuthError(result, '验证码发送失败')
}

export async function resetPasswordByOtp(email: string, otp: string, newPassword: string) {
  const result = await authClient.emailOtp.resetPassword({
    email,
    otp,
    password: newPassword,
  })
  return throwIfAuthError(result, '重置失败，请检查验证码')
}

// ─── 新人推广试用 ───────────────────────────────────────────────

export async function claimPromoTrial(): Promise<{ granted: boolean; days?: number; message: string }> {
  return post('/auth/promo-trial')
}

// ─── 修改密码 ──────────────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string) {
  return post('/auth/change-password', { currentPassword, newPassword })
}

// ─── 删除账户 ──────────────────────────────────────────────────

export interface DeleteAccountRequirements {
  requiresPassword: boolean
  deletionRequestedAt: string | null
  deletionScheduledAt: string | null
  gracePeriodDays: number
}

export interface DeleteAccountResult {
  message: string
  deletionScheduledAt: string
  gracePeriodDays: number
}

export async function getDeleteAccountRequirements(): Promise<DeleteAccountRequirements> {
  return get('/auth/delete-account/requirements')
}

export async function deleteAccount(password?: string): Promise<DeleteAccountResult> {
  return del('/auth/delete-account', { password })
}

export async function cancelDeleteAccount(): Promise<{ message: string }> {
  return post('/auth/delete-account/cancel')
}
