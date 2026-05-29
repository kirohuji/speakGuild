import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Calendar, Quote, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/cn';
import {
  getAllDailySentences, createDailySentence, updateDailySentence, deleteDailySentence,
  type DailySentence, type CreateDailySentenceInput,
} from '@/features/admin/api-daily-sentences';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export function AdminDailySentencesPage() {
  const [sentences, setSentences] = useState<DailySentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DailySentence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DailySentence | null>(null);
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [formDate, setFormDate] = useState('');
  const [formQuote, setFormQuote] = useState('');
  const [formTranslation, setFormTranslation] = useState('');
  const [formAuthor, setFormAuthor] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllDailySentences();
      setSentences(data);
    } catch {
      toast.error('加载每日句子列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormDate('');
    setFormQuote('');
    setFormTranslation('');
    setFormAuthor('');
  };

  const openCreate = () => {
    setEditingItem(null);
    resetForm();
    // 默认填入今天日期
    const today = new Date();
    setFormDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setEditorOpen(true);
  };

  const openEdit = (item: DailySentence) => {
    setEditingItem(item);
    setFormDate(formatDate(item.date));
    setFormQuote(item.quote);
    setFormTranslation(item.translation);
    setFormAuthor(item.author);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formDate || !formQuote.trim() || !formTranslation.trim()) {
      toast.error('请填写日期、英文句子和中文翻译');
      return;
    }

    setSaving(true);
    try {
      const data: CreateDailySentenceInput = {
        date: formDate,
        quote: formQuote.trim(),
        translation: formTranslation.trim(),
        author: formAuthor.trim() || 'EngJourney Daily',
        sortOrder: 0,
      };

      if (editingItem) {
        await updateDailySentence(editingItem.id, data);
        toast.success('句子已更新');
      } else {
        await createDailySentence(data);
        toast.success('句子已创建');
      }

      setEditorOpen(false);
      load();
    } catch {
      toast.error(editingItem ? '更新失败' : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDailySentence(deleteTarget.id);
      toast.success('句子已删除');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('删除失败');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">每日一句管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理首页展示的每日句子，按日期自动切换展示
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          新建句子
        </Button>
      </div>

      <Separator />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sentences.length === 0 ? (
        <Card className="py-12 text-center">
          <Quote className="mx-auto mb-3 size-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">暂无每日句子，点击"新建句子"创建第一条</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sentences.map((item) => (
            <SentenceCard
              key={item.id}
              item={item}
              isToday={isToday(item.date)}
              onEdit={() => openEdit(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {/* 新建/编辑 Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑每日句子' : '新建每日句子'}</DialogTitle>
            <DialogDescription>
              设置指定日期的首页展示句子，相同日期只会保留一条。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                日期 <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                英文句子 <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={formQuote}
                onChange={(e) => setFormQuote(e.target.value)}
                placeholder="Say one real sentence today."
                rows={2}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                中文翻译 <span className="text-destructive">*</span>
              </label>
              <Input
                value={formTranslation}
                onChange={(e) => setFormTranslation(e.target.value)}
                placeholder="今天先说出一句真实会用的话。"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                作者/出处
              </label>
              <Input
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
                placeholder="EngJourney Daily"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              {saving ? '保存中...' : (editingItem ? '更新' : '创建')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 {deleteTarget ? formatDate(deleteTarget.date) : ''} 的每日句子吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 句子卡片 ───

function SentenceCard({
  item,
  isToday: today,
  onEdit,
  onDelete,
}: {
  item: DailySentence;
  isToday: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', today && 'ring-2 ring-primary/30')}>
      {/* 顶部日期栏 */}
      <div className="flex items-center gap-2 rounded-t-xl border-b border-border/40 bg-muted/30 px-4 py-2.5">
        <Calendar className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {formatDate(item.date)}
        </span>
        {today && (
          <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0 h-5">
            今日
          </Badge>
        )}
      </div>

      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold leading-relaxed text-foreground">
          “{item.quote}”
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <p className="text-xs text-muted-foreground">{item.translation}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            {item.author || 'EngJourney Daily'}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
