import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useConfigStore } from '@/stores/config.store'
import { AuthSettingsPanel } from '@/features/profile/components/auth-settings-panel'
import i18n from '@/lib/i18n'
import { isNativeSpeechRecognitionAvailable } from '@/lib/native/vn-voice-input'

export function SettingsTab() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const {
    autoPlay,
    setAutoPlay,
    wifiOnlyMedia,
    setWifiOnlyMedia,
    language,
    setLanguage,
    nativeSpeechRecognitionEnabled,
    setNativeSpeechRecognitionEnabled,
    dailyGoal,
    setDailyGoal,
  } = usePreferencesStore()
  const { config } = useConfigStore()
  const [autoSpeakOnLookup, setAutoSpeakOnLookup] = useState(true)
  const [pronunciationType, setPronunciationType] = useState<'us' | 'uk'>('us')
  const [autoCopyWord, setAutoCopyWord] = useState(false)
  const [learningPreference, setLearningPreference] = useState('balanced')
  const [nativeSpeechRecognitionAvailable, setNativeSpeechRecognitionAvailable] = useState(false)
  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  useEffect(() => {
    let cancelled = false
    isNativeSpeechRecognitionAvailable('en-US')
      .then((available) => {
        if (!cancelled) setNativeSpeechRecognitionAvailable(available)
      })
      .catch(() => {
        if (!cancelled) setNativeSpeechRecognitionAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* 学习偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.autoSpeak')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoPlay')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.autoPlay')}</p>
            </div>
            <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoSpeak')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.autoSpeak')}</p>
            </div>
            <Switch checked={autoSpeakOnLookup} onCheckedChange={setAutoSpeakOnLookup} />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t('profile.pronunciationType')}</Label>
            <Select
              value={pronunciationType}
              onChange={(e) => setPronunciationType(e.target.value as 'us' | 'uk')}
              className="w-48"
            >
              <SelectItem value="us">{t('profile.pronunciationUs')}</SelectItem>
              <SelectItem value="uk">{t('profile.pronunciationUk')}</SelectItem>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoCopyWord')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.autoCopyWord')}</p>
            </div>
            <Switch checked={autoCopyWord} onCheckedChange={setAutoCopyWord} />
          </div>

          <Separator />

          {nativeSpeechRecognitionAvailable && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>原生语音识别</Label>
                  <p className="text-xs text-muted-foreground">录音时优先使用系统 STT，关闭后使用录音上传转写</p>
                </div>
                <Switch
                  checked={nativeSpeechRecognitionEnabled}
                  onCheckedChange={setNativeSpeechRecognitionEnabled}
                />
              </div>

              <Separator />
            </>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.wifiOnlyMedia')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.wifiOnlyMedia')}</p>
            </div>
            <Switch checked={wifiOnlyMedia} onCheckedChange={setWifiOnlyMedia} />
          </div>
        </CardContent>
      </Card>

      {/* 学习目标 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.dailyGoal')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t('profile.dailyGoal')}</Label>
            <Select
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              className="w-48"
            >
              <SelectItem value={10}>{t('profile.dailyGoal10')}</SelectItem>
              <SelectItem value={20}>{t('profile.dailyGoal20')}</SelectItem>
              <SelectItem value={30}>{t('profile.dailyGoal30')}</SelectItem>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t('profile.learningPreference')}</Label>
            <Select
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
              className="w-48"
            >
              <SelectItem value="balanced">{t('profile.balanceMode')}</SelectItem>
              <SelectItem value="exam">{t('profile.examMode')}</SelectItem>
              <SelectItem value="speaking">{t('profile.speakingMode')}</SelectItem>
            </Select>
          </div>

        </CardContent>
      </Card>

      {/* 外观与语言 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.theme')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t('profile.theme')}</Label>
            <Select
              value={theme || 'system'}
              onChange={(e) => setTheme(e.target.value)}
              className="w-48"
            >
              <SelectItem value="light">{t('profile.themeLight')}</SelectItem>
              <SelectItem value="dark">{t('profile.themeDark')}</SelectItem>
              <SelectItem value="system">{t('profile.themeSystem')}</SelectItem>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t('profile.language')}</Label>
            <Select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-48"
            >
              <SelectItem value="zh-CN">{t('profile.langZh')}</SelectItem>
              <SelectItem value="en">{t('profile.langEn')}</SelectItem>
              <SelectItem value="ja">{t('profile.langJa')}</SelectItem>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 数据管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.dataManagement')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('profile.clearCache')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.clearCacheDesc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => {}}>
              {t('common.confirm')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 法律与隐私 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.legalPrivacy')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: t('footer.termsOfService'), to: '/system/terms' },
            { label: t('footer.privacy'), to: '/system/privacy' },
            { label: t('footer.privacyChildren'), to: '/system/privacy-children' },
            { label: t('footer.collectInfo'), to: '/system/collect-info' },
            { label: t('footer.permissionsApply'), to: '/system/permissions' },
            { label: t('footer.sdkList'), to: '/system/sdk-list' },
            { label: t('footer.privacyConcise'), to: '/system/privacy-concise' },
            { label: t('footer.icp'), to: '/system/icp' },
            { label: t('footer.contactUs'), to: '/system/contact' },
          ].map((item, idx, arr) => (
            <div key={item.to}>
              <Link
                to={item.to}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
                <ChevronRight className="h-4 w-4" />
              </Link>
              {idx < arr.length - 1 && <Separator className="my-1" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 账户安全 — 修改密码 / 退出 / 注销 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.security')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthSettingsPanel compact={false} />
        </CardContent>
      </Card>
    </div>
  )
}
