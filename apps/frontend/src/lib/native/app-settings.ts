import { isNative } from './platform'

/** Opens this app's system settings page on iOS or Android. */
export async function openAppSettings(): Promise<boolean> {
  if (!isNative()) return false

  const {
    AndroidSettings,
    IOSSettings,
    NativeSettings,
  } = await import('capacitor-native-settings')

  const { status } = await NativeSettings.open({
    optionAndroid: AndroidSettings.ApplicationDetails,
    optionIOS: IOSSettings.App,
  })

  return status
}
