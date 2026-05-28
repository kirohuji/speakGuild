import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { useThemePreset } from '@/providers/theme-preset-provider';
import type { ThemeDecoration } from '@/features/admin/theme-manage/api/theme-api';
import { PixiAnimatedBackground } from '@/components/common/pixi-animated-background';

/**
 * 沉浸式背景组件
 * 从当前激活的主题预设中读取背景和装饰配置，渲染动态背景效果。
 *
 * 用法：
 * ```tsx
 * <div className="relative">
 *   <ImmersiveBackground />
 *   <div className="relative z-10">页面内容</div>
 * </div>
 * ```
 */
export function ImmersiveBackground() {
  const { activePreset } = useThemePreset();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const bg = isDark ? activePreset?.darkBackground : activePreset?.lightBackground;
  const decorations = useMemo<ThemeDecoration[]>(() => {
    const raw = isDark ? activePreset?.darkDecorations : activePreset?.lightDecorations;
    if (!raw?.length) return [];
    return raw;
  }, [activePreset, isDark]);

  const bgType = activePreset?.bgType;
  const isGradient = bg?.startsWith('linear-gradient') || bg?.startsWith('radial-gradient');
  const isAnimation = bgType === 'animation';

  // 如果没有背景且没有装饰且不是动画，不渲染
  if (!bg && !decorations.length && !isAnimation) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* PixiJS 动画背景 */}
      {isAnimation && (
        <PixiAnimatedBackground themeId={activePreset?.id} />
      )}

      {/* 背景层 — 渐变背景带缓慢位移动画 */}
      {bg && !isAnimation && isGradient ? (
        <motion.div
          className="absolute inset-0"
          style={{
            background: bg,
            backgroundSize: '160% 160%',
          }}
          animate={{
            backgroundPosition: ['50% 0%', '42% 12%', '58% 4%', '50% 0%'],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : bg && !isAnimation ? (
        <div
          className="absolute inset-0"
          style={{ background: `url(${bg}) center / cover no-repeat` }}
        />
      ) : null}

      {/* 装饰元素 */}
      {decorations.map((deco, i) => {
        if (deco.type === 'glow') {
          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                background: deco.color,
                width: deco.size ?? '24rem',
                height: deco.size ?? '24rem',
                left: deco.x ?? '50%',
                top: deco.y ?? '50%',
                filter: `blur(${deco.blur ?? '64px'})`,
              }}
              animate={deco.animation ?? { opacity: [0.3, 0.6, 0.3] }}
              transition={{
                duration: 16,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          );
        }
        if (deco.type === 'grid') {
          return (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                backgroundSize: deco.size ?? '40px 40px',
                opacity: 0.03,
                color: deco.color,
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

/**
 * 页面级沉浸式背景 Hook
 * 返回背景样式对象和装饰组件，方便在页面中直接使用
 */
export function useImmersiveStyle() {
  const { activePreset } = useThemePreset();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const bg = isDark ? activePreset?.darkBackground : activePreset?.lightBackground;

  const style = useMemo(() => {
    if (!bg) return {};
    return {
      background: bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')
        ? bg
        : `url(${bg}) center / cover no-repeat`,
    } as React.CSSProperties;
  }, [bg]);

  return { backgroundStyle: style, decorations: activePreset };
}
