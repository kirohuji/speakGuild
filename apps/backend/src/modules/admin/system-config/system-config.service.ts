import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface SystemConfigItem {
  key: string;
  value: string;
  group: string;
  label: string;
  type: string;
  description: string | null;
}

const BUILTIN_CONFIGS = [
  {
    key: 'learning_pack_free_downloads_enabled',
    value: 'false',
    group: 'feature',
    label: '学习包免费下载',
    type: 'boolean',
    description: '开启后，所有用户都可以在商店免费下载学习包',
  },
  {
    key: 'daily_practice_pack_scope',
    value: 'single',
    group: 'learning',
    label: '今日任务学习包范围',
    type: 'string',
    description: 'single=只从一个学习包排程；mixed=允许跨多个已安装学习包混合排程',
  },
];

@Injectable()
export class SystemConfigService {
  private cache: Map<string, string> | null = null;
  private cacheTime = 0;
  private readonly TTL = 60_000; // 1 minute in-memory cache

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all configs grouped by their `group` field.
   */
  async getAllGrouped(): Promise<Record<string, SystemConfigItem[]>> {
    await this.ensureBuiltinConfigs();
    const rows = await this.prisma.systemConfig.findMany({
      orderBy: { group: 'asc' },
    });

    const grouped: Record<string, SystemConfigItem[]> = {};
    for (const row of rows) {
      const group = row.group || 'basic';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push({
        key: row.key,
        value: row.value,
        group: row.group,
        label: row.label,
        type: row.type,
        description: row.description,
      });
    }
    return grouped;
  }

  /**
   * Get a single config value by key (with in-memory cache).
   */
  async getValue(key: string): Promise<string | null> {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < this.TTL) {
      const cached = this.cache.get(key);
      if (cached !== undefined) return cached;
    }

    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  /**
   * Get a config value parsed as boolean (fallback if missing).
   */
  async getBool(key: string, fallback = false): Promise<boolean> {
    const val = await this.getValue(key);
    if (val === null) return fallback;
    return val === 'true' || val === '1';
  }

  /**
   * Reload the entire in-memory cache.
   */
  async refreshCache(): Promise<void> {
    const rows = await this.prisma.systemConfig.findMany({
      select: { key: true, value: true },
    });
    this.cache = new Map(rows.map((r) => [r.key, r.value]));
    this.cacheTime = Date.now();
  }

  /**
   * Set / update a config key.
   */
  async setConfig(key: string, value: string): Promise<SystemConfigItem> {
    const row = await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value, group: 'basic', label: key, type: 'string' },
    });
    this.invalidateCache();
    return {
      key: row.key,
      value: row.value,
      group: row.group,
      label: row.label,
      type: row.type,
      description: row.description,
    };
  }

  /**
   * Bulk update configs (key → value map).
   */
  async bulkSet(entries: Record<string, string>): Promise<number> {
    const ops = Object.entries(entries).map(([key, value]) =>
      this.prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value, group: 'basic', label: key, type: 'string' },
      }),
    );
    await this.prisma.$transaction(ops);
    this.invalidateCache();
    return ops.length;
  }

  /**
   * Check if maintenance mode is enabled.
   */
  async isMaintenanceMode(): Promise<boolean> {
    return this.getBool('maintenance_mode', false);
  }

  /**
   * Get maintenance mode message.
   */
  async getMaintenanceMessage(): Promise<string> {
    const val = await this.getValue('maintenance_message');
    return val || '系统维护中，请稍后再试。';
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }

  private async ensureBuiltinConfigs(): Promise<void> {
    await this.prisma.$transaction(
      BUILTIN_CONFIGS.map((config) =>
        this.prisma.systemConfig.upsert({
          where: { key: config.key },
          create: config,
          update: {},
        }),
      ),
    );
  }
}
