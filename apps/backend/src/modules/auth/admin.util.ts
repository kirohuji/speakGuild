import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from './session.util';

/**
 * 检查 session 中的用户是否为管理员
 */
export function isAdmin(session: any): boolean {
  return session?.user?.role === 'admin';
}

/**
 * 要求管理员权限，否则抛出 ForbiddenException。
 * 返回 session 以方便链式调用。
 */
export async function requireAdmin(req: Request) {
  const session = await requireAuthSession(req);

  if (!isAdmin(session)) {
    throw new ForbiddenException('需要管理员权限');
  }

  return session;
}
