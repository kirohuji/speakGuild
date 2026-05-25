import { get, put } from '@/lib/request';

export interface SystemConfigItem {
  key: string;
  value: string;
  group: string;
  label: string;
  type: string;
  description: string | null;
}

/** Get all system configs grouped by category. */
export async function getAllConfigs(): Promise<Record<string, SystemConfigItem[]>> {
  return get('/admin/system-config');
}

/** Get a single config by key. */
export async function getConfig(key: string): Promise<{ key: string; value: string }> {
  return get(`/admin/system-config/${key}`);
}

/** Update a single config value. */
export async function updateConfig(key: string, value: string): Promise<SystemConfigItem> {
  return put(`/admin/system-config/${key}`, { value });
}

/** Bulk update configs (key → value map). */
export async function bulkUpdateConfig(entries: Record<string, string>): Promise<{ updated: number }> {
  return put('/admin/system-config/bulk', entries);
}
