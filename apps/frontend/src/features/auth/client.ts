import { createAuthClient } from 'better-auth/client'
import { emailOTPClient, phoneNumberClient } from 'better-auth/client/plugins'

const TOKEN_KEY = 'guideready-bearer-token'

export function getBearerToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setBearerToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearBearerToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export const authClient: any = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL || window.location.origin,
  basePath: '/api/auth',
  plugins: [emailOTPClient(), phoneNumberClient()],
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: getBearerToken,
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get('set-auth-token')
      if (token) {
        setBearerToken(token)
      }
    },
  },
})
