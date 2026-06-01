import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings, Loader2, CheckCircle2, AlertCircle,
  ToggleLeft, Sliders, TrendingUp, Gauge,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/cn';
import {
  getAllConfigs, bulkUpdateConfig,
  type SystemConfigItem,
} from '@/features/admin/api-system-config';
import { useAuth } from '@/providers/auth-provider';

// ─── Config group metadata ──────────────────────────────────

interface GroupMeta {
  key: string;
  label: string;
  icon: React.ElementType;
  desc: string;
}

const groups: GroupMeta[] = [
  { key: 'feature',  label: '功能开关', icon: ToggleLeft,  desc: '控制注册、维护模式、排行榜等功能' },
  { key: 'growth',   label: '增长配置', icon: TrendingUp, desc: '邀请奖励天数、新人推广试用等增长参数' },
  { key: 'technical',label: '系统参数', icon: Sliders,    desc: 'API 限流、文件上传、会话超时等技术参数' },
  { key: 'quota',    label: 'AI 配额',  icon: Gauge,      desc: '免费用户 AI 纠错次数等配额控制' },
];

// ─── Field renderer ─────────────────────────────────────────

function ConfigField({
  item,
  value,
  onChange,
}: {
  item: SystemConfigItem;
  value: string;
  onChange: (key: string, val: string) => void;
}) {
  const t = item.type || 'string';

  if (t === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <Switch
          id={item.key}
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(item.key, checked ? 'true' : 'false')}
        />
        <label htmlFor={item.key} className="text-sm text-muted-foreground cursor-pointer select-none">
          {value === 'true' ? '已启用' : '已禁用'}
        </label>
      </div>
    );
  }

  if (t === 'number') {
    return (
      <Input
        id={item.key}
        type="number"
        value={value}
        onChange={(e) => onChange(item.key, e.target.value)}
        className="max-w-[200px]"
      />
    );
  }

  if (t === 'textarea' || t === 'json') {
    return (
      <Textarea
        id={item.key}
        value={value}
        onChange={(e) => onChange(item.key, e.target.value)}
        rows={t === 'json' ? 8 : 4}
        className="min-h-[100px] font-mono text-sm"
      />
    );
  }

  // default: string
  return (
    <Input
      id={item.key}
      value={value}
      onChange={(e) => onChange(item.key, e.target.value)}
      className="max-w-[400px]"
    />
  );
}

// ─── Main Page ──────────────────────────────────────────────

export function AdminSettingsPage() {
  const { session } = useAuth();
  const [grouped, setGrouped] = useState<Record<string, SystemConfigItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllConfigs();
      setGrouped(data);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  // Show toast briefly
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Track local edits
  const handleChange = (key: string, val: string) => {
    setDirty((prev) => ({ ...prev, [key]: val }));
    // Also update grouped for instant UI feedback
    setGrouped((prev) => {
      const next = { ...prev };
      for (const g of Object.keys(next)) {
        next[g] = next[g].map((item) =>
          item.key === key ? { ...item, value: val } : item,
        );
      }
      return next;
    });
  };

  // Get effective value: dirty override or original
  const getValue = (item: SystemConfigItem) =>
    dirty[item.key] !== undefined ? dirty[item.key] : item.value;

  // Save
  const handleSave = async () => {
    if (Object.keys(dirty).length === 0) {
      showToast('success', '没有需要保存的更改');
      return;
    }
    setSaving(true);
    try {
      await bulkUpdateConfig(dirty);
      setDirty({});
      showToast('success', `已保存 ${Object.keys(dirty).length} 项配置`);
    } catch {
      showToast('error', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const activeGroups = groups.filter((g) => grouped[g.key]?.length > 0);
  const defaultTab = activeGroups[0]?.key || 'feature';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
        <p className="text-sm text-muted-foreground">管理应用全局配置与参数</p>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || Object.keys(dirty).length === 0}
          className="gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          保存更改
          {Object.keys(dirty).length > 0 && (
            <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[11px]">
              {Object.keys(dirty).length}
            </span>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          {Object.keys(dirty).length > 0
            ? `${Object.keys(dirty).length} 项待保存`
            : '配置已是最新'}
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {activeGroups.map((g) => {
            const Icon = g.icon;
            return (
              <TabsTrigger key={g.key} value={g.key} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {g.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {activeGroups.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">{g.label}</CardTitle>
                <CardDescription>{g.desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {grouped[g.key]?.map((item, idx) => (
                  <div key={item.key}>
                    {idx > 0 && <Separator className="mb-5" />}
                    <div className="space-y-2">
                      <label
                        htmlFor={item.key}
                        className="block text-sm font-medium"
                      >
                        {item.label || item.key}
                      </label>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                      <ConfigField
                        item={item}
                        value={getValue(item)}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                ))}
                {(!grouped[g.key] || grouped[g.key].length === 0) && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    暂无配置项
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
