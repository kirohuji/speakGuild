import { create } from 'zustand'
import { listLinkedAccounts, type LinkedAccount } from '@/features/account/api'
import { getCurrentAvatar } from '@/features/file-assets/api'
import { pointsApi } from '@/features/points/api'
import { getUserProfile, type UserProfile } from '@/features/profile/api'

interface ProfileCacheState {
  profile: UserProfile | null
  avatarUrl: string | null
  linkedAccounts: LinkedAccount[]
  pointsBalance: number
  profileLoaded: boolean
  avatarLoaded: boolean
  linkedAccountsLoaded: boolean
  pointsLoaded: boolean
  setProfile: (profile: UserProfile | null) => void
  patchProfile: (profile: Partial<UserProfile>) => void
  setAvatarUrl: (avatarUrl: string | null) => void
  setLinkedAccounts: (linkedAccounts: LinkedAccount[]) => void
  setPointsBalance: (pointsBalance: number) => void
  loadProfileHome: (force?: boolean) => Promise<void>
  loadAccount: (force?: boolean) => Promise<void>
  refreshLinkedAccounts: () => Promise<void>
  reset: () => void
}

export const useProfileCacheStore = create<ProfileCacheState>()((set, get) => ({
  profile: null,
  avatarUrl: null,
  linkedAccounts: [],
  pointsBalance: 0,
  profileLoaded: false,
  avatarLoaded: false,
  linkedAccountsLoaded: false,
  pointsLoaded: false,
  setProfile: (profile) => set({ profile, profileLoaded: true }),
  patchProfile: (profile) => set((state) => ({
    profile: state.profile ? { ...state.profile, ...profile } : state.profile,
    profileLoaded: true,
  })),
  setAvatarUrl: (avatarUrl) => set({ avatarUrl, avatarLoaded: true }),
  setLinkedAccounts: (linkedAccounts) => set({ linkedAccounts, linkedAccountsLoaded: true }),
  setPointsBalance: (pointsBalance) => set({ pointsBalance, pointsLoaded: true }),
  loadProfileHome: async (force = false) => {
    const state = get()
    await Promise.allSettled([
      force || !state.profileLoaded
        ? getUserProfile().then((profile) => set({ profile, profileLoaded: true }))
        : Promise.resolve(),
      force || !state.avatarLoaded
        ? getCurrentAvatar().then((avatar) => set({ avatarUrl: avatar?.url ?? null, avatarLoaded: true }))
        : Promise.resolve(),
      force || !state.pointsLoaded
        ? pointsApi.getBalance().then((balance) => set({ pointsBalance: balance.points, pointsLoaded: true }))
        : Promise.resolve(),
    ])
  },
  loadAccount: async (force = false) => {
    const state = get()
    await Promise.allSettled([
      force || !state.profileLoaded
        ? getUserProfile().then((profile) => set({ profile, profileLoaded: true }))
        : Promise.resolve(),
      force || !state.avatarLoaded
        ? getCurrentAvatar().then((avatar) => set({ avatarUrl: avatar?.url ?? null, avatarLoaded: true }))
        : Promise.resolve(),
      force || !state.linkedAccountsLoaded
        ? listLinkedAccounts().then((linkedAccounts) => set({ linkedAccounts, linkedAccountsLoaded: true })).catch(() => set({ linkedAccountsLoaded: true }))
        : Promise.resolve(),
    ])
  },
  refreshLinkedAccounts: async () => {
    try {
      const linkedAccounts = await listLinkedAccounts()
      set({ linkedAccounts, linkedAccountsLoaded: true })
    } catch {
      set({ linkedAccountsLoaded: true })
    }
  },
  reset: () => set({
    profile: null,
    avatarUrl: null,
    linkedAccounts: [],
    pointsBalance: 0,
    profileLoaded: false,
    avatarLoaded: false,
    linkedAccountsLoaded: false,
    pointsLoaded: false,
  }),
}))
