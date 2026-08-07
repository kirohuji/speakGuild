import { create } from 'zustand'
import { getUserProfile, updateUserProfile, type UserProfile } from '@/features/profile/api'
import { getCurrentAvatar, setCurrentAvatar, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import {
  listLinkedAccounts, linkSocialAccount, unlinkAccount,
  type LinkedAccount,
} from '@/features/account/api'
import { getCurrentMembership, type CurrentMembership } from '@/features/membership/api'
import { pointsApi } from '@/features/points/api'
import { localDb } from '@/lib/offline/unified-storage'

/**
 * 统一用户信息 Store（单一数据源）
 *
 * 统一管理：基础资料（profile）、头像（avatarUrl）、绑定账号（linkedAccounts）、
 * 会员（membership）、积分（pointsBalance）。
 *
 * 持久化：用户信息快照写入本地 SQLite `kv` 表（key = `user_profile:{userId}`），
 * 冷启动离线时可先 hydrate 回显，再后台 syncRemote 拉最新覆盖。
 * 登出清理由 offlineStorageService.clearUserData() 按 `user_profile:` 前缀执行。
 */

export const USER_PROFILE_KV_PREFIX = 'user_profile:'

export interface PersistedUserData {
  profile: UserProfile | null
  avatarUrl: string | null
  linkedAccounts: LinkedAccount[]
  membership: CurrentMembership | null
  pointsBalance: number
  fetchedAt: number
}

function kvKey(userId: string) {
  return `${USER_PROFILE_KV_PREFIX}${userId}`
}

async function readPersisted(userId: string): Promise<PersistedUserData | null> {
  try {
    return await localDb.get<PersistedUserData>('kv', kvKey(userId))
  } catch (error) {
    console.warn('[user-store] hydrate failed:', error)
    return null
  }
}

function stripUndefined(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

async function persistUserData(userId: string, data: Partial<PersistedUserData>): Promise<void> {
  if (!userId) return
  try {
    const existing = await readPersisted(userId)
    await localDb.put('kv', {
      id: kvKey(userId),
      ...existing,
      ...stripUndefined(data as unknown as Record<string, unknown>),
      updated_at: new Date().toISOString(),
    } as PersistedUserData & { id: string })
  } catch (error) {
    console.warn('[user-store] persist failed:', error)
  }
}

/** 远程数据节流阈值：5 分钟内不重复拉取（force 除外） */
const SYNC_REMOTE_THROTTLE_MS = 5 * 60_000

interface UserStoreState extends PersistedUserData {
  currentUserId: string | null
  /** 是否已从本地持久层恢复（hydrate 完成） */
  hydrated: boolean
  /** 是否正在拉取远程数据 */
  loading: boolean
  avatarUploading: boolean
  linkingProvider: string | null
  unlinkingId: string | null

  hydrate: (userId: string) => Promise<void>
  syncRemote: (opts?: { force?: boolean }) => Promise<void>
  ensureLoaded: (userId: string, opts?: { force?: boolean }) => Promise<void>
  setProfile: (profile: UserProfile | null) => void
  patchProfile: (patch: Partial<UserProfile>) => void
  setMembership: (membership: CurrentMembership | null) => void
  setPointsBalance: (points: number) => void
  uploadAvatar: (file: File) => Promise<void>
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'username'>>) => Promise<void>
  refreshLinkedAccounts: () => Promise<void>
  linkSocial: (provider: 'wechat' | 'apple') => Promise<void>
  unlinkSocial: (account: LinkedAccount) => Promise<void>
  reset: () => void
}

function persistSnapshot() {
  const s = useUserStore.getState()
  if (!s.currentUserId) return
  void persistUserData(s.currentUserId, {
    profile: s.profile,
    avatarUrl: s.avatarUrl,
    linkedAccounts: s.linkedAccounts,
    membership: s.membership,
    pointsBalance: s.pointsBalance,
    fetchedAt: s.fetchedAt,
  })
}

export const useUserStore = create<UserStoreState>()((set, get) => ({
  profile: null,
  avatarUrl: null,
  linkedAccounts: [],
  membership: null,
  pointsBalance: 0,
  fetchedAt: 0,
  currentUserId: null,
  hydrated: false,
  loading: false,
  avatarUploading: false,
  linkingProvider: null,
  unlinkingId: null,

  /** 从本地持久层恢复用户信息快照（离线可用，秒回显） */
  async hydrate(userId) {
    const { currentUserId, hydrated } = get()
    if (currentUserId === userId && hydrated) return
    const saved = await readPersisted(userId)
    set({
      currentUserId: userId,
      hydrated: true,
      profile: saved?.profile ?? null,
      avatarUrl: saved?.avatarUrl ?? null,
      linkedAccounts: saved?.linkedAccounts ?? [],
      membership: saved?.membership ?? null,
      pointsBalance: saved?.pointsBalance ?? 0,
      fetchedAt: saved?.fetchedAt ?? 0,
    })
  },

  /** 在线拉取远程用户信息并覆盖本地（部分失败保留旧值） */
  async syncRemote({ force = false } = {}) {
    const { currentUserId, hydrated, fetchedAt } = get()
    if (!currentUserId) return
    if (!force && !hydrated) return
    if (!force && fetchedAt > 0 && Date.now() - fetchedAt < SYNC_REMOTE_THROTTLE_MS) return
    set({ loading: true })
    try {
      const [profile, avatar, accounts, membership, points] = await Promise.allSettled([
        getUserProfile(),
        getCurrentAvatar(),
        listLinkedAccounts(),
        getCurrentMembership(),
        pointsApi.getBalance(),
      ])
      const patch: Partial<PersistedUserData> = { fetchedAt: Date.now() }
      if (profile.status === 'fulfilled') patch.profile = profile.value
      if (avatar.status === 'fulfilled') patch.avatarUrl = avatar.value?.url ?? null
      if (accounts.status === 'fulfilled') patch.linkedAccounts = accounts.value
      if (membership.status === 'fulfilled') patch.membership = membership.value
      if (points.status === 'fulfilled') patch.pointsBalance = points.value.points
      set(patch as Partial<UserStoreState>)
      void persistUserData(currentUserId, patch)
    } finally {
      set({ loading: false })
    }
  },

  /** 统一入口：先本地恢复（如需要），再拉远程 */
  async ensureLoaded(userId, opts = {}) {
    if (!userId) return
    const { currentUserId, hydrated } = get()
    if (currentUserId !== userId || !hydrated) {
      await get().hydrate(userId)
    }
    await get().syncRemote({ force: opts.force })
  },

  setProfile(profile) {
    set({ profile })
    persistSnapshot()
  },

  patchProfile(patch) {
    set((s) => ({ profile: s.profile ? { ...s.profile, ...patch } : s.profile }))
    persistSnapshot()
  },

  setMembership(membership) {
    set({ membership })
    persistSnapshot()
  },

  setPointsBalance(pointsBalance) {
    set({ pointsBalance })
    persistSnapshot()
  },

  async uploadAvatar(file) {
    set({ avatarUploading: true })
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'avatar' })
      const current = await setCurrentAvatar(asset.id)
      set({ avatarUrl: current?.url ?? null, avatarUploading: false })
      persistSnapshot()
    } catch (error) {
      set({ avatarUploading: false })
      throw error
    }
  },

  async updateProfile(data) {
    const updated = await updateUserProfile(data)
    set((s) => ({ profile: s.profile ? { ...s.profile, ...updated } : updated }))
    persistSnapshot()
  },

  async refreshLinkedAccounts() {
    try {
      const accounts = await listLinkedAccounts()
      set({ linkedAccounts: accounts })
      persistSnapshot()
    } catch {
      // 离线时保留本地缓存
    }
  },

  async linkSocial(provider) {
    const { linkingProvider } = get()
    if (linkingProvider) return
    set({ linkingProvider: provider })
    try {
      await linkSocialAccount(provider)
      const accounts = await listLinkedAccounts()
      set({ linkedAccounts: accounts })
      persistSnapshot()
    } catch (error) {
      // 抛给 UI 层提示（如「该微信已绑定其他账号」）
      throw error
    } finally {
      set({ linkingProvider: null })
    }
  },

  async unlinkSocial(account) {
    const { unlinkingId } = get()
    if (unlinkingId) return
    set({ unlinkingId: account.id })
    try {
      await unlinkAccount(account)
      set((s) => ({
        linkedAccounts: s.linkedAccounts.filter((a) => a.id !== account.id),
      }))
      persistSnapshot()
    } catch (error) {
      // 抛给 UI 层提示（如「无法解绑最后一个登录账号」）
      throw error
    } finally {
      set({ unlinkingId: null })
    }
  },

  reset() {
    set({
      profile: null,
      avatarUrl: null,
      linkedAccounts: [],
      membership: null,
      pointsBalance: 0,
      fetchedAt: 0,
      currentUserId: null,
      hydrated: false,
      loading: false,
      avatarUploading: false,
      linkingProvider: null,
      unlinkingId: null,
    })
  },
}))
