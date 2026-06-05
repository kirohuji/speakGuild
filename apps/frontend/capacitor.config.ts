import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'lourd.manyu.app',
  appName: '漫语町',
  webDir: 'dist',

  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    // ⚠️ 必须先配置 Associated Domains 才能使 Universal Links 生效：
    // 1. 在 Xcode 中打开 ios/App/App.xcworkspace
    // 2. 选择 App Target → Signing & Capabilities → + Capability → Associated Domains
    // 3. 添加以下条目（根据实际使用的第三方服务增减）：
    //    - applinks:hope.lourd.top           (Alipay 支付回调)
    //    - applinks:hope.lourd.top           (WeChat 登录/分享)
    // 4. 运行 npx cap sync ios 同步后，cap open ios 在 Xcode 中配置
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

    // CapacitorWechat: {
    //   appId: '',  // 微信开放平台申请的 AppID
    //   universalLink: 'https://hope.lourd.top:3605/wechat/',  // 需与微信开放平台配置的 Universal Link 一致
    // },

    SocialLogin: {
      providers: {
        apple: true,
        google: false,
        facebook: false,
        twitter: false,
      },
      logLevel: 1,
    },

    // Preferences — 键值存储 (不另需配置)
    // Filesystem — 文件系统 (不另需配置)

    // ── OTA 热更新（Capgo CapacitorUpdater，self-hosted 模式）──
    CapacitorUpdater: {
      autoUpdate: 'off',                // 关闭自动检查，完全由 updater.ts 手动控制
      appReadyTimeout: 10000,           // 10 秒内必须调用 notifyAppReady，否则回滚
      autoDeleteFailed: true,           // 自动清理下载失败的包
      autoDeletePrevious: true,         // 安装成功后自动清理旧包
    },
  },
};

export default config;
