import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useUserStore } from '@/stores/user.store'
import type { LinkedAccount } from '@/features/account/api'

/**
 * 绑定/解绑第三方账号的共享操作（toast 提示统一处理）。
 * 列表与头像的刷新在 store 内部完成，这里只负责提示。
 */
export function useAccountBindingActions() {
  const { t } = useTranslation()
  const linkSocial = useUserStore((s) => s.linkSocial)
  const unlinkSocial = useUserStore((s) => s.unlinkSocial)

  const handleLinkSocial = useCallback(async (provider: 'wechat' | 'apple') => {
    try {
      await linkSocial(provider)
      toast.success(t('account.linkSuccess', { defaultValue: '绑定成功' }))
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || t('account.linkFailed', { defaultValue: '绑定失败，请重试' }))
    }
  }, [linkSocial, t])

  const handleUnlink = useCallback(async (account: LinkedAccount) => {
    try {
      await unlinkSocial(account)
      toast.success(t('account.unlinkSuccess', { defaultValue: '解绑成功' }))
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || t('account.unlinkFailed', { defaultValue: '解绑失败，请重试' }))
    }
  }, [unlinkSocial, t])

  return { handleLinkSocial, handleUnlink }
}
