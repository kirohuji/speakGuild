import { Module } from '@nestjs/common';
import { PayController } from './pay.controller';
import { PayService } from './pay.service';
import { AlipayProvider } from './providers/alipay.provider';
import { WechatProvider } from './providers/wechat.provider';
import { RevenueCatService } from './revenuecat/revenuecat.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PayController],
  providers: [PayService, AlipayProvider, WechatProvider, RevenueCatService],
  exports: [PayService],
})
export class PayModule {}
