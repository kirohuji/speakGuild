import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { auth } from './modules/auth/auth';
import { MobileUpdatesService } from './modules/mobile-updates/mobile-updates.service';
import { OpsAlertService } from './common/ops/ops-alert.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const originsFromEnv = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = originsFromEnv.length
    ? originsFromEnv
    : ['https://hope.lourd.top:2605', 'capacitor://localhost', 'ionic://localhost', 'http://localhost'];

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/api/auth', (req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    const isAllowed = origin && allowedOrigins.includes(origin);

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
    }

    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  });
  expressApp.all('/api/auth/*', toNodeHandler(auth));

  expressApp.use(json());
  expressApp.use(urlencoded({ extended: true }));

  // ── 全局 CORS（必须在业务路由注册之前）──
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1/manyu');

  // ── OTA 热更新公开检查接口 ──
  // 必须注册两个路径：
  //   /api/mobile-updates/check  — 经过 nginx 代理（透传 /api 前缀）
  //   /mobile-updates/check      — 本地直连后端（无 nginx）
  // 同时手动注入 CORS 头，防止因中间件顺序问题导致 capacitor:// 等自定义 scheme 被拦截
  const mobileUpdatesService = app.get(MobileUpdatesService);
  const checkHandler = async (req: any, res: any) => {
    // ── CORS 头（参照 /api/auth 模式）──
    const origin = req.headers.origin as string | undefined;
    const isAllowed = origin && allowedOrigins.includes(origin);
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    try {
      const result = await mobileUpdatesService.checkUpdate({
        platform: req.body?.platform || 'ios',
        deviceId: req.body?.device_id || req.body?.deviceId,
        nativeVersion: req.body?.native_version || req.body?.nativeVersion,
        currentBundleVersion: req.body?.current_bundle_version || req.body?.currentBundleVersion,
        channel: req.body?.channel || 'production',
      });
      res.json(result);
    } catch (err: any) {
      console.error('[mobile-updates/check] error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  expressApp.post('/api/mobile-updates/check', checkHandler);
  expressApp.post('/api/v1/manyu/mobile-updates/check', checkHandler);
  expressApp.post('/mobile-updates/check', checkHandler);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(app.get(OpsAlertService)));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api/v1/manyu`);
}

bootstrap();
