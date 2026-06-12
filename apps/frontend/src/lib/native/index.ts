// ──────────────────────────────────────────────
// Native Bridge — 统一导出
//
// 使用方式:
//
// 1. React 组件内:
//    import { useNativeBridge } from '@/lib/native';
//    const { preferences, filesystem } = useNativeBridge();
//
// 2. 非 React 场景:
//    import { getNativeBridge } from '@/lib/native';
//    const { preferences } = getNativeBridge();
//
// 3. 平台检测:
//    import { isNative, isIOS, isAndroid, getPlatform } from '@/lib/native';
// ──────────────────────────────────────────────

// 平台检测
export { isNative, isIOS, isAndroid, isWeb, getPlatform } from './platform';

// React Provider + Hook
export { NativeBridgeProvider, useNativeBridge, useNativeInitReady, getNativeBridge } from './native-bridge.provider';

// 类型
export type {
  NativeCapabilities,
  SplashScreenAPI,
  StatusBarAPI,
  UpdaterAPI,
  PreferencesAPI,
  PushNotificationsAPI,
  FilesystemAPI,
  PushNotificationPayload,
  PushNotificationAction,
  StatusBarStyle,
  StatusBarAnimation,
  Directory,
} from './types';

// 各服务实例（直接导入可绕过 Context）
export { splashScreen } from './splash-screen';
export { statusBar } from './status-bar';
export { updater } from './updater';
export { preferences } from './preferences';
export { pushNotifications } from './push-notifications';
export { filesystem } from './filesystem';
export { revenueCat } from './revenuecat';
export type { RevenueCatAPI, RevenueCatState, RevenueCatProductKey } from './revenuecat';
export {
  REVENUECAT_PRODUCT_IDS,
  REVENUECAT_UNLIMITED_ENTITLEMENT_ID,
} from './revenuecat';
// export { requestNativeWechatAuthCode } from './wechat'; // wechat plugin removed
export { requestNativeAppleSignIn } from './apple';
