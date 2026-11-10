import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Sun, Moon, Monitor, CheckCircle2, Volume2, VolumeX, ChevronLeft, Lock,
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/cn';
import { useThemePreset } from '@/providers/theme-preset-provider';
import { useThemePresetStore } from '@/stores/theme-preset.store';
import { usePreferencesStore } from '@/stores/preferences.store';
import { useUserStore } from '@/stores/user.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useAuth } from '@/providers/auth-provider';
import type { ThemePreset } from '@/features/admin/theme-manage/api/theme-api';
import { MembershipPurchaseDrawer } from '@/features/membership/components/membership-purchase-drawer';

/** 普通用户可用：默认主题、深海梦境。其余主题走会员解锁。 */
const FREE_THEME_IDS = new Set(['theme-default', 'theme-deepsea']);

function isMemberLockedTheme(preset: Pick<ThemePreset, 'id' | 'isDefault'>) {
  return !preset.isDefault && !FREE_THEME_IDS.has(preset.id);
}

interface AppearanceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppearanceDrawer({ open, onOpenChange }: AppearanceDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[88svh] flex-col rounded-t-[28px]">
        <DrawerHeader className="relative flex h-10 shrink-0 items-center justify-center px-4 py-0">
          <button
            type="button"
            aria-label={t('common.back')}
            onClick={() => onOpenChange(false)}
            className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <DrawerTitle className="text-center text-base font-semibold leading-6">{t('profile.theme')}</DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 min-h-0 px-4 pb-8">
          <AppearanceContent />
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

// ─── 外观主题内容（可独立用于 inline 页面） ───

export function AppearanceContent() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { session } = useAuth();
  const { presets, activePreset, setActivePreset } = useThemePreset();
  const ensurePresets = useThemePresetStore((s) => s.ensurePresets);
  const membership = useUserStore((s) => s.membership);
  const [memberOpen, setMemberOpen] = useState(false);

  const { bgmEnabled, bgmVolume, setBgmEnabled, setBgmVolume } = usePreferencesStore();
  const canUseAllThemes = session?.user?.role === 'admin' || membership?.level === 'admin' || !!membership?.isActive;

  useEffect(() => {
    useOnboardingStore.getState().tryStartSegment('appearance-themes');
  }, []);

  // 打开主题选择器时才加载列表（缓存优先）
  useEffect(() => {
    ensurePresets();
  }, [ensurePresets]);

  const effectiveBgmVolume = bgmVolume ?? activePreset?.bgmVolume ?? 0.3;

  const modeLabel: Record<string, string> = {
    light: t('profile.themeLight'),
    dark: t('profile.themeDark'),
    system: t('profile.themeSystem'),
  };

  const handleSelectPreset = async (preset: ThemePreset) => {
    if (!canUseAllThemes && isMemberLockedTheme(preset)) {
      setMemberOpen(true);
      return;
    }
    try {
      await setActivePreset(preset.id);
    } catch {
      // 静默失败
    }
  };

  return (
    <div className="space-y-4">

      {/* ═══ 1. 沉浸式主题套装 ═══ */}
      <section data-spotlight="appearance-themes">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('profile.immersiveTheme')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => {
            const locked = !canUseAllThemes && isMemberLockedTheme(preset);
            return (
              <ThemePresetCard
                key={preset.id}
                name={preset.name}
                isActive={activePreset?.id === preset.id}
                locked={locked}
                onClick={() => handleSelectPreset(preset)}
                lightBg={preset.lightBackground || undefined}
                darkBg={preset.darkBackground || undefined}
              />
            );
          })}
        </div>
      </section>

      {/* ═══ 2. Light / Dark 模式 ═══ */}
      <section>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('profile.displayMode')}
        </p>
        <div className="overflow-hidden rounded-xl bg-muted/30">
          {[
            { value: 'light', icon: Sun, label: modeLabel.light },
            { value: 'dark', icon: Moon, label: modeLabel.dark },
            { value: 'system', icon: Monitor, label: modeLabel.system },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTheme(item.value)}
              className={cn(
                'flex w-full items-center gap-2.5 border-b border-border/40 px-4 py-2.5 text-left text-sm transition-colors active:bg-muted/50 last:border-b-0',
                (theme || 'system') === item.value && 'font-semibold text-foreground',
              )}
            >
              <div className={cn(
                'flex size-7 items-center justify-center rounded-lg',
                (theme || 'system') === item.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}>
                <item.icon className="size-3.5" />
              </div>
              <span className="flex-1">{item.label}</span>
              {(theme || 'system') === item.value && (
                <CheckCircle2 className="size-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ 3. 背景音效 ═══ */}
      <section>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('profile.bgm')}
        </p>
        <div className="space-y-3 overflow-hidden rounded-xl bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bgmEnabled ? (
                <Volume2 className="size-4 text-foreground" />
              ) : (
                <VolumeX className="size-4 text-muted-foreground" />
              )}
              <span className="text-sm">{bgmEnabled ? t('profile.bgmOn') : t('profile.bgmOff')}</span>
            </div>
            <Switch
              checked={bgmEnabled}
              onCheckedChange={setBgmEnabled}
              disabled={!activePreset?.bgmUrl}
            />
          </div>

          {bgmEnabled && (
            <div className="flex items-center gap-3 pt-1">
              <Volume2 className="size-4 shrink-0 text-muted-foreground" />
              <Slider
                value={[effectiveBgmVolume]}
                onValueChange={([v]) => setBgmVolume(v)}
                min={0}
                max={1}
                step={0.05}
                className="flex-1"
              />
              <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                {Math.round(effectiveBgmVolume * 100)}%
              </span>
            </div>
          )}
        </div>
      </section>

      <MembershipPurchaseDrawer open={memberOpen} onOpenChange={setMemberOpen} />

    </div>
  );
}

// ─── 主题预设卡片 ───

function ThemePresetCard({
  name,
  isActive,
  locked,
  onClick,
  lightBg,
  darkBg,
}: {
  name: string;
  isActive: boolean;
  locked: boolean;
  onClick: () => void;
  lightBg?: string;
  darkBg?: string;
}) {
  const isGradient = (bg?: string) =>
    bg?.startsWith('linear-gradient') || bg?.startsWith('radial-gradient');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border-2 transition-all active:scale-[0.97]',
        isActive
          ? 'border-primary shadow-sm'
          : 'border-transparent hover:border-primary/30',
      )}
    >
      {/* 双色预览 */}
      <div className={cn('flex h-10', locked && 'grayscale')}>
        <div
          className="flex-1"
          style={{
            background: lightBg
              ? isGradient(lightBg) ? lightBg : `url(${lightBg}) center/cover`
              : 'hsl(156 43% 97%)',
          }}
        />
        <div
          className="flex-1"
          style={{
            background: darkBg
              ? isGradient(darkBg) ? darkBg : `url(${darkBg}) center/cover`
              : 'hsl(252 43% 5%)',
          }}
        />
      </div>

      {/* 标签 */}
      <div className="flex items-center justify-center gap-1 px-1.5 py-1">
        {locked ? (
          <Lock className="size-3 shrink-0 text-muted-foreground" />
        ) : isActive ? (
          <CheckCircle2 className="size-2.5 shrink-0 text-primary" />
        ) : null}
        <span className={cn(
          'truncate text-[10px] leading-tight',
          locked ? 'text-muted-foreground' : isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
        )}>
          {name}
        </span>
      </div>
    </button>
  );
}
