import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { bearer, emailOTP, phoneNumber } from 'better-auth/plugins';
import { PrismaService } from '../../common/prisma/prisma.service';

const prisma = new PrismaService();

function getTrustedOrigins() {
  const origins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (origins.length) return origins;

  return ['http://localhost:5173', 'capacitor://localhost', 'ionic://localhost', 'http://localhost'];
}

export const auth: any = betterAuth({
  appName: 'guideready',
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3001}`,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    wechat: {
      clientId: process.env.WECHAT_CLIENT_ID || '',
      clientSecret: process.env.WECHAT_CLIENT_SECRET || '',
      lang: 'cn',
    },
  },
  plugins: [
    bearer(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[DEV-MOCK][Email OTP][${type}] email=${email} otp=${otp}`);
      },
    }),
    phoneNumber({
      sendOTP({ phoneNumber: phone, code }) {
        console.log(`[DEV-MOCK][Phone OTP] phone=${phone} otp=${code}`);
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
