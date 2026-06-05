import { create } from 'zustand'
import { getUserProfile, updateUserProfile, type UserProfile } from '@/features/profile/api'
import { getCurrentAvatar, setCurrentAvatar, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import {
  listLinkedAccounts, linkSocialAccount, unlinkAccount,
  type LinkedAccount,
} from '@/features/account/api'

interface AccountStore {
  // 数据
  profile: UserProfile | null
  avatarUrl: string | null
  linkedAccounts: LinkedAccount[]
  isLoading: boolean

  // 操作中状态
  avatarUploading: boolean
  linkingProvider: string | null
  unlinkingId: string | null

  // Actions
  fetchAll: () => Promise<void>
  updateProfile: (data: Partial<Pick<UserProfile, 'name'>>) => Promise<void>
  uploadAvatar: (file: File) => Promise<void>
  fetchLinkedAccounts: () => Promise<void>
  linkSocial: (provider: 'wechat' | 'apple') => Promise<void>
  unlinkSocial: (account: LinkedAccount) => Promise<void>
}

export const useAccountStore = create<AccountStore>()((set, getState) => ({
  profile: null,
  avatarUrl: null,
  linkedAccounts: [],
  isLoading: true,

  avatarUploading: false,
  linkingProvider: null,
  unlinkingId: null,

  async fetchAll() {
    set({ isLoading: true })
    try {
      const [p, avatar, accounts] = await Promise.all([
        getUserProfile(),
        getCurrentAvatar(),
        listLinkedAccounts().catch(() => [] as LinkedAccount[]),
      ])
      set({
        profile: p,
        avatarUrl: avatar?.url ?? null,
        linkedAccounts: accounts,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  async updateProfile(data) {
    await updateUserProfile(data)
    set((s) => ({
      profile: s.profile ? { ...s.profile, ...data } : null,
    }))
  },

  async uploadAvatar(file) {
    set({ avatarUploading: true })
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'avatar' })
      const current = await setCurrentAvatar(asset.id)
      set({ avatarUrl: current.url, avatarUploading: false })
    } catch {
      set({ avatarUploading: false })
    }
  },

  async fetchLinkedAccounts() {
    try {
      const accounts = await listLinkedAccounts()
      set({ linkedAccounts: accounts })
    } catch {
      // ignore
    }
  },

  async linkSocial(provider) {
    set({ linkingProvider: provider })
    try {
      await linkSocialAccount(provider)
    } catch {
      // ignore
    } finally {
      set({ linkingProvider: null })
    }
  },

  async unlinkSocial(account) {
    const { unlinkingId } = getState()
    if (unlinkingId) return
    set({ unlinkingId: account.id })
    try {
      await unlinkAccount(account)
      set((s) => ({
        linkedAccounts: s.linkedAccounts.filter((a) => a.id !== account.id),
        unlinkingId: null,
      }))
    } catch {
      set({ unlinkingId: null })
    }
  },
}))
