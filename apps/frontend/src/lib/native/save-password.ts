import { SavePassword, type ReadPasswordResult } from '@capgo/capacitor-autofill-save-password';
import { isNative } from './platform';

const AUTOFILL_CREDENTIAL_URL = import.meta.env.VITE_AUTOFILL_CREDENTIAL_URL || '';

export async function promptSavePassword(username: string, password: string): Promise<boolean> {
  if (!isNative() || !username || !password) return false;

  try {
    await SavePassword.promptDialog({
      username,
      password,
      ...(AUTOFILL_CREDENTIAL_URL ? { url: AUTOFILL_CREDENTIAL_URL } : {}),
    });
    return true;
  } catch (error) {
    console.warn('[SavePassword] promptDialog failed:', error);
    return false;
  }
}

export async function readSavedPassword(): Promise<ReadPasswordResult | null> {
  if (!isNative()) return null;

  try {
    const credentials = await SavePassword.readPassword();
    if (!credentials.username || !credentials.password) return null;
    return credentials;
  } catch (error) {
    console.warn('[SavePassword] readPassword failed:', error);
    return null;
  }
}
