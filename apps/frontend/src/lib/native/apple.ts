import { SocialLogin } from '@capgo/capacitor-social-login'
import { isIOS, isNative } from './platform'

let initialized = false

function getAppleClientId() {
  return import.meta.env.VITE_APPLE_CLIENT_ID || import.meta.env.VITE_APP_BUNDLE_IDENTIFIER || 'lourd.manyu.app'
}

export interface NativeAppleSignInResult {
  idToken: string
  email?: string
  firstName?: string
  lastName?: string
}

export async function requestNativeAppleSignIn(): Promise<NativeAppleSignInResult> {
  if (!isNative() || !isIOS()) {
    throw new Error('Native Apple login is only available inside the iOS app')
  }

  if (!initialized) {
    await SocialLogin.initialize({
      apple: {
        clientId: getAppleClientId(),
        redirectUrl: '',
      },
    })
    initialized = true
  }

  const response = await SocialLogin.login({
    provider: 'apple',
    options: {
      scopes: ['email', 'name'],
    },
  })

  const { idToken, profile } = response.result
  if (!idToken) {
    throw new Error('Apple did not return an identity token')
  }

  return {
    idToken,
    email: profile.email || undefined,
    firstName: profile.givenName || undefined,
    lastName: profile.familyName || undefined,
  }
}
