import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.themePreset.findFirst({
    where: { name: '深海梦境' },
  });
  if (existing) {
    console.log('深海梦境 已存在，跳过');
    return;
  }

  await prisma.themePreset.create({
    data: {
      name: '深海梦境',
      description: '深邃蓝紫渐变，夜晚沉浸式学习氛围',
      sortOrder: 1,
      isActive: true,
      isDefault: false,
      bgType: 'gradient',
      lightColors: {
        background: '220 30% 96%',
        foreground: '220 40% 15%',
        card: '0 0% 100%',
        cardForeground: '220 40% 15%',
        popover: '0 0% 100%',
        popoverForeground: '220 40% 15%',
        primary: '230 60% 40%',
        primaryForeground: '0 0% 100%',
        secondary: '220 20% 94%',
        secondaryForeground: '220 40% 15%',
        muted: '220 20% 92%',
        mutedForeground: '220 15% 45%',
        accent: '260 70% 55%',
        accentForeground: '0 0% 100%',
        destructive: '0 70% 55%',
        destructiveForeground: '0 0% 100%',
        border: '220 20% 88%',
        input: '220 20% 88%',
        ring: '260 70% 55%',
        success: '160 60% 40%',
        successForeground: '0 0% 100%',
        warning: '40 85% 55%',
        warningForeground: '220 40% 15%',
        sidebarBackground: '220 30% 96%',
        sidebarForeground: '220 40% 15%',
        sidebarPrimary: '230 60% 40%',
        sidebarPrimaryForeground: '0 0% 100%',
        sidebarAccent: '220 20% 94%',
        sidebarAccentForeground: '220 40% 15%',
        sidebarBorder: '220 20% 88%',
        sidebarRing: '260 70% 55%',
      },
      lightBackground:
        'radial-gradient(circle at 30% 20%, hsl(230 70% 85% / 0.4), transparent 30rem), radial-gradient(circle at 70% 80%, hsl(260 60% 88% / 0.35), transparent 28rem), linear-gradient(135deg, hsl(220 30% 96%) 0%, hsl(230 25% 93%) 50%, hsl(260 20% 96%) 100%)',
      darkColors: {
        background: '230 50% 4%',
        foreground: '0 0% 95%',
        card: '230 40% 8%',
        cardForeground: '0 0% 95%',
        popover: '230 40% 8%',
        popoverForeground: '0 0% 95%',
        primary: '230 50% 75%',
        primaryForeground: '230 50% 4%',
        secondary: '230 30% 12%',
        secondaryForeground: '0 0% 95%',
        muted: '230 25% 14%',
        mutedForeground: '230 15% 65%',
        accent: '260 60% 65%',
        accentForeground: '0 0% 100%',
        destructive: '0 60% 55%',
        destructiveForeground: '0 0% 100%',
        border: '230 25% 18%',
        input: '230 25% 18%',
        ring: '260 60% 65%',
        success: '160 50% 45%',
        successForeground: '0 0% 100%',
        warning: '40 80% 55%',
        warningForeground: '230 50% 4%',
        sidebarBackground: '230 50% 4%',
        sidebarForeground: '0 0% 95%',
        sidebarPrimary: '260 60% 65%',
        sidebarPrimaryForeground: '0 0% 100%',
        sidebarAccent: '230 30% 12%',
        sidebarAccentForeground: '0 0% 95%',
        sidebarBorder: '230 25% 18%',
        sidebarRing: '260 60% 65%',
      },
      darkBackground:
        'radial-gradient(circle at 20% 15%, hsl(260 70% 50% / 0.12), transparent 24rem), radial-gradient(circle at 80% 70%, hsl(200 80% 55% / 0.10), transparent 26rem), linear-gradient(155deg, hsl(230 50% 4%) 0%, hsl(240 40% 6%) 50%, hsl(260 45% 5%) 100%)',
      darkDecorations: [
        {
          type: 'glow',
          color: 'hsl(260 70% 50% / 0.12)',
          x: '20%',
          y: '15%',
          size: '24rem',
          blur: '80px',
          animation: { opacity: [0.25, 0.5, 0.25], x: ['20%', '24%', '20%'], y: ['15%', '20%', '15%'] },
        },
        {
          type: 'glow',
          color: 'hsl(200 80% 55% / 0.10)',
          x: '80%',
          y: '70%',
          size: '26rem',
          blur: '80px',
          animation: { opacity: [0.2, 0.4, 0.2], x: ['80%', '76%', '80%'], y: ['70%', '66%', '70%'] },
        },
      ],
    },
  });

  console.log('✅ 深海梦境 主题已创建');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
