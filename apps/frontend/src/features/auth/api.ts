import { authClient, clearBearerToken, setBearerToken } from './client'
import request, { post } from '@/lib/request'
import { isIOS, isNative, requestNativeAppleSignIn, requestNativeWechatAuthCode } from '@/lib/native'

export async function signInWithEmailPassword(email: string, password: string) {
  return authClient.signIn.email({ email, password })
}

export async function signUpWithEmailPassword(email: string, password: string, name: string) {
  return authClient.signUp.email({ email, password, name })
}

export async function sendEmailOtp(email: string) {
  return authClient.emailOtp.sendVerificationOtp({
    email,
    type: 'email-verification',
  })
}

export async function verifyEmailOtp(email: string, otp: string) {
  return authClient.emailOtp.verifyEmail({ email, otp })
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

// ─── 忘记密码 ──────────────────────────────────────────────────

export async function sendForgotPasswordOtp(email: string) {
  return authClient.emailOtp.sendVerificationOtp({
    email,
    type: 'forget-password',
  })
}

export async function resetPasswordByOtp(email: string, otp: string, newPassword: string) {
  return post('/auth/reset-password', { email, otp, newPassword })
}

// ─── 修改密码 ──────────────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string) {
  return post('/auth/change-password', { currentPassword, newPassword })
}

// ─── 删除账户 ──────────────────────────────────────────────────

export async function deleteAccount(password: string) {
  return request.delete('/auth/delete-account', { data: { password } })
}
