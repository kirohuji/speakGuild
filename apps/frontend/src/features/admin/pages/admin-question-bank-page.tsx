import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Search, Loader2, Database,
  BookOpen, Layers, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/common/markdown-editor';
import { MarkdownRenderer } from '@/components/common/markdown-renderer';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import {
  getBanks, getBank, createBank, updateBank, deleteBank,
  getTopics, createTopic, updateTopic, deleteTopic,
  getQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion,
  type QuestionBankItem, type QuestionBankDetail,
  type TopicItem,
  type QuestionListItem, type QuestionItemData,
  type CreateBankPayload, type UpdateBankPayload,
  type CreateTopicPayload, type UpdateTopicPayload,
  type CreateQuestionPayload, type UpdateQuestionPayload,
} from '@/features/admin/api-question-bank';

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  'scenic-intro': '景点讲解',
  'service-standard': '导游服务规范',
  'adaptability': '应变能力',
  'comprehensive': '综合知识',
  'detainment': '扣押',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const DIFFICULTY_LABELS: Record<number, string> = {
  1: '⭐ 非常容易',
  2: '⭐⭐ 容易',
  3: '⭐⭐⭐ 中等',
  4: '⭐⭐⭐⭐ 困难',
  5: '⭐⭐⭐⭐⭐ 非常困难',
};

const DIFFICULTY_OPTIONS = Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}));

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════
// Inline message banner
// ═══════════════════════════════════════════════════════════

function MessageBanner({
  message, type, onClose,
}: {
  message: string | null;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'mb-4 flex items-center justify-between rounded-md px-4 py-2.5 text-sm',
        type === 'success'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-red-50 text-red-700 border border-red-200',
      )}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-3 hover:opacity-70">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Bank Selector
// ═══════════════════════════════════════════════════════════

function BankSelector({
  banks,
  selectedBankId,
  onSelect,
  loading,
  onCreateClick,
}: {
  banks: QuestionBankItem[];
  selectedBankId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  onCreateClick: () => void;
}) {
  if (loading) {
    return (
      <div className="flex gap-2 items-center">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-20" />
      </div>
    );
  }

  if (banks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <Database className="h-12 w-12 opacity-20" />
        <p className="text-sm">还没有创建题库</p>
        <Button size="sm" onClick={onCreateClick}>
          <Plus className="mr-1.5 h-4 w-4" />
          创建第一个题库
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {banks.map((bank) => (
        <button
          key={bank.id}
          onClick={() => onSelect(bank.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            selectedBankId === bank.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          <BookOpen className="h-3.5 w-3.5" />
          {bank.name}
          <span className="text-xs opacity-70">({bank.province})</span>
        </button>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        onClick={onCreateClick}
      >
        <Plus className="h-3.5 w-3.5" />
        新建题库
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Topic Tabs
// ═══════════════════════════════════════════════════════════

function TopicTabs({
  topics,
  selectedTopicId,
  onSelect,
  onCreateClick,
}: {
  topics: TopicItem[];
  selectedTopicId: string | null;
  onSelect: (id: string | null) => void;
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          selectedTopicId === null
            ? 'bg-foreground text-background'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        全部
      </button>
      {topics.map((topic) => (
        <button
          key={topic.id}
          onClick={() => onSelect(topic.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            selectedTopicId === topic.id
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {CATEGORY_LABELS[topic.code] || topic.name}
          <span className="text-xs opacity-60">{topic._count.items}</span>
        </button>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={onCreateClick}
      >
        <Plus className="h-3 w-3" />
        添加分类
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Pagination
// ═══════════════════════════════════════════════════════════

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-xs text-muted-foreground">
        共 {total} 条，第 {page}/{totalPages} 页
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Bank Dialog (Create / Edit)
// ═══════════════════════════════════════════════════════════

function BankDialog({
  open,
  mode,
  bank,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  bank: QuestionBankItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [language, setLanguage] = useState('zh-CN');
  const [examType, setExamType] = useState('');
  const [interviewForm, setInterviewForm] = useState('');
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === 'edit' && bank) {
      setName(bank.name);
      setProvince(bank.province);
      setLanguage(bank.language);
      setExamType(bank.examType);
      setInterviewForm(bank.interviewForm);
      setStatus(bank.status);
    } else if (open && mode === 'create') {
      setName('');
      setProvince('');
      setLanguage('zh-CN');
      setExamType('');
      setInterviewForm('');
      setStatus('active');
    }
    setError(null);
  }, [open, mode, bank]);

  const handleSave = async () => {
    if (!name.trim() || !province.trim() || !examType.trim()) {
      setError('请填写必填字段');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        await createBank({
          name: name.trim(),
          province: province.trim(),
          language,
          examType: examType.trim(),
          interviewForm: interviewForm.trim(),
          status,
        });
      } else if (bank) {
        await updateBank(bank.id, {
          name: name.trim(),
          province: province.trim(),
          language,
          examType: examType.trim(),
          interviewForm: interviewForm.trim(),
          status,
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建题库' : '编辑题库'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '创建一个新的考试题库' : '修改题库基本信息'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-3">
          <div>
            <Label>题库名称 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：全国导游资格考试题库" />
          </div>
          <div>
            <Label>地区 *</Label>
            <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="如：全国 / 北京 / 广东" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>语言</Label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <SelectItem value="zh-CN">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </Select>
            </div>
            <div>
              <Label>状态</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </Select>
            </div>
          </div>
          <div>
            <Label>考试类型 *</Label>
            <Input value={examType} onChange={(e) => setExamType(e.target.value)} placeholder="如：导游资格考试" />
          </div>
          <div>
            <Label>面试形式</Label>
            <Input value={interviewForm} onChange={(e) => setInterviewForm(e.target.value)} placeholder="如：现场面试 / 机考" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? '创建' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// Topic Dialog (Create / Edit)
// ═══════════════════════════════════════════════════════════

function TopicDialog({
  open,
  mode,
  topic,
  bankId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  topic: TopicItem | null;
  bankId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === 'edit' && topic) {
      setCode(topic.code);
      setName(topic.name);
      setSortOrder(topic.sortOrder);
    } else if (open && mode === 'create') {
      setCode('');
      setName('');
      setSortOrder(0);
    }
    setError(null);
  }, [open, mode, topic]);

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      setError('请填写必填字段');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        await createTopic({ bankId, code: code.trim(), name: name.trim(), sortOrder });
      } else if (topic) {
        await updateTopic(topic.id, { code: code.trim(), name: name.trim(), sortOrder });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '添加题目分类' : '编辑分类'}</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-3">
          <div>
            <Label>分类名称 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：景点讲解" />
          </div>
          <div>
            <Label>分类 Code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="如：scenic-intro" />
            {mode === 'create' && (
              <p className="mt-1 text-xs text-muted-foreground">
                推荐: scenic-intro / service-standard / adaptability / comprehensive / detainment
              </p>
            )}
          </div>
          <div>
            <Label>排序</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? '添加' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// Question Dialog (Create / Edit)
// ═══════════════════════════════════════════════════════════

function QuestionDialog({
  open,
  mode,
  question,
  topics,
  defaultTopicId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit' | 'view';
  question: QuestionItemData | null;
  topics: TopicItem[];
  defaultTopicId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [durationSec, setDurationSec] = useState(120);
  const [keywords, setKeywords] = useState('');
  const [focusWords, setFocusWords] = useState('');
  const [promptEn, setPromptEn] = useState('');
  const [promptZh, setPromptZh] = useState('');
  const [answerEn, setAnswerEn] = useState('');
  const [answerZh, setAnswerZh] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isView = mode === 'view';

  useEffect(() => {
    if (open) {
      if (question) {
        setTopicId(question.topicId);
        setTitle(question.title);
        setDifficulty(question.difficulty);
        setDurationSec(question.suggestedDurationSec);
        setKeywords(question.keywords?.join(', ') || '');
        setFocusWords(question.focusWords?.join(', ') || '');
        setPromptEn(question.content?.promptEn || '');
        setPromptZh(question.content?.promptZh || '');
        setAnswerEn(question.content?.answerEn || '');
        setAnswerZh(question.content?.answerZh || '');
        setSummary(question.content?.summary || '');
      } else {
        setTopicId(defaultTopicId || '');
        setTitle('');
        setDifficulty(3);
        setDurationSec(120);
        setKeywords('');
        setFocusWords('');
        setPromptEn('');
        setPromptZh('');
        setAnswerEn('');
        setAnswerZh('');
        setSummary('');
      }
      setError(null);
    }
  }, [open, question, defaultTopicId]);

  const buildPayload = (): CreateQuestionPayload => ({
    topicId,
    title: title.trim(),
    difficulty,
    suggestedDurationSec: durationSec,
    keywords: keywords ? keywords.split(',').map(s => s.trim()).filter(Boolean) : [],
    focusWords: focusWords ? focusWords.split(',').map(s => s.trim()).filter(Boolean) : [],
    promptEn,
    promptZh,
    answerEn,
    answerZh,
    summary,
  });

  const handleSave = async () => {
    if (!topicId || !title.trim()) {
      setError('请选择分类并填写题目');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        await createQuestion(buildPayload());
      } else if (question) {
        await updateQuestion(question.id, buildPayload() as UpdateQuestionPayload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '新建题目' : mode === 'edit' ? '编辑题目' : '题目详情'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>所属分类 *</Label>
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={isView}>
                <SelectItem value="" disabled>选择分类</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {CATEGORY_LABELS[t.code] || t.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div>
              <Label>难度</Label>
              <Select
                value={String(difficulty)}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                disabled={isView}
              >
                {DIFFICULTY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>题目 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入题目内容"
              disabled={isView}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>建议答题时间（秒）</Label>
              <Input
                type="number"
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                disabled={isView}
              />
            </div>
            <div>
              <Label>关键词（逗号分隔）</Label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="如：故宫, 历史, 建筑"
                disabled={isView}
              />
            </div>
          </div>

          <div>
            <Label>重点词汇（逗号分隔）</Label>
            <Input
              value={focusWords}
              onChange={(e) => setFocusWords(e.target.value)}
              placeholder="如：太和殿, 乾清宫"
              disabled={isView}
            />
          </div>

          {/* 题目内容 — 双语（Markdown） */}
          <div className="border-t pt-4">
            <Label className="text-sm font-semibold mb-3 block">题目内容（支持 Markdown 格式）</Label>
            <div className="grid gap-4">
              {isView ? (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">题目（英文）</Label>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[60px]">
                      <MarkdownRenderer content={promptEn} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">题目（中文）</Label>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[60px]">
                      <MarkdownRenderer content={promptZh} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">答案（英文）</Label>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[60px]">
                      <MarkdownRenderer content={answerEn} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">答案（中文）</Label>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[60px]">
                      <MarkdownRenderer content={answerZh} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">摘要 / 要点</Label>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[60px]">
                      <MarkdownRenderer content={summary} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <MarkdownEditor
                    label="题目（英文）"
                    value={promptEn}
                    onChange={setPromptEn}
                    height={200}
                    placeholder="English prompt (Markdown supported)..."
                  />
                  <MarkdownEditor
                    label="题目（中文）"
                    value={promptZh}
                    onChange={setPromptZh}
                    height={200}
                    placeholder="中文题目（支持 Markdown）..."
                  />
                  <MarkdownEditor
                    label="答案（英文）"
                    value={answerEn}
                    onChange={setAnswerEn}
                    height={200}
                    placeholder="English answer (Markdown supported)..."
                  />
                  <MarkdownEditor
                    label="答案（中文）"
                    value={answerZh}
                    onChange={setAnswerZh}
                    height={200}
                    placeholder="中文答案（支持 Markdown）..."
                  />
                  <MarkdownEditor
                    label="摘要 / 要点"
                    value={summary}
                    onChange={setSummary}
                    height={150}
                    placeholder="题目摘要或答题要点（支持 Markdown）..."
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {isView ? '关闭' : '取消'}
          </Button>
          {!isView && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? '创建' : '保存'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════

export function AdminQuestionBankPage() {
  // Banks
  const [banks, setBanks] = useState<QuestionBankItem[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  // Bank dialog
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankDialogMode, setBankDialogMode] = useState<'create' | 'edit'>('create');
  const [editingBank, setEditingBank] = useState<QuestionBankItem | null>(null);

  // Topics
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Topic dialog
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [topicDialogMode, setTopicDialogMode] = useState<'create' | 'edit'>('create');
  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);

  // Questions
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [questionsPage, setQuestionsPage] = useState(1);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Question dialog
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [questionDialogMode, setQuestionDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingQuestion, setEditingQuestion] = useState<QuestionItemData | null>(null);

  // Message
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const PAGE_SIZE = 20;

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // ─── Fetch Banks ──────────────────────────────────────────

  const fetchBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      const data = await getBanks();
      setBanks(data);
      if (data.length > 0 && !selectedBankId) {
        setSelectedBankId(data[0].id);
      }
    } catch {
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  }, []);

  // ─── Fetch Topics ─────────────────────────────────────────

  const fetchTopics = useCallback(async (bankId: string) => {
    try {
      const data = await getTopics(bankId);
      setTopics(data);
    } catch {
      setTopics([]);
    }
  }, []);

  // ─── Fetch Questions ──────────────────────────────────────

  const fetchQuestions = useCallback(async (params?: {
    bankId?: string;
    topicId?: string | null;
    keyword?: string;
    page?: number;
  }) => {
    setQuestionsLoading(true);
    try {
      const query: Record<string, any> = {
        page: params?.page ?? 1,
        pageSize: PAGE_SIZE,
      };
      if (params?.bankId) query.bankId = params.bankId;
      if (params?.topicId) query.topicId = params.topicId;
      if (params?.keyword) query.keyword = params.keyword;

      const data = await getQuestions(query);
      setQuestions(data.list);
      setQuestionsTotal(data.total);
      setQuestionsPage(data.page);
    } catch {
      setQuestions([]);
      setQuestionsTotal(0);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  // ─── Effects ──────────────────────────────────────────────

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  useEffect(() => {
    if (selectedBankId) {
      fetchTopics(selectedBankId);
      setSelectedTopicId(null);
      setSearchKeyword('');
    }
  }, [selectedBankId, fetchTopics]);

  useEffect(() => {
    if (selectedBankId) {
      fetchQuestions({
        bankId: selectedBankId,
        topicId: selectedTopicId,
        keyword: searchKeyword,
        page: 1,
      });
    }
  }, [selectedBankId, selectedTopicId, fetchQuestions]);

  const doSearch = () => {
    if (selectedBankId) {
      fetchQuestions({
        bankId: selectedBankId,
        topicId: selectedTopicId,
        keyword: searchKeyword,
        page: 1,
      });
    }
  };

  const handlePageChange = (page: number) => {
    if (selectedBankId) {
      fetchQuestions({
        bankId: selectedBankId,
        topicId: selectedTopicId,
        keyword: searchKeyword,
        page,
      });
    }
  };

  // ─── Bank Actions ─────────────────────────────────────────

  const handleCreateBank = () => {
    setEditingBank(null);
    setBankDialogMode('create');
    setBankDialogOpen(true);
  };

  const handleEditBank = () => {
    const bank = banks.find(b => b.id === selectedBankId);
    if (!bank) return;
    setEditingBank(bank);
    setBankDialogMode('edit');
    setBankDialogOpen(true);
  };

  const handleDeleteBank = async () => {
    const bank = banks.find(b => b.id === selectedBankId);
    if (!bank) return;
    if (!confirm(`确定要删除题库「${bank.name}」吗？\n\n此操作将同时删除该题库下的所有分类和题目，不可恢复！`)) return;
    try {
      await deleteBank(bank.id);
      showMessage('题库已删除', 'success');
      setSelectedBankId(null);
      fetchBanks();
    } catch (e: any) {
      showMessage(e?.response?.data?.message || '删除失败', 'error');
    }
  };

  // ─── Topic Actions ────────────────────────────────────────

  const handleCreateTopic = () => {
    if (!selectedBankId) return;
    setEditingTopic(null);
    setTopicDialogMode('create');
    setTopicDialogOpen(true);
  };

  const handleEditTopic = (topic: TopicItem) => {
    setEditingTopic(topic);
    setTopicDialogMode('edit');
    setTopicDialogOpen(true);
  };

  const handleDeleteTopic = async (topic: TopicItem) => {
    if (!confirm(`确定要删除分类「${topic.name}」吗？`)) return;
    try {
      await deleteTopic(topic.id);
      showMessage('分类已删除', 'success');
      if (selectedBankId) fetchTopics(selectedBankId);
    } catch (e: any) {
      showMessage(e?.response?.data?.message || '删除失败', 'error');
    }
  };

  // ─── Question Actions ─────────────────────────────────────

  const handleCreateQuestion = () => {
    if (!selectedBankId) return;
    setEditingQuestion(null);
    setQuestionDialogMode('create');
    setQuestionDialogOpen(true);
  };

  const handleViewQuestion = async (item: QuestionListItem) => {
    try {
      const data = await getQuestion(item.id);
      setEditingQuestion(data);
      setQuestionDialogMode('view');
      setQuestionDialogOpen(true);
    } catch {
      showMessage('获取题目详情失败', 'error');
    }
  };

  const handleEditQuestion = async (item: QuestionListItem) => {
    try {
      const data = await getQuestion(item.id);
      setEditingQuestion(data);
      setQuestionDialogMode('edit');
      setQuestionDialogOpen(true);
    } catch {
      showMessage('获取题目详情失败', 'error');
    }
  };

  const handleDeleteQuestion = async (item: QuestionListItem) => {
    if (!confirm(`确定要删除题目「${item.title.slice(0, 50)}...」吗？`)) return;
    try {
      await deleteQuestion(item.id);
      showMessage('题目已删除', 'success');
      fetchQuestions({
        bankId: selectedBankId!,
        topicId: selectedTopicId,
        keyword: searchKeyword,
        page: questionsPage,
      });
    } catch {
      showMessage('删除失败', 'error');
    }
  };

  const handleQuestionSaved = () => {
    showMessage(
      questionDialogMode === 'create' ? '题目已创建' : '题目已更新',
      'success',
    );
    if (selectedBankId) {
      fetchQuestions({
        bankId: selectedBankId,
        topicId: selectedTopicId,
        keyword: searchKeyword,
        page: questionsPage,
      });
      fetchTopics(selectedBankId);
    }
  };

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <MessageBanner
        message={message?.text ?? null}
        type={message?.type ?? 'success'}
        onClose={() => setMessage(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">题库管理</h1>
          <p className="text-sm text-muted-foreground">管理考试题库、题目分类和题目内容</p>
        </div>
      </div>

      {/* Bank Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              选择题库
            </CardTitle>
            {selectedBankId && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={handleEditBank}>
                  <Edit3 className="mr-1 h-3.5 w-3.5" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={handleDeleteBank}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  删除
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <BankSelector
            banks={banks}
            selectedBankId={selectedBankId}
            onSelect={setSelectedBankId}
            loading={banksLoading}
            onCreateClick={handleCreateBank}
          />
        </CardContent>
      </Card>

      {/* Topic Tabs + Search + Toolbar */}
      {selectedBankId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              题目分类
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <TopicTabs
              topics={topics}
              selectedTopicId={selectedTopicId}
              onSelect={setSelectedTopicId}
              onCreateClick={handleCreateTopic}
            />

            {/* Topic management — delete/edit buttons */}
            {selectedTopicId && (
              <div className="flex gap-1 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const t = topics.find(tp => tp.id === selectedTopicId);
                    if (t) handleEditTopic(t);
                  }}
                >
                  <Edit3 className="mr-1 h-3 w-3" />
                  编辑此分类
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => {
                    const t = topics.find(tp => tp.id === selectedTopicId);
                    if (t) handleDeleteTopic(t);
                  }}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  删除此分类
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Question Table */}
      {selectedBankId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                题目列表
                {questionsTotal > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (共 {questionsTotal} 题)
                  </span>
                )}
              </CardTitle>
              <Button size="sm" onClick={handleCreateQuestion}>
                <Plus className="mr-1.5 h-4 w-4" />
                新建题目
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="搜索题目..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
                />
              </div>
              <Button variant="outline" size="sm" onClick={doSearch}>
                搜索
              </Button>
            </div>

            {/* Table */}
            {questionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <BookOpen className="h-10 w-10 opacity-20" />
                <p className="text-sm">暂无题目</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2.5 text-left font-medium">题目</th>
                        <th className="px-3 py-2.5 text-left font-medium w-24">分类</th>
                        <th className="px-3 py-2.5 text-center font-medium w-20">难度</th>
                        <th className="px-3 py-2.5 text-left font-medium w-40">关键词</th>
                        <th className="px-3 py-2.5 text-left font-medium w-20">时长</th>
                        <th className="px-3 py-2.5 text-left font-medium w-36">更新时间</th>
                        <th className="px-3 py-2.5 text-right font-medium w-28">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => handleViewQuestion(item)}
                        >
                          <td className="px-3 py-2.5 max-w-xs truncate font-medium">
                            {item.title}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="secondary" className="text-xs">
                              {CATEGORY_LABELS[item.topic.code] || item.topic.name}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {'⭐'.repeat(item.difficulty)}
                          </td>
                          <td className="px-3 py-2.5 max-w-[160px] truncate text-muted-foreground">
                            {item.keywords?.join(', ') || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {item.suggestedDurationSec}s
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {formatDate(item.updatedAt)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditQuestion(item);
                                }}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteQuestion(item);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={questionsPage}
                  pageSize={PAGE_SIZE}
                  total={questionsTotal}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <BankDialog
        open={bankDialogOpen}
        mode={bankDialogMode}
        bank={editingBank}
        onClose={() => setBankDialogOpen(false)}
        onSaved={() => {
          fetchBanks();
          if (editingBank && selectedBankId === editingBank.id && selectedBankId) {
            fetchTopics(selectedBankId);
          }
        }}
      />

      <TopicDialog
        open={topicDialogOpen}
        mode={topicDialogMode}
        topic={editingTopic}
        bankId={selectedBankId || ''}
        onClose={() => setTopicDialogOpen(false)}
        onSaved={() => {
          if (selectedBankId) fetchTopics(selectedBankId);
        }}
      />

      <QuestionDialog
        open={questionDialogOpen}
        mode={questionDialogMode}
        question={editingQuestion}
        topics={topics}
        defaultTopicId={selectedTopicId}
        onClose={() => setQuestionDialogOpen(false)}
        onSaved={handleQuestionSaved}
      />
    </div>
  );
}
