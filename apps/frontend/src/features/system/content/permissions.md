#### 导游说权限申请及使用情况说明

为保障导游说能实现与安全稳定运行之目的，我们可能会申请或使用操作系统的相关权限。

为保障您的知情权，我们通过下列列表将产品可能申请、使用的相关操作系统权限进行展示，您可以根据实际需要对相关权限进行管理。

根据产品的升级，申请、使用权限的类型与目的可能会有变动，我们将及时根据这些变动对列表进行调整，以确保您及时获悉权限的申请与使用情况。

请您知悉，我们为业务与产品的功能与安全需要，我们可能也会使用第三方SDK，这些第三方也可能会申请或使用相关操作系统权限。

在使用产品的过程中，您可能会使用第三方开发的H5页面或小程序，这些第三方开发的插件或小程序也可能因业务功能所必需而申请或使用相关操作系统权限。

##### Android 应用权限列表

| 权限名称 | 权限功能 | 使用场景及目的 | 备注 |
|---------|---------|-------------|------|
| android.permission.CAMERA | 使用拍摄照片和视频、完成扫描二维码 | 为了使您可以使用摄像头进行扫码、拍摄，用于实现登录、图片反馈及上传头像的功能 | |
| android.permission.READ_EXTERNAL_STORAGE | 提供读取手机储存空间SD卡内数据的功能 | 允许 App 读取手机存储中的图片和文件，主要用于帮助您上传头像、图片，以及在手机本地记录日志的功能 | |
| android.permission.WRITE_EXTERNAL_STORAGE | 提供写入外部储存SD卡功能 | 允许 App 写入/下载/保存/缓存/修改/删除图片、文件、日志 | |
| android.permission.RECORD_AUDIO | 使用麦克风录制音频 | 用于帮助您实现口语录音、AI 发音评分功能 | |
| android.permission.INTERNET | 访问网络权限 | 实现应用程序联网 | |
| android.permission.ACCESS_WIFI_STATE | 获取WiFi状态权限 | 监控网络变化，提示用户当前网络环境 | |
| android.permission.ACCESS_NETWORK_STATE | 获取网络状态权限 | 监控网络变化，提示用户当前网络环境 | |
| android.permission.WAKE_LOCK | 唤醒锁定权限 | 允许程序在手机屏幕关闭后后台进程仍然运行，保持屏幕唤醒 | |
| android.permission.CHANGE_NETWORK_STATE | 改变网络连接状态 | 允许应用改变网络连接状态（手机号一键登录、支付） | |
| android.permission.POST_NOTIFICATIONS | 通知的运行时权限 | Android 13 引入的新的权限，用于从应用内发送通知（用于推送和事件提醒） | |
| android.permission.FOREGROUND_SERVICE | 前台服务权限 | 允许应用使用前台服务（音频播放需要） | |

##### iOS 应用权限列表

| 权限名称 | 权限功能 | 使用场景及目的 |
|---------|---------|-------------|
| NSCameraUsageDescription | 使用摄像头 | 需要访问您的相机以进行扫码和拍摄照片 |
| NSPhotoLibraryUsageDescription | 读取相册中内容 | 允许 App 读取存储中的图片、文件内容，主要用于帮助您上传头像 |
| NSPhotoLibraryAddUsageDescription | 向相册中添加内容 | 允许App写入/下载/保存/修改/删除图片、文件 |
| NSMicrophoneUsageDescription | 使用麦克风 | 需要访问您的麦克风以进行口语录音和AI发音评分 |
| NSUserNotificationUsageDescription | 发送通知 | 需要发送通知以提醒您新的消息和重要更新 |
| UIBackgroundModes | 后台运行模式 | 支持远程通知、音频播放、后台获取和处理任务 |
