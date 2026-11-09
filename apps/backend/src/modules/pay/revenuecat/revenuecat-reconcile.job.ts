import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RevenueCatService } from './revenuecat.service';

@Injectable()
export class RevenueCatReconcileJob {
  private readonly logger = new Logger(RevenueCatReconcileJob.name);

  constructor(private readonly revenueCat: RevenueCatService) {}

  @Cron(process.env.REVENUECAT_RECONCILE_CRON || '0 35 4 * * *')
  async reconcile() {
    try {
      const [result, failureRate] = await Promise.all([
        this.revenueCat.reconcileActiveMemberships(),
        this.revenueCat.checkWebhookFailureRate(),
      ]);
      this.logger.log(`RevenueCat reconciliation complete: ${JSON.stringify({ result, failureRate })}`);
    } catch (error) {
      this.logger.error('RevenueCat reconciliation failed', error);
    }
  }
}
