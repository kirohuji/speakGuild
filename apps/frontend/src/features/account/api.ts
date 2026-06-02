import { authClient } from '@/features/auth/client'

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
