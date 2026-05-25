import { authClient, clearBearerToken } from './client'
import request, { post } from '@/lib/request'

export async function signInWithEmailPassword(email: string, password: string) {
  return authClient.signIn.email({ email, password })
}

export async function signUpWithEmailPassword(email: string, password: string, name: string) {
  return authClient.signUp.email({ email, password, name })
}

export async function sendEmailOtp(email: string) {
  return authClient.emailOtp.sendVerificationOtp({
    email,
    type: 'sign-in',
  })
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
  return authClient.signIn.social({
    provider: 'wechat',
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
