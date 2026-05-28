import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import {
  Sun, Moon, Monitor, CheckCircle2, Volume2, VolumeX,
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/cn';
import { useThemePreset } from '@/providers/theme-preset-provider';
import type { ThemePreset } from '@/features/admin/theme-manage/api/theme-api';

interface AppearanceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppearanceDrawer({ open, onOpenChange }: AppearanceDrawerProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { presets, activePreset, setActivePreset, loading: presetsLoading } = useThemePreset();

  // ── BGM state（暂存本地，后续可接入 store）──
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.3);

  const modeLabel: Record<string, string> = {
    light: t('profile.themeLight'),
    dark: t('profile.themeDark'),
    system: t('profile.themeSystem'),
  };

  const handleSelectPreset = async (id: string) => {
    try {
      await setActivePreset(id);
    } catch {
      // 静默失败
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] rounded-t-[28px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-base">{t('profile.theme')}</DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="max-h-[70vh] px-4 pb-8">
          <div className="space-y-4">

            {/* ═══ 1. 沉浸式主题套装 ═══ */}
            <section>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                沉浸式主题
              </p>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <ThemePresetCard
                    key={preset.id}
                    name={preset.name}
                    isActive={activePreset?.id === preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    lightBg={preset.lightBackground || undefined}
                    darkBg={preset.darkBackground || undefined}
                  />
                ))}
              </div>
            </section>

            {/* ═══ 2. Light / Dark 模式 ═══ */}
            <section>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                显示模式
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
                背景音效
              </p>
              <div className="space-y-3 overflow-hidden rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {bgmEnabled ? (
                      <Volume2 className="size-4 text-foreground" />
                    ) : (
                      <VolumeX className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">{bgmEnabled ? '已开启' : '已关闭'}</span>
                  </div>
                  <Switch
                    checked={bgmEnabled}
                    onCheckedChange={setBgmEnabled}
                  />
                </div>

                {bgmEnabled && (
                  <div className="flex items-center gap-3 pt-1">
                    <Volume2 className="size-4 shrink-0 text-muted-foreground" />
                    <Slider
                      value={[bgmVolume]}
                      onValueChange={([v]) => setBgmVolume(v)}
                      min={0}
                      max={1}
                      step={0.05}
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                      {Math.round(bgmVolume * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </section>

          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

// ─── 主题预设卡片 ───

function ThemePresetCard({
  name,
  isActive,
  onClick,
  lightBg,
  darkBg,
}: {
  name: string;
  isActive: boolean;
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
      <div className="flex h-10">
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
        {isActive && <CheckCircle2 className="size-2.5 shrink-0 text-primary" />}
        <span className={cn(
          'truncate text-[10px] leading-tight',
          isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
        )}>
          {name}
        </span>
      </div>
    </button>
  );
}
