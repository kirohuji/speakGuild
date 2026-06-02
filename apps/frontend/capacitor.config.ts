import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.manyu.app',
  appName: '漫语町',
  webDir: 'dist',

  ios: {
    contentInset: 'never',
    scrollEnabled: false,
  },

  // ── Capacitor 插件配置 ──
  plugins: {
    // Splash Screen — 启动画面
    SplashScreen: {
      launchShowDuration: 3000,    // 最短显示 3 秒
      launchAutoHide: false,       // 手动调用 hide() 控制隐藏时机
      backgroundColor: '#0F172A',  // 深蓝背景
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },

    // Status Bar — 状态栏
    StatusBar: {
      style: 'Dark',               // iOS 默认深色状态栏文字
      backgroundColor: '#0F172A',
    },

    // Push Notifications — 推送通知
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    CapacitorWechat: {
      appId: '',  // 微信开放平台申请的 AppID''
      universalLink: '',
    },

    // Preferences — 键值存储 (不另需配置)
    // Filesystem — 文件系统 (不另需配置)

    // ── OTA 热更新（Capgo CapacitorUpdater，self-hosted 模式）──
    CapacitorUpdater: {
      autoUpdate: 'atBackground',       // 后台下载，切后台后安装，下次启动生效
      updateUrl: `https://api.manyu.app/mobile-updates/check`,
      appReadyTimeout: 10000,           // 10 秒内必须调用 notifyAppReady，否则回滚
      autoDeleteFailed: true,           // 自动清理下载失败的包
      autoDeletePrevious: true,         // 安装成功后自动清理旧包
    },
  },
};

export default config;
