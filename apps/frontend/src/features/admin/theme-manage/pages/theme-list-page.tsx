import { useEffect, useState, useCallback } from 'react';
import {
  Palette, Plus, Pencil, Trash2, CheckCircle2, XCircle,
  Star, Loader2, ImageIcon, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/cn';
import {
  themeAdminApi, type ThemePreset,
} from '../api/theme-api';
import { ThemeEditorDialog } from '../components/theme-editor-dialog';

export function AdminThemesPage() {
  const [themes, setThemes] = useState<ThemePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ThemePreset | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ThemePreset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await themeAdminApi.list();
      setThemes(data);
    } catch {
      toast.error('加载主题列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await themeAdminApi.remove(deleteTarget.id);
      toast.success('主题已删除');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('删除失败');
    }
  };

  const openCreate = () => {
    setEditingPreset(null);
    setEditorOpen(true);
  };

  const openEdit = (preset: ThemePreset) => {
    setEditingPreset(preset);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">沉浸式主题管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理多套沉浸式主题套装，每套包含 Light/Dark 色板、背景、装饰元素和音效
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          新建主题
        </Button>
      </div>

      <Separator />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : themes.length === 0 ? (
        <Card className="py-12 text-center">
          <Palette className="mx-auto mb-3 size-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">暂无主题预设，点击"新建主题"创建第一套</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isExpanded={expandedId === theme.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === theme.id ? null : theme.id)
              }
              onEdit={() => openEdit(theme)}
              onDelete={() => setDeleteTarget(theme)}
            />
          ))}
        </div>
      )}

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除主题「{deleteTarget?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建/编辑 Dialog */}
      <ThemeEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        preset={editingPreset}
        onSaved={load}
      />
    </div>
  );
}

// ─── 主题卡片 ───

function ThemeCard({
  theme,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  theme: ThemePreset;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lightBg = theme.lightBackground;
  const darkBg = theme.darkBackground;

  return (
    <Card className={cn('transition-shadow hover:shadow-md', !theme.isActive && 'opacity-50')}>
      {/* 预览色块 */}
      <div className="flex h-20 overflow-hidden rounded-t-xl">
        <div
          className="flex-1 flex items-end p-3"
          style={{
            background: lightBg?.startsWith('linear-gradient') || lightBg?.startsWith('radial-gradient')
              ? lightBg
              : lightBg
                ? `url(${lightBg}) center/cover`
                : 'hsl(156 43% 97%)',
          }}
        >
          <Badge variant="outline" className="bg-white/70 text-xs backdrop-blur-sm">
            Light
          </Badge>
        </div>
        <div
          className="flex-1 flex items-end p-3"
          style={{
            background: darkBg?.startsWith('linear-gradient') || darkBg?.startsWith('radial-gradient')
              ? darkBg
              : darkBg
                ? `url(${darkBg}) center/cover`
                : 'hsl(252 43% 5%)',
          }}
        >
          <Badge variant="outline" className="bg-black/40 text-xs text-white/80 backdrop-blur-sm">
            Dark
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{theme.name}</CardTitle>
          {theme.isDefault && <Star className="size-3.5 text-amber-500" />}
          {theme.isActive
            ? <CheckCircle2 className="size-3.5 text-success" />
            : <XCircle className="size-3.5 text-muted-foreground" />
          }
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {theme.bgType === 'image' ? '图片' : theme.bgType === 'video' ? '视频' : '渐变'}
          </Badge>
        </div>
        {theme.description && (
          <CardDescription className="text-xs">{theme.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        <button
          onClick={onToggleExpand}
          className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {isExpanded ? '收起详情' : '展开详情'}
        </button>

        {isExpanded && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs">
            <InfoRow label="背景类型" value={theme.bgType} />
            <InfoRow label="排序" value={String(theme.sortOrder)} />
            <InfoRow label="音效" value={theme.bgmUrl ? '已配置' : '无'} />
            {theme.lightColors && (
              <InfoRow label="Light 色板" value={`${Object.keys(theme.lightColors).length} 项`} />
            )}
            {theme.darkColors && (
              <InfoRow label="Dark 色板" value={`${Object.keys(theme.darkColors).length} 项`} />
            )}
            <InfoRow label="创建时间" value={new Date(theme.createdAt).toLocaleString('zh-CN')} />
          </div>
        )}

        <div className="flex gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Pencil className="mr-1 size-3" /> 编辑
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={theme.isDefault}
          >
            <Trash2 className="mr-1 size-3" /> 删除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
