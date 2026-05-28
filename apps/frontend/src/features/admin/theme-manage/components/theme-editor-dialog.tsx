import { useState, useEffect, useCallback } from 'react';
import {
  Palette, Sun, Moon, ImageIcon, Music, Info, Plus, Trash2,
  Check, Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/cn';
import {
  themeAdminApi,
  type ThemePreset,
  type CreateThemePresetInput,
  type ThemeDecoration,
} from '../api/theme-api';
import { FileUploadField } from '@/features/admin/components/file-upload-field';
import { ColorPickerField } from '@/features/admin/components/color-picker-field';
import { AudioPlayerField } from '@/features/admin/components/audio-player-field';

// ── 色板字段定义 ──

interface ColorFieldDef {
  key: string;
  label: string;
  hint?: string;
}

const COLOR_FIELDS: ColorFieldDef[] = [
  { key: 'background', label: '页面底色', hint: '如 156 43% 97%' },
  { key: 'foreground', label: '前景文字', hint: '如 211 32% 18%' },
  { key: 'card', label: '卡片底色' },
  { key: 'cardForeground', label: '卡片前景' },
  { key: 'primary', label: '主色 Primary' },
  { key: 'primaryForeground', label: '主色前景' },
  { key: 'secondary', label: '次色 Secondary' },
  { key: 'secondaryForeground', label: '次色前景' },
  { key: 'muted', label: '弱化 Muted' },
  { key: 'mutedForeground', label: '弱化前景' },
  { key: 'accent', label: '强调 Accent' },
  { key: 'accentForeground', label: '强调前景' },
  { key: 'destructive', label: '错误' },
  { key: 'destructiveForeground', label: '错误前景' },
  { key: 'border', label: '边框 Border' },
  { key: 'input', label: '输入框 Input' },
  { key: 'ring', label: '聚焦环 Ring' },
];

const SIDEBAR_COLOR_FIELDS: ColorFieldDef[] = [
  { key: 'sidebarBackground', label: '侧栏底色' },
  { key: 'sidebarForeground', label: '侧栏前景' },
  { key: 'sidebarPrimary', label: '侧栏主色' },
  { key: 'sidebarPrimaryForeground', label: '侧栏主色前景' },
  { key: 'sidebarAccent', label: '侧栏强调' },
  { key: 'sidebarAccentForeground', label: '侧栏强调前景' },
  { key: 'sidebarBorder', label: '侧栏边框' },
  { key: 'sidebarRing', label: '侧栏环' },
];

const ALL_COLOR_FIELDS = [...COLOR_FIELDS, ...SIDEBAR_COLOR_FIELDS];

// ── 默认空表单 ──

function emptyForm(): CreateThemePresetInput & { name: string } {
  return {
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
    isDefault: false,
    bgType: 'gradient',
    lightColors: {},
    lightBackground: '',
    lightDecorations: [],
    darkColors: {},
    darkBackground: '',
    darkDecorations: [],
    bgmUrl: '',
    bgmVolume: 0.3,
  };
}

function presetToForm(preset: ThemePreset): CreateThemePresetInput & { name: string } {
  return {
    name: preset.name,
    description: preset.description ?? '',
    sortOrder: preset.sortOrder,
    isActive: preset.isActive,
    isDefault: preset.isDefault,
    bgType: preset.bgType,
    lightColors: preset.lightColors ?? {},
    lightBackground: preset.lightBackground ?? '',
    lightDecorations: preset.lightDecorations ?? [],
    darkColors: preset.darkColors ?? {},
    darkBackground: preset.darkBackground ?? '',
    darkDecorations: preset.darkDecorations ?? [],
    bgmUrl: preset.bgmUrl ?? '',
    bgmVolume: preset.bgmVolume,
  };
}

// ── Props ──

interface ThemeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑模式：传入已有主题；不传则为新建 */
  preset?: ThemePreset | null;
  /** 保存成功回调 */
  onSaved: () => void;
}

// ═══════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════

export function ThemeEditorDialog({
  open,
  onOpenChange,
  preset,
  onSaved,
}: ThemeEditorDialogProps) {
  const isEdit = !!preset;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // 当 dialog 打开时，初始化表单
  useEffect(() => {
    if (open) {
      setForm(preset ? presetToForm(preset) : emptyForm());
    }
  }, [open, preset]);

  const updateField = useCallback(
    <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateColor = useCallback(
    (mode: 'lightColors' | 'darkColors', key: string, value: string) => {
      setForm((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], [key]: value },
      }));
    },
    [],
  );

  const updateDecoration = useCallback(
    (
      mode: 'lightDecorations' | 'darkDecorations',
      index: number,
      patch: Partial<ThemeDecoration>,
    ) => {
      setForm((prev) => {
        const arr = [...(prev[mode] ?? [])];
        if (arr[index]) {
          arr[index] = { ...arr[index], ...patch };
        }
        return { ...prev, [mode]: arr };
      });
    },
    [],
  );

  const addDecoration = useCallback(
    (mode: 'lightDecorations' | 'darkDecorations') => {
      setForm((prev) => {
        const arr = prev[mode] ?? [];
        return {
          ...prev,
          [mode]: [
            ...arr,
            {
              type: 'glow' as const,
              color: 'hsl(260 70% 50% / 0.12)',
              x: '50%',
              y: '20%',
              size: '24rem',
              blur: '80px',
            },
          ],
        };
      });
    },
    [],
  );

  const removeDecoration = useCallback(
    (mode: 'lightDecorations' | 'darkDecorations', index: number) => {
      setForm((prev) => {
        const arr = (prev[mode] ?? []).filter((_, i) => i !== index);
        return { ...prev, [mode]: arr };
      });
    },
    [],
  );

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('请输入主题名称');
      return;
    }
    setSaving(true);
    try {
      // 清理空值
      const payload = {
        ...form,
        lightColors: form.lightColors && Object.keys(form.lightColors).length > 0 ? form.lightColors : undefined,
        darkColors: form.darkColors && Object.keys(form.darkColors).length > 0 ? form.darkColors : undefined,
        lightDecorations: (form.lightDecorations ?? []).length > 0 ? form.lightDecorations : undefined,
        darkDecorations: (form.darkDecorations ?? []).length > 0 ? form.darkDecorations : undefined,
        lightBackground: form.lightBackground || undefined,
        darkBackground: form.darkBackground || undefined,
        bgmUrl: form.bgmUrl || undefined,
        description: form.description || undefined,
      };

      if (isEdit && preset) {
        await themeAdminApi.update(preset.id, payload);
        toast.success('主题已更新');
      } else {
        await themeAdminApi.create(payload as CreateThemePresetInput);
        toast.success('主题已创建');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Palette className="size-5" />
            {isEdit ? `编辑主题 · ${preset!.name}` : '新建沉浸式主题'}
          </DialogTitle>
          <DialogDescription>
            配置 Light/Dark 双模式的色板、背景渐变、装饰元素和音效
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-6">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="basic"><Info className="mr-1 size-3.5" />基本信息</TabsTrigger>
              <TabsTrigger value="lightColors"><Sun className="mr-1 size-3.5" />Light 色板</TabsTrigger>
              <TabsTrigger value="darkColors"><Moon className="mr-1 size-3.5" />Dark 色板</TabsTrigger>
              <TabsTrigger value="background"><ImageIcon className="mr-1 size-3.5" />背景 & 装饰</TabsTrigger>
              <TabsTrigger value="bgm"><Music className="mr-1 size-3.5" />音效</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-6 pt-4">
            <ScrollArea className="h-full pr-2">
              <TabsContent value="basic" className="mt-0 space-y-4 pb-6 data-[state=inactive]:hidden">
                <BasicInfoFields form={form} updateField={updateField} />
              </TabsContent>

              <TabsContent value="lightColors" className="mt-0 pb-6 data-[state=inactive]:hidden">
                <ColorPaletteEditor
                  colors={form.lightColors ?? {}}
                  onChange={(key, val) => updateColor('lightColors', key, val)}
                  mode="light"
                />
              </TabsContent>

              <TabsContent value="darkColors" className="mt-0 pb-6 data-[state=inactive]:hidden">
                <ColorPaletteEditor
                  colors={form.darkColors ?? {}}
                  onChange={(key, val) => updateColor('darkColors', key, val)}
                  mode="dark"
                />
              </TabsContent>

              <TabsContent value="background" className="mt-0 space-y-6 pb-6 data-[state=inactive]:hidden">
                <BackgroundTab
                  form={form}
                  updateField={updateField}
                  updateDecoration={updateDecoration}
                  addDecoration={addDecoration}
                  removeDecoration={removeDecoration}
                />
              </TabsContent>

              <TabsContent value="bgm" className="mt-0 space-y-4 pb-6 data-[state=inactive]:hidden">
                <BgmTab form={form} updateField={updateField} />
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        <Separator />

        <DialogFooter className="shrink-0 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {isEdit ? '保存修改' : '创建主题'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// 子组件：基本信息
// ═══════════════════════════════════════════════════════════

function BasicInfoFields({
  form,
  updateField,
}: {
  form: ReturnType<typeof emptyForm>;
  updateField: <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="theme-name">主题名称 *</Label>
        <Input
          id="theme-name"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="如：深海梦境"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="theme-desc">描述</Label>
        <Textarea
          id="theme-desc"
          value={form.description ?? ''}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="简短描述这个主题的风格..."
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="theme-sort">排序</Label>
        <Input
          id="theme-sort"
          type="number"
          value={form.sortOrder}
          onChange={(e) => updateField('sortOrder', Number(e.target.value))}
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch
            checked={form.isActive ?? true}
            onCheckedChange={(v) => updateField('isActive', v)}
          />
          <span className="text-sm">启用</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch
            checked={form.isDefault ?? false}
            onCheckedChange={(v) => updateField('isDefault', v)}
          />
          <span className="text-sm">设为默认主题</span>
        </label>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// 子组件：色板编辑器
// ═══════════════════════════════════════════════════════════

function ColorPaletteEditor({
  colors,
  onChange,
  mode,
}: {
  colors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  mode: 'light' | 'dark';
}) {
  const previewBg = mode === 'dark' ? 'hsl(252 43% 5%)' : 'hsl(156 43% 97%)';

  return (
    <div className="space-y-6">
      {/* 实时预览条 */}
      <div
        className="flex flex-wrap gap-2 rounded-xl p-3"
        style={{ background: previewBg }}
      >
        {['primary', 'secondary', 'accent', 'muted', 'destructive', 'card'].map((k) => {
          const val = colors[k];
          if (!val) return null;
          return (
            <div
              key={k}
              className="flex size-8 items-center justify-center rounded-md text-[9px] font-medium shadow-sm"
              style={{ background: `hsl(${val})`, color: k === 'primary' || k === 'accent' || k === 'destructive' ? '#fff' : '#222' }}
            >
              {k.slice(0, 2)}
            </div>
          );
        })}
      </div>

      {/* 常规色板 */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">主要色板</legend>
        <div className="grid grid-cols-2 gap-3">
          {COLOR_FIELDS.map((field) => (
            <ColorInput
              key={field.key}
              field={field}
              value={colors[field.key] ?? ''}
              onChange={(v) => onChange(field.key, v)}
            />
          ))}
        </div>
      </fieldset>

      {/* 侧栏色板 */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">侧栏色板</legend>
        <div className="grid grid-cols-2 gap-3">
          {SIDEBAR_COLOR_FIELDS.map((field) => (
            <ColorInput
              key={field.key}
              field={field}
              value={colors[field.key] ?? ''}
              onChange={(v) => onChange(field.key, v)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function ColorInput({
  field,
  value,
  onChange,
}: {
  field: ColorFieldDef;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{field.label}</Label>
      <ColorPickerField
        value={value}
        onChange={onChange}
        placeholder={field.hint ?? 'H S% L%'}
        className="w-full"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 子组件：背景 & 装饰
// ═══════════════════════════════════════════════════════════

function BackgroundTab({
  form,
  updateField,
  updateDecoration,
  addDecoration,
  removeDecoration,
}: {
  form: ReturnType<typeof emptyForm>;
  updateField: <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => void;
  updateDecoration: (mode: 'lightDecorations' | 'darkDecorations', index: number, patch: Partial<ThemeDecoration>) => void;
  addDecoration: (mode: 'lightDecorations' | 'darkDecorations') => void;
  removeDecoration: (mode: 'lightDecorations' | 'darkDecorations', index: number) => void;
}) {

  const bgDesc =
    form.bgType === 'gradient'
      ? '粘贴 CSS gradient 字符串，支持多层叠加'
      : form.bgType === 'image'
        ? '上传背景图片，支持 JPG/PNG/WebP，建议分辨率 ≥ 1920×1080'
        : form.bgType === 'video'
          ? '上传背景视频，支持 MP4/WebV，建议静音循环播放'
          : 'PixiJS 粒子动画：星空/雨滴/浪花/极光，需要在代码中配置动画类型';

  return (
    <>
      {/* 背景类型选择器 */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">背景类型</legend>
        <div className="flex gap-4">
            {(['gradient', 'image', 'video', 'animation'] as const).map((type) => {
            const Icon = type === 'gradient' ? Palette : type === 'image' ? ImageIcon : type === 'video' ? Music : Sparkles;
            const label = type === 'gradient' ? 'CSS 渐变' : type === 'image' ? '背景图片' : type === 'video' ? '背景视频' : 'PixiJS 动画';
            return (
              <label
                key={type}
                className={cn(
                  'flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-4 py-3 transition-colors',
                  form.bgType === type
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                )}
              >
                <Icon className="size-5" />
                <span className="text-xs font-medium">{label}</span>
                <input
                  type="radio"
                  name="bgType"
                  value={type}
                  checked={form.bgType === type}
                  onChange={() => updateField('bgType', type)}
                  className="sr-only"
                />
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{bgDesc}</p>
      </fieldset>

      {/* Light 背景 */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-foreground">
          <Sun className="size-3.5" /> Light 模式背景
        </legend>
        {(form.bgType === 'gradient' || form.bgType === 'animation') && (
          <>
            <Textarea
              value={form.lightBackground ?? ''}
              onChange={(e) => updateField('lightBackground', e.target.value)}
              placeholder={
                'radial-gradient(circle at 18% 0%, hsl(166 56% 88% / 0.48), transparent 28rem),\n' +
                'radial-gradient(circle at 88% 10%, hsl(207 86% 92% / 0.58), transparent 24rem),\n' +
                'linear-gradient(180deg, hsl(156 43% 97%) 0%, hsl(204 56% 98%) 52%, #fff 100%)'
              }
              rows={6}
              className="font-mono text-xs"
            />
            {form.lightBackground && (
              <div
                className="h-10 rounded-md border border-border"
                style={{ background: form.lightBackground }}
              />
            )}
            {form.bgType === 'animation' && (
              <p className="text-xs text-muted-foreground">
                PixiJS 动画将由主题 ID 自动匹配（如 theme-ocean, theme-stars）
              </p>
            )}
          </>
        )}
        {form.bgType === 'image' && (
          <FileUploadField
            value={form.lightBackground ?? ''}
            onChange={(url) => updateField('lightBackground', url)}
            accept="image/*"
            uploadLabel="上传背景图"
            placeholder="上传或粘贴浅色模式背景图片 URL"
            previewSize="lg"
          />
        )}
        {form.bgType === 'video' && (
          <FileUploadField
            value={form.lightBackground ?? ''}
            onChange={(url) => updateField('lightBackground', url)}
            accept="video/*"
            uploadLabel="上传视频"
            placeholder="上传或粘贴浅色模式背景视频 URL（mp4/webm）"
          />
        )}
      </fieldset>

      {/* Dark 背景 */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-foreground">
          <Moon className="size-3.5" /> Dark 模式背景
        </legend>
        {(form.bgType === 'gradient' || form.bgType === 'animation') && (
          <>
            <Textarea
              value={form.darkBackground ?? ''}
              onChange={(e) => updateField('darkBackground', e.target.value)}
              placeholder={
                'radial-gradient(circle at 50% 0%, hsl(0 0% 100% / 0.08), transparent 22rem),\n' +
                'radial-gradient(circle at 18% 14%, hsl(330 84% 62% / 0.14), transparent 26rem),\n' +
                'linear-gradient(155deg, hsl(252 43% 5%) 0%, hsl(258 36% 10%) 50%, hsl(336 36% 11%) 100%)'
              }
              rows={6}
              className="font-mono text-xs"
            />
            {form.darkBackground && (
              <div
                className="h-10 rounded-md border border-border"
                style={{ background: form.darkBackground }}
              />
            )}
            {form.bgType === 'animation' && (
              <p className="text-xs text-muted-foreground">
                PixiJS 动画将由主题 ID 自动匹配（如 theme-ocean, theme-stars）
              </p>
            )}
          </>
        )}
        {form.bgType === 'image' && (
          <FileUploadField
            value={form.darkBackground ?? ''}
            onChange={(url) => updateField('darkBackground', url)}
            accept="image/*"
            uploadLabel="上传背景图"
            placeholder="上传或粘贴深色模式背景图片 URL"
            previewSize="lg"
          />
        )}
        {form.bgType === 'video' && (
          <FileUploadField
            value={form.darkBackground ?? ''}
            onChange={(url) => updateField('darkBackground', url)}
            accept="video/*"
            uploadLabel="上传视频"
            placeholder="上传或粘贴深色模式背景视频 URL（mp4/webm）"
          />
        )}
      </fieldset>

      {/* 装饰元素 — 所有背景类型都适用 */}
      <DecorationEditor
        mode="light"
        decorations={form.lightDecorations ?? []}
        onUpdate={(i, p) => updateDecoration('lightDecorations', i, p)}
        onAdd={() => addDecoration('lightDecorations')}
        onRemove={(i) => removeDecoration('lightDecorations', i)}
      />

      <DecorationEditor
        mode="dark"
        decorations={form.darkDecorations ?? []}
        onUpdate={(i, p) => updateDecoration('darkDecorations', i, p)}
        onAdd={() => addDecoration('darkDecorations')}
        onRemove={(i) => removeDecoration('darkDecorations', i)}
      />
    </>
  );
}

function DecorationEditor({
  mode,
  decorations,
  onUpdate,
  onAdd,
  onRemove,
}: {
  mode: 'light' | 'dark';
  decorations: ThemeDecoration[];
  onUpdate: (index: number, patch: Partial<ThemeDecoration>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const Icon = mode === 'light' ? Sun : Moon;

  const parsePct = (val?: string): number => {
    if (!val) return 50;
    const n = parseFloat(val);
    return Number.isNaN(n) ? 50 : Math.round(n);
  };

  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-foreground">
        <Icon className="size-3.5" /> {mode === 'light' ? 'Light' : 'Dark'} 装饰元素
      </legend>

      {decorations.length === 0 && (
        <p className="text-xs text-muted-foreground">暂无装饰元素</p>
      )}

      {decorations.map((deco, i) => (
        <div key={i} className="space-y-3 rounded-lg bg-muted/50 p-3">
          {/* 类型 + 颜色 */}
          <div className="flex gap-2">
            <div className="w-28 space-y-1">
              <Label className="text-[11px]">类型</Label>
              <select
                value={deco.type}
                onChange={(e) => onUpdate(i, { type: e.target.value as ThemeDecoration['type'] })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="glow">光斑 glow</option>
                <option value="grid">网格 grid</option>
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-[11px]">颜色</Label>
              <ColorPickerField
                value={deco.color}
                onChange={(color) => onUpdate(i, { color })}
                placeholder="选择光斑颜色"
                className="h-8 w-full"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onRemove(i)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* X / Y 滑块 */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">水平位置 X</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">{deco.x ?? '50%'}</span>
              </div>
              <Slider
                value={[parsePct(deco.x)]}
                onValueChange={([v]) => onUpdate(i, { x: `${v}%` })}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">垂直位置 Y</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">{deco.y ?? '50%'}</span>
              </div>
              <Slider
                value={[parsePct(deco.y)]}
                onValueChange={([v]) => onUpdate(i, { y: `${v}%` })}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={onAdd} className="gap-1">
        <Plus className="size-3" /> 添加装饰
      </Button>
    </fieldset>
  );
}

// ═══════════════════════════════════════════════════════════
// 子组件：音效
// ═══════════════════════════════════════════════════════════

function BgmTab({
  form,
  updateField,
}: {
  form: ReturnType<typeof emptyForm>;
  updateField: <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>背景音效</Label>
        <FileUploadField
          value={form.bgmUrl ?? ''}
          onChange={(url) => updateField('bgmUrl', url)}
          accept="audio/*"
          uploadLabel="上传音频"
          placeholder="上传或粘贴音频 URL（mp3/ogg/wav）"
        />
        {form.bgmUrl && (
          <AudioPlayerField src={form.bgmUrl} />
        )}
      </div>

      <div className="space-y-2">
        <Label>音量</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[form.bgmVolume ?? 0.3]}
            onValueChange={([v]) => updateField('bgmVolume', v)}
            min={0}
            max={1}
            step={0.05}
            className="flex-1"
          />
          <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
            {Math.round((form.bgmVolume ?? 0.3) * 100)}%
          </span>
        </div>
      </div>
    </>
  );
}
