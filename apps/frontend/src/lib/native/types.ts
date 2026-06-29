// ──────────────────────────────────────────────
// 原生能力桥接层 — 共享类型定义
// ──────────────────────────────────────────────

import type { StatusBarPlugin, Style as StatusBarStyle, Animation as StatusBarAnimation } from '@capacitor/status-bar';
import type { FilesystemPlugin, Directory } from '@capacitor/filesystem';
import type { RevenueCatAPI } from './revenuecat';

export type { StatusBarStyle, StatusBarAnimation, Directory };

/** SplashScreen 抽象接口 */
export interface SplashScreenAPI {
  show(): Promise<void>;
  hide(options?: { fadeOutDuration?: number }): Promise<void>;
}

/** StatusBar 抽象接口 */
export interface StatusBarAPI {
  setStyle(options: { style: StatusBarStyle }): Promise<void>;
  setBackgroundColor(options: { color: string }): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  getInfo(): Promise<{ visible: boolean; style: StatusBarStyle; color: string; overlays: boolean }>;
}

/** Updater 抽象接口（Capgo OTA 热更新） */
export interface UpdaterAPI {
  /** 通知插件当前 bundle 启动成功（必须在 appReadyTimeout 内调用） */
  notifyAppReady(): Promise<void>;
  /** 获取当前包版本信息 */
  getCurrent(): Promise<{ version: string; downloaded: string; builtinVersion: string }>;
  /** 手动检查更新（由插件自动处理的补充入口） */
  checkUpdate(): Promise<{ newVersion?: string; url?: string; isMandatory?: boolean; shouldNotify?: boolean }>;
  /** 注册更新可用回调（含强制更新标记） */
  onUpdateAvailable(callback: (info: { version: string; url?: string; isMandatory?: boolean; shouldNotify?: boolean }) => void): void;
  /** 注册下载进度回调 */
  onDownload(callback: (percent: number) => void): void;
  /** 注册下载完成回调 */
  onDownloadComplete(callback: (info: { version: string }) => void): void;
  /** 注册更新失败回调 */
  onFailed(callback: (error: any) => void): void;
}

/** Preference 抽象接口（键值存储） */
export interface PreferencesAPI {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/** Push Notifications 抽象接口 */
export interface PushNotificationsAPI {
  /** 注册推送，获取 token */
  register(): Promise<string>;
  /** 获取当前推送 token */
  getToken(): Promise<string | null>;
  /** 移除推送权限 */
  unregister(): Promise<void>;
  /** 监听推送到达 */
  onPushReceived(callback: (notification: PushNotificationPayload) => void): void;
  /** 监听用户点击推送 */
  onPushActionPerformed(callback: (action: PushNotificationAction) => void): void;
}

export interface PushNotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

export interface PushNotificationAction {
  notification: PushNotificationPayload;
  actionId: string;
}

/** Filesystem 抽象接口 */
export interface FilesystemAPI {
  readFile(path: string, directory?: Directory): Promise<string>;
  writeFile(options: { path: string; data: string; directory?: Directory }): Promise<void>;
  deleteFile(options: { path: string; directory?: Directory }): Promise<void>;
  exists(path: string, directory?: Directory): Promise<boolean>;
  mkdir(options: { path: string; directory?: Directory }): Promise<void>;
  rmdir(options: { path: string; directory?: Directory }): Promise<void>;
  readdir(options: { path: string; directory?: Directory }): Promise<{ name: string; type: 'file' | 'directory' }[]>;
  getTempPath(): string;
  getAppPath(): string;
}

/** 完整的原生能力接口 */
export interface NativeCapabilities {
  splashScreen: SplashScreenAPI;
  statusBar: StatusBarAPI;
  updater: UpdaterAPI;
  preferences: PreferencesAPI;
  pushNotifications: PushNotificationsAPI;
  filesystem: FilesystemAPI;
  revenueCat: RevenueCatAPI;
}
