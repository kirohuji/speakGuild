import { Logger } from '@nestjs/common';

// nodemailer 10 是 CJS 导出；项目 tsconfig 未开 esModuleInterop，用 require 保持和短信 SDK 一致。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer') as {
  createTransport: (options: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  }) => {
    sendMail: (mail: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }) => Promise<unknown>;
  };
};

const logger = new Logger('SmtpMailer');

type OtpType = 'forget-password' | 'email-verification' | 'sign-in' | string;

const COPY: Record<string, { kicker: string; title: string; lead: string; subject: string }> = {
  'forget-password': {
    kicker: '密码重置',
    title: '请使用下面的验证码',
    lead: '有人正在为这个邮箱重置漫语町的登录密码。验证码 5 分钟内有效，过期后需要重新获取。',
    subject: '漫语町验证码：重置密码',
  },
  'email-verification': {
    kicker: '邮箱验证',
    title: '请确认这是你的邮箱',
    lead: '把验证码填回漫语町，即可完成邮箱验证。验证码 5 分钟内有效。',
    subject: '漫语町验证码：验证邮箱',
  },
  'sign-in': {
    kicker: '登录验证',
    title: '请使用下面的验证码登录',
    lead: '验证码 5 分钟内有效。如果不是你本人操作，直接忽略这封邮件即可。',
    subject: '漫语町验证码：登录',
  },
};

let cached: { key: string; transport: ReturnType<typeof nodemailer.createTransport> } | null = null;

function readSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== 'false';
  if (!host || !user || !pass || !from) return null;
  return { host, user, pass, from, port, secure };
}

function getTransport() {
  const config = readSmtpConfig();
  if (!config) return null;
  const key = `${config.host}|${config.port}|${config.secure}|${config.user}`;
  if (cached?.key === key) return { config, transport: cached.transport };
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  cached = { key, transport };
  return { config, transport };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}

const FONT = "'PingFang SC','Noto Sans SC','Hiragino Sans GB','Microsoft YaHei',-apple-system,BlinkMacSystemFont,'Inter',sans-serif";

function logoSrc() {
  const raw = (process.env.FRONTEND_URL || '').split(',')[0]?.trim();
  if (!raw) return '';
  try {
    return `${new URL(raw).origin}/logo.png`;
  } catch {
    return '';
  }
}

function renderHtml(otp: string, type: OtpType) {
  const copy = COPY[type] || COPY['sign-in'];
  const code = escapeHtml(otp);
  const logo = logoSrc();
  const mark = logo
    ? `<img src="${escapeHtml(logo)}" alt="漫语町" height="64" style="display:block;height:64px;width:auto;margin:0 auto;border:0;" />`
    : `<p style="margin:0;font-family:${FONT};font-size:20px;font-weight:600;line-height:28px;color:#002E5F;">漫语町</p>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<body style="margin:0;padding:0;background:#F4FAF7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4FAF7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="400" cellpadding="0" cellspacing="0" style="width:400px;max-width:400px;">
          <tr>
            <td align="center" style="padding:0 8px 16px 8px;">
              ${mark}
              <p style="margin:12px auto 0 auto;max-width:280px;font-family:${FONT};font-size:12px;line-height:20px;color:#5F6F82;">${escapeHtml(copy.lead)}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#E8EEF5;border-radius:24px;padding:20px;">
              <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;font-weight:600;line-height:16px;color:#5F6F82;">验证码</p>
              <div style="background:#FFFFFF;border:1px solid #DCE5EF;border-radius:12px;padding:14px 16px;text-align:center;">
                <span style="font-family:${FONT};font-size:24px;font-weight:600;letter-spacing:8px;color:#002E5F;">${code}</span>
              </div>
              <div style="margin-top:16px;background:#FF5A45;border-radius:12px;text-align:center;">
                <p style="margin:0;font-family:${FONT};font-size:15px;font-weight:600;line-height:46px;color:#FFFFFF;">5 分钟内有效</p>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 8px 0 8px;">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:20px;color:#5F6F82;">如果不是你本人操作，请忽略这封邮件，密码不会被更改。</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(otp: string, type: OtpType) {
  const copy = COPY[type] || COPY['sign-in'];
  return [`漫语町`, copy.kicker, '', copy.title, copy.lead, '', `验证码：${otp}`, '', '如果不是你本人操作，请忽略这封邮件。'].join('\n');
}

export async function sendVerificationEmail(input: { email: string; otp: string; type: OtpType }) {
  const copy = COPY[input.type] || COPY['sign-in'];
  const ready = getTransport();

  if (!ready) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('邮件服务未配置');
    }
    logger.warn(`[DEV][Email OTP][${input.type}] email=${maskEmail(input.email)} otp=${input.otp}`);
    return;
  }

  try {
    await ready.transport.sendMail({
      from: ready.config.from,
      to: input.email,
      subject: copy.subject,
      text: renderText(input.otp, input.type),
      html: renderHtml(input.otp, input.type),
    });
    logger.log(`验证码邮件已发送 type=${input.type} to=${maskEmail(input.email)}`);
  } catch {
    logger.error(`验证码邮件发送失败 type=${input.type} to=${maskEmail(input.email)}`);
    throw new Error('验证码邮件发送失败');
  }
}
