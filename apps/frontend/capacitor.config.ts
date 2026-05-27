import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.manyu.app',
  appName: '漫语町',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    // Use automatic safe area handling via Capacitor's WebView
    scrollEnabled: false,
  },
};

export default config;
