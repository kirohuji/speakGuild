import { CapgoInAppReview } from '@capgo/capacitor-in-app-review';
import { isNative } from './platform';

export async function requestInAppReview() {
  if (!isNative()) {
    return { requested: false, reason: 'web' as const };
  }

  await CapgoInAppReview.requestReview();
  return { requested: true as const };
}

export async function getInAppReviewPluginVersion() {
  return CapgoInAppReview.getPluginVersion();
}
