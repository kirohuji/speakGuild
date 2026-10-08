import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { useThemePreset } from '@/providers/theme-preset-provider';
import type { ThemeDecoration } from '@/features/admin/theme-manage/api/theme-api';
import { PixiAnimatedBackground } from '@/components/common/pixi-animated-background';
import { resolveThemeBackground } from '@/lib/theme-bg-resolve';

/**
 * 沉浸式背景组件
 * 从当前激活的主题预设中读取背景和装饰配置，按优先级渲染：
 * 视频 > 图片 > PixiJS 动画 > CSS 渐变
 *
 * URL 参数:
 *   ?test=1  — 强制显示月亮和银河（仅对星空主题生效）
 */
export function ImmersiveBackground() {
  const { activePreset } = useThemePreset();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const testMode = location.hash.includes('test=1');

  const decorations = useMemo<ThemeDecoration[]>(() => {
    const raw = isDark ? activePreset?.darkDecorations : activePreset?.lightDecorations;
    if (!raw?.length) return [];
    return raw;
  }, [activePreset, isDark]);

  const resolved = useMemo(
    () => resolveThemeBackground(activePreset, isDark ? 'dark' : 'light'),
    [activePreset, isDark],
  );

  if (!resolved && !decorations.length) return null;

  const isGradient = resolved?.type === 'gradient';
  const isAnimation = resolved?.type === 'animation';
  const isImage = resolved?.type === 'image';
  const isVideo = resolved?.type === 'video';
  const bg = resolved?.src;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* PixiJS 动画背景 */}
      {isAnimation && (
        <PixiAnimatedBackground themeId={activePreset?.id} testMode={testMode} />
      )}

      {/* 背景视频（最高优先级） */}
      {isVideo && bg ? (
        <video
          className="absolute inset-0 size-full object-cover"
          src={bg}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : null}

      {/* 背景图片 */}
      {isImage && bg ? (
        <div
          className="absolute inset-0"
          style={{ background: `url(${bg}) center / cover no-repeat` }}
        />
      ) : null}

      {/* CSS 渐变 — 带缓慢位移动画 */}
      {isGradient && bg ? (
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

  const resolved = useMemo(
    () => resolveThemeBackground(activePreset, isDark ? 'dark' : 'light'),
    [activePreset, isDark],
  );

  const style = useMemo(() => {
    if (!resolved?.src) return {};
    if (resolved.type === 'gradient') {
      return { background: resolved.src } as React.CSSProperties;
    }
    if (resolved.type === 'image' || resolved.type === 'video') {
      return {
        background: `url(${resolved.src}) center / cover no-repeat`,
      } as React.CSSProperties;
    }
    return {};
  }, [resolved]);

  return { backgroundStyle: style, decorations: activePreset, resolved };
}
