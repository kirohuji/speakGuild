import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.manyu.app',
  appName: '漫语町',
  webDir: 'dist',

  ios: {
    contentInset: 'always',
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

    // Preferences — 键值存储 (不另需配置)
    // Filesystem — 文件系统 (不另需配置)
  },

  // Capgo 热更新配置（若使用 Capgo 服务）
  // CapacitorUpdater: {
  //   autoUpdate: true,
  // },
};

export default config;
