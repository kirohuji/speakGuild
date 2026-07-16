import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { bearer, emailOTP, phoneNumber } from 'better-auth/plugins';
import { importPKCS8, SignJWT } from 'jose';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TencentSmsService } from './sms/tencent-sms.service';

const prisma = new PrismaService();
const smsService = new TencentSmsService();

async function generateAppleClientSecret(
  clientId: string,
  teamId: string,
  keyId: string,
  privateKey: string,
) {
  const key = await importPKCS8(privateKey, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60) // 6 months
    .sign(key);
}

function getTrustedOrigins() {
  const origins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // Apple OAuth requires this origin for authentication
  const trusted = ['https://appleid.apple.com'];

  if (origins.length) return [...trusted, ...origins];

  return [...trusted, 'http://localhost:5173', 'capacitor://localhost', 'ionic://localhost', 'http://localhost'];
}

export const auth: any = betterAuth({
  appName: 'engjourney',
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3001}`,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await prisma.userLoginLog.create({
            data: {
              userId: session.userId,
              sessionId: session.id,
              loginAt: session.createdAt,
              expiresAt: session.expiresAt,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
            },
          }).catch(() => { /* 登录日志失败不能阻断用户登录 */ });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 天
    },
    cookieOptions: {
      sameSite: "none",
      secure: true
    },
  },
  socialProviders: {
    wechat: {
      clientId: process.env.WECHAT_CLIENT_ID || process.env.WECHAT_NATIVE_APP_ID || '',
      clientSecret: process.env.WECHAT_CLIENT_SECRET || process.env.WECHAT_NATIVE_APP_SECRET || '',
      lang: 'cn',
    },
    // apple: async () => ({
    //   clientId: process.env.APPLE_CLIENT_ID || '',
    //   clientSecret: await generateAppleClientSecret(
    //     process.env.APPLE_CLIENT_ID || '',
    //     process.env.APPLE_TEAM_ID || '',
    //     process.env.APPLE_KEY_ID || '',
    //     process.env.APPLE_PRIVATE_KEY || '',
    //   ),
    //   appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER || '',
    // }),
  },
  plugins: [
    bearer(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[DEV-MOCK][Email OTP][${type}] email=${email} otp=${otp}`);
      },
    }),
    phoneNumber({
      async sendOTP({ phoneNumber: phone, code }) {
        // 通过腾讯云短信服务发送验证码
        const result = await smsService.sendVerificationCode(phone, code);
        // 发送失败时打印日志，方便本地开发调试
        if (!result.sent) {
          console.log(`[SMS-FALLBACK][Phone OTP] phone=${phone} otp=${code}`);
        }
      },
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone}@temp.local`,
        getTempName: (phone) => phone,
      },
    }),
  ],
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
      },
      phoneNumber: {
        type: 'string',
        required: false,
      },
      phoneNumberVerified: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
      },
    },
  },
});
