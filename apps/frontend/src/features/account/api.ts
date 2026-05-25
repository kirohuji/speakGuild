import { authClient } from '@/features/auth/client'

export interface LinkedAccount {
  id: string
  provider: string
  providerAccountId: string
  email?: string
  name?: string
  image?: string
  createdAt: Date
  updatedAt: Date
}

export async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  const res = await authClient.listAccounts()
  return res?.data?.accounts ?? res?.accounts ?? []
}

export async function linkSocialAccount(provider: 'wechat' | 'apple') {
  return authClient.linkSocial({
    provider,
    callbackURL: window.location.href,
  })
}

export async function unlinkAccount(accountId: string) {
  return authClient.unlinkAccount({ accountId })
}
