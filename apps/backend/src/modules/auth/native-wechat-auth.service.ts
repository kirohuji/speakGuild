import {
  BadGatewayException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatUserInfoResponse {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class NativeWechatAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signIn(code: string, ipAddress?: string, userAgent?: string) {
    const appId = process.env.WECHAT_NATIVE_APP_ID || process.env.WECHAT_CLIENT_ID;
    const appSecret = process.env.WECHAT_NATIVE_APP_SECRET || process.env.WECHAT_CLIENT_SECRET;
    const authSecret = process.env.BETTER_AUTH_SECRET;

    if (!appId || !appSecret || !authSecret) {
      throw new ServiceUnavailableException('Native WeChat login is not configured');
    }

    const token = await this.exchangeCode(appId, appSecret, code);
    const profile = await this.fetchUserInfo(token.access_token!, token.openid!);
    const accountId = token.openid!;

    const user = await this.prisma.$transaction(async (tx) => {
      const existingAccount = await tx.account.findFirst({
        where: { providerId: 'wechat', accountId },
        include: { user: true },
      });

      const accountData = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + (token.expires_in || 7200) * 1000),
        scope: token.scope || 'snsapi_userinfo',
      };

      if (existingAccount) {
        await tx.account.update({
          where: { id: existingAccount.id },
          data: accountData,
        });

        // 已有账号：不覆盖用户已设置的信息（昵称/头像），
        // 仅在用户没有头像时补充微信头像
        if (!existingAccount.user.image && profile.headimgurl) {
          await tx.user.update({
            where: { id: existingAccount.userId },
            data: { image: profile.headimgurl },
          });
        }

        return tx.user.findUnique({ where: { id: existingAccount.userId } });
      }

      const createdUser = await tx.user.create({
        data: {
          id: randomUUID(),
          name: profile.nickname || 'WeChat User',
          email: `${accountId}@wechat.local`,
          emailVerified: false,
          image: profile.headimgurl,
        },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId,
          providerId: 'wechat',
          userId: createdUser.id,
          ...accountData,
        },
      });

      return createdUser;
    });

    const sessionToken = randomBytes(32).toString('base64url');
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.session.create({
        data: {
          id: sessionId,
          token: sessionToken,
          userId: user.id,
          expiresAt,
          ipAddress,
          userAgent,
        },
      });
      await tx.userLoginLog.create({
        data: {
          userId: user.id,
          sessionId,
          expiresAt,
          ipAddress,
          userAgent,
        },
      });
    });

    return {
      token: this.signBearerToken(sessionToken, authSecret),
      user,
      expiresAt,
    };
  }

  async bind(userId: string, code: string) {
    const appId = process.env.WECHAT_NATIVE_APP_ID || process.env.WECHAT_CLIENT_ID;
    const appSecret = process.env.WECHAT_NATIVE_APP_SECRET || process.env.WECHAT_CLIENT_SECRET;

    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('Native WeChat binding is not configured');
    }

    const token = await this.exchangeCode(appId, appSecret, code);
    const profile = await this.fetchUserInfo(token.access_token!, token.openid!);
    const accountId = token.openid!;

    const existingAccount = await this.prisma.account.findFirst({
      where: { providerId: 'wechat', accountId },
    });

    if (existingAccount) {
      if (existingAccount.userId === userId) {
        // 已绑定当前账号：幂等返回
        return { bound: true, alreadyBound: true };
      }
      throw new ConflictException('该微信已绑定其他账号');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId,
          providerId: 'wechat',
          userId,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          accessTokenExpiresAt: new Date(Date.now() + (token.expires_in || 7200) * 1000),
          scope: token.scope || 'snsapi_userinfo',
        },
      });
      // 用户没有自定义头像时，补上微信头像（不覆盖用户已设置的昵称）
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { image: true },
      });
      if (!user?.image && profile.headimgurl) {
        await tx.user.update({
          where: { id: userId },
          data: { image: profile.headimgurl },
        });
      }
    });

    return {
      bound: true,
      alreadyBound: false,
      image: profile.headimgurl || null,
    };
  }

  private async exchangeCode(appId: string, appSecret: string, code: string) {
    try {
      const { data } = await axios.get<WechatTokenResponse>(
        'https://api.weixin.qq.com/sns/oauth2/access_token',
        {
          params: {
            appid: appId,
            secret: appSecret,
            code,
            grant_type: 'authorization_code',
          },
          timeout: 10000,
        },
      );

      if (data.errcode || !data.access_token || !data.openid) {
        throw new UnauthorizedException(data.errmsg || 'Invalid WeChat authorization code');
      }

      return data;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new BadGatewayException('Unable to exchange WeChat authorization code');
    }
  }

  private async fetchUserInfo(accessToken: string, openid: string) {
    try {
      const { data } = await axios.get<WechatUserInfoResponse>(
        'https://api.weixin.qq.com/sns/userinfo',
        {
          params: { access_token: accessToken, openid, lang: 'zh_CN' },
          timeout: 10000,
        },
      );

      if (data.errcode) {
        throw new BadGatewayException(data.errmsg || 'WeChat user info request failed');
      }

      return data;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (axios.isAxiosError(error)) {
        throw new BadGatewayException('Unable to retrieve WeChat user info');
      }
      throw error;
    }
  }

  private signBearerToken(token: string, secret: string) {
    const signature = createHmac('sha256', secret).update(token).digest('base64');
    return encodeURIComponent(`${token}.${signature}`);
  }
}
