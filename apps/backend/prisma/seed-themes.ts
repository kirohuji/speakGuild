import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建默认沉浸式主题...');

  // 检查是否已存在
  const existing = await prisma.themePreset.findFirst({
    where: { isDefault: true },
  });

  if (existing) {
    console.log(`✅ 默认主题已存在: "${existing.name}"，跳过创建`);
    return;
  }

  const preset = await prisma.themePreset.create({
    data: {
      name: '漫语町 · 默认',
      description: '清新自然的蓝绿渐变，与品牌 GuideReady 配色一致',
      sortOrder: 0,
      isActive: true,
      isDefault: true,
      bgType: 'gradient',

      // ── Light 模式色板 ──
      lightColors: {
        background: '156 43% 97%',
        foreground: '211 32% 18%',
        card: '0 0% 100%',
        cardForeground: '211 32% 18%',
        popover: '0 0% 100%',
        popoverForeground: '211 32% 18%',
        primary: '212 100% 18.6%',
        primaryForeground: '0 0% 100%',
        secondary: '212 100% 98.5%',
        secondaryForeground: '211 32% 18%',
        muted: '212 39% 93.5%',
        mutedForeground: '212 16% 44%',
        accent: '7 100% 63.5%',
        accentForeground: '0 0% 100%',
        destructive: '358 73% 59%',
        destructiveForeground: '0 0% 100%',
        border: '211 37% 90%',
        input: '211 37% 90%',
        ring: '7 100% 63.5%',
        success: '147 74% 36%',
        successForeground: '0 0% 100%',
        warning: '37 91% 55%',
        warningForeground: '211 32% 18%',
        sidebarBackground: '156 43% 97%',
        sidebarForeground: '211 32% 18%',
        sidebarPrimary: '212 100% 18.6%',
        sidebarPrimaryForeground: '0 0% 100%',
        sidebarAccent: '212 100% 98.5%',
        sidebarAccentForeground: '211 32% 18%',
        sidebarBorder: '211 37% 90%',
        sidebarRing: '7 100% 63.5%',
      },

      lightBackground:
        'radial-gradient(circle at 18% 0%, hsl(166 56% 88% / 0.48), transparent 28rem), radial-gradient(circle at 88% 10%, hsl(207 86% 92% / 0.58), transparent 24rem), linear-gradient(180deg, hsl(156 43% 97%) 0%, hsl(204 56% 98%) 52%, hsl(0 0% 100%) 100%)',

      lightDecorations: [
        {
          type: 'glow',
          color: 'hsl(166 56% 88% / 0.48)',
          x: '18%',
          y: '0%',
          size: '28rem',
          blur: '80px',
          animation: { opacity: [0.2, 0.5, 0.2], x: ['18%', '22%', '18%'], y: ['0%', '4%', '0%'] },
        },
        {
          type: 'glow',
          color: 'hsl(207 86% 92% / 0.58)',
          x: '88%',
          y: '10%',
          size: '24rem',
          blur: '80px',
          animation: { opacity: [0.3, 0.6, 0.3], x: ['88%', '84%', '88%'], y: ['10%', '14%', '10%'] },
        },
      ],

      // ── Dark 模式色板 ──
      darkColors: {
        background: '252 43% 5%',
        foreground: '0 0% 100%',
        card: '258 36% 10%',
        cardForeground: '0 0% 100%',
        popover: '258 36% 10%',
        popoverForeground: '0 0% 100%',
        primary: '0 0% 100%',
        primaryForeground: '212 100% 18.6%',
        secondary: '266 31% 14%',
        secondaryForeground: '0 0% 100%',
        muted: '266 27% 14%',
        mutedForeground: '260 18% 78%',
        accent: '7 100% 63.5%',
        accentForeground: '0 0% 100%',
        destructive: '358 73% 59%',
        destructiveForeground: '0 0% 100%',
        border: '260 22% 22%',
        input: '260 22% 22%',
        ring: '7 100% 63.5%',
        success: '147 60% 50%',
        successForeground: '0 0% 100%',
        warning: '37 91% 55%',
        warningForeground: '212 100% 18.6%',
        sidebarBackground: '252 43% 5%',
        sidebarForeground: '0 0% 100%',
        sidebarPrimary: '7 100% 63.5%',
        sidebarPrimaryForeground: '0 0% 100%',
        sidebarAccent: '266 31% 14%',
        sidebarAccentForeground: '0 0% 100%',
        sidebarBorder: '260 22% 22%',
        sidebarRing: '7 100% 63.5%',
      },

      darkBackground:
        'radial-gradient(circle at 50% 0%, hsl(0 0% 100% / 0.08), transparent 22rem), radial-gradient(circle at 18% 14%, hsl(330 84% 62% / 0.14), transparent 26rem), radial-gradient(circle at 88% 76%, hsl(42 96% 60% / 0.08), transparent 26rem), linear-gradient(155deg, hsl(252 43% 5%) 0%, hsl(258 36% 10%) 50%, hsl(336 36% 11%) 100%)',

      darkDecorations: [
        {
          type: 'glow',
          color: 'hsl(330 84% 62% / 0.14)',
          x: '18%',
          y: '14%',
          size: '26rem',
          blur: '80px',
          animation: { opacity: [0.3, 0.55, 0.3], x: ['18%', '22%', '18%'], y: ['14%', '18%', '14%'] },
        },
        {
          type: 'glow',
          color: 'hsl(42 96% 60% / 0.08)',
          x: '88%',
          y: '76%',
          size: '26rem',
          blur: '80px',
          animation: { opacity: [0.2, 0.4, 0.2], x: ['88%', '84%', '88%'], y: ['76%', '72%', '76%'] },
        },
      ],
    },
  });

  console.log(`✅ 默认主题已创建: "${preset.name}" (id: ${preset.id})`);
}

main()
  .catch((e) => {
    console.error('❌ 种子失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
