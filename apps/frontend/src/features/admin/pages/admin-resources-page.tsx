import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Folder, File, FileVideo, FileAudio, FileImage, FileText, FileArchive,
  Plus, Trash2, Edit3, Save, ChevronRight, ChevronDown, ArrowLeft,
  ShieldAlert, Loader2, ExternalLink, Upload, Package, HardDrive,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectItem,
} from '@/components/ui/select';
import { MarkdownEditor } from '@/components/common/markdown-editor';
import { MarkdownRenderer } from '@/components/common/markdown-renderer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import {
  getResourceTree,
  createResourceNode, updateResourceNode, deleteResourceNode,
  type ResourceTreeNode, type CreateResourceNodePayload,
} from '@/features/admin/api-resources';
import { uploadFileToCosAndComplete } from '@/features/file-assets/api';
import { useAuth } from '@/providers/auth-provider';

const typeLabels: Record<string, string> = {
  folder: '文件夹',
  video_url: '视频地址',
  video: '视频文件',
  audio: '音频文件',
  pdf: 'PDF文档',
  image: '图片',
  document: '文档',
  other: '其他',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  video_url: FileVideo,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  image: FileImage,
  document: FileText,
  other: FileArchive,
};

const typeOptions = Object.entries(typeLabels)
  .filter(([k]) => k !== 'folder')
  .map(([value, label]) => ({ value, label }));

function mimeToResourceType(mime: string): string {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (
    mime.includes('document') ||
    mime.includes('text') ||
    mime.includes('msword') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation')
  )
    return 'document';
  return 'other';
}

function filenameWithoutExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}

function filterFoldersOnly(nodes: ResourceTreeNode[]): ResourceTreeNode[] {
  return nodes
    .filter((n) => n.type === 'folder')
    .map((n) => ({
      ...n,
      children: filterFoldersOnly(n.children || []),
    }));
}

function findNodeById(nodes: ResourceTreeNode[], id: string): ResourceTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countResources(nodes: ResourceTreeNode[]): { folders: number; files: number; totalSize: number } {
  let folders = 0
  let files = 0
  let totalSize = 0
  for (const node of nodes) {
    if (node.type === 'folder') {
      folders++
      if (node.children?.length) {
        const sub = countResources(node.children)
        folders += sub.folders
        files += sub.files
        totalSize += sub.totalSize
      }
    } else {
      files++
      if (node.fileSize) totalSize += node.fileSize
    }
  }
  return { folders, files, totalSize }
}

function StatsOverview({ tree }: { tree: ResourceTreeNode[] }) {
  if (tree.length === 0) return null
  const { folders, files, totalSize } = countResources(tree)

  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">资料总数</p>
            <p className="text-lg font-bold">{folders + files}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
            <Folder className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">文件夹</p>
            <p className="text-lg font-bold">{folders}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
            <File className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">文件</p>
            <p className="text-lg font-bold">{files}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
            <HardDrive className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">总大小</p>
            <p className="text-lg font-bold">{formatSize(totalSize)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminResourcesPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [tree, setTree] = useState<ResourceTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ResourceTreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Create state
  const [isCreating, setIsCreating] = useState(false);
  const [createMode, setCreateMode] = useState<'folder' | 'resource' | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('pdf');
  const [createUrl, setCreateUrl] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Inline rename state (for children in the card grid)
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // Dialog state for viewing resource details
  const [viewingResource, setViewingResource] = useState<ResourceTreeNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'delete-confirm'>('view');
  const [dialogEditName, setDialogEditName] = useState('');
  const [dialogEditUrl, setDialogEditUrl] = useState('');
  const [dialogEditDescription, setDialogEditDescription] = useState('');
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogDeleting, setDialogDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const treeData = await getResourceTree();
      setTree(treeData);
      return { tree: treeData };
    } catch {
      setTree([]);
      return { tree: [] as ResourceTreeNode[] };
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectNode = async (node: ResourceTreeNode) => {
    // 如果是文件夹，从完整树中查找以获取包含资源文件的完整 children
    let fullNode = node;
    if (node.type === 'folder') {
      const found = findNodeById(tree, node.id);
      if (found) fullNode = found;
    }
    setSelectedNode(fullNode);
    setIsCreating(false);
    setIsEditing(false);
    setEditName(fullNode.name);
    setEditType(fullNode.type);
    setEditUrl(fullNode.url ?? '');
    setEditDescription(fullNode.description ?? '');
  };

  const handleSave = async () => {
    if (!selectedNode) return;
    setSaving(true);
    try {
      await updateResourceNode(selectedNode.id, {
        name: editName,
        url: editUrl || null,
        description: editDescription || null,
      });
      const result = await fetchData();
      if (result) {
        const updatedNode = findNodeById(result.tree, selectedNode.id);
        if (updatedNode) {
          setSelectedNode(updatedNode);
        } else {
          setSelectedNode((prev) =>
            prev ? { ...prev, name: editName, url: editUrl || null, description: editDescription || null } : null
          );
        }
      }
      setIsEditing(false);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    if (!confirm(`确定要删除「${selectedNode.name}」${selectedNode.children?.length ? '及其所有子节点' : ''}吗？`)) return;
    setDeleting(true);
    try {
      await deleteResourceNode(selectedNode.id);
      setSelectedNode(null);
      setIsEditing(false);
      setRenamingId(null);
      await fetchData();
    } catch {
      // handle error
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteChild = async (childId: string, childName: string) => {
    if (!confirm(`确定要删除「${childName}」吗？此操作不可撤销。`)) return;
    try {
      await deleteResourceNode(childId);
      const result = await fetchData();
      // 刷新 selectedNode
      if (selectedNode && result) {
        const updatedNode = findNodeById(result.tree, selectedNode.id);
        if (updatedNode) setSelectedNode(updatedNode);
      }
    } catch {
      // handle error
    }
  };

  const handleInlineRename = async (childId: string) => {
    if (!renameValue.trim() || !selectedNode) return;
    setRenameSaving(true);
    try {
      await updateResourceNode(childId, { name: renameValue.trim() });
      const result = await fetchData();
      if (selectedNode && result) {
        const updatedNode = findNodeById(result.tree, selectedNode.id);
        if (updatedNode) setSelectedNode(updatedNode);
      }
      setRenamingId(null);
    } catch {
      // handle error
    } finally {
      setRenameSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setSaving(true);
    try {
      let assetId: string | undefined;
      let fileMimeType: string | undefined;
      let fileSize: number | undefined;

      // 如果是资源模式且有文件，先上传文件
      if (createMode === 'resource' && createFile && createType !== 'video_url') {
        setUploading(true);
        try {
          const result = await uploadFileToCosAndComplete({
            file: createFile,
            group: 'library',
          });
          assetId = result.id;
          fileMimeType = createFile.type || 'application/octet-stream';
          fileSize = createFile.size;
        } finally {
          setUploading(false);
        }
      }

      const payload: CreateResourceNodePayload = {
        parentId: createParentId ?? undefined,
        name: createName.trim(),
        type: createMode === 'folder' ? 'folder' : createType,
      };
      if (assetId) payload.assetId = assetId;
      if (fileMimeType) payload.mimeType = fileMimeType;
      if (fileSize !== undefined) payload.fileSize = fileSize;
      if (createMode === 'resource' && createType === 'video_url' && createUrl) {
        payload.url = createUrl;
      }
      await createResourceNode(payload);
      setIsCreating(false);
      setCreateName('');
      setCreateUrl('');
      setCreateFile(null);
      // Expand parent
      if (createParentId) {
        setExpandedIds((prev) => new Set(prev).add(createParentId));
      }
      const result = await fetchData();
      // 如果是在当前选中文件夹下创建的，刷新该文件夹数据
      if (selectedNode && selectedNode.id === createParentId && result) {
        const updatedNode = findNodeById(result.tree, selectedNode.id);
        if (updatedNode) setSelectedNode(updatedNode);
      }
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  if (session && session.user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/30" />
        <p className="mt-4 text-lg font-semibold text-muted-foreground">需要管理员权限</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">资料库管理</h1>
          <p className="text-sm text-muted-foreground">通过文件夹管理学习资料，支持视频、音频、PDF 等多种格式</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateMode('folder');
              setCreateParentId(null);
              setCreateName('');
              setCreateFile(null);
              setIsCreating(true);
              setSelectedNode(null);
              setIsEditing(false);
            }}
          >
            <FolderOpen className="mr-1.5 h-4 w-4" />
            新建根文件夹
          </Button>
        </div>
      </div>

      {/* 统计概览 */}
      <StatsOverview tree={tree} />

      {/* Main Content */}
      <div className="flex gap-4">
        {/* Left: Tree Panel */}
        <Card className="w-72 flex-shrink-0 shadow-none">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              目录结构
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 max-h-[calc(100vh-260px)] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : tree.length === 0 ? (
              <div className="py-8 text-center">
                <Folder className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="mt-2 text-xs text-muted-foreground">暂无资料</p>
              </div>
            ) : (
              filterFoldersOnly(tree).map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedIds}
                  selectedId={selectedNode?.id ?? null}
                  onToggle={toggleExpand}
                  onSelect={selectNode}
                  onAddFolder={(parentId) => {
                    setCreateMode('folder');
                    setCreateParentId(parentId);
                    setCreateName('');
                    setCreateFile(null);
                    setIsCreating(true);
                    setSelectedNode(null);
                    setIsEditing(false);
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Right: Detail / Create Panel */}
        <Card className="flex-1 shadow-none">
          <CardContent className="p-4">
            {isCreating ? (
              // ─── Create Form ───
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {createMode === 'folder' ? (
                    <FolderOpen className="h-5 w-5 text-amber-500" />
                  ) : (
                    <File className="h-5 w-5 text-blue-500" />
                  )}
                  <h3 className="text-lg font-semibold">
                    {createMode === 'folder' ? '新建文件夹' : '新建资料'}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>名称</Label>
                    <Input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder={createMode === 'folder' ? '文件夹名称' : '资料名称'}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                  </div>

                  {createMode === 'resource' && (
                    <>
                      <div>
                        <Label>类型</Label>
                        <Select value={createType} onChange={(e) => setCreateType(e.target.value)}>
                          {typeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>

                      {createType === 'video_url' ? (
                        <div>
                          <Label>视频地址</Label>
                          <Input
                            value={createUrl}
                            onChange={(e) => setCreateUrl(e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      ) : (
                        <div>
                          <Label>上传文件</Label>
                          {createFile ? (
                            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                              {React.createElement(typeIcons[createType] || File, {
                                className: 'h-5 w-5 text-muted-foreground flex-shrink-0',
                              })}
                              <span className="text-sm truncate flex-1 min-w-0">{createFile.name}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatSize(createFile.size)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => {
                                  setCreateFile(null);
                                  if (!createName.trim() || createName === filenameWithoutExtension(createFile.name)) {
                                    setCreateName('');
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <label className={cn(
                              'flex flex-col items-center justify-center gap-2',
                              'rounded-lg border-2 border-dashed border-border',
                              'px-4 py-6 cursor-pointer transition-colors',
                              'hover:border-primary/50 hover:bg-muted/30',
                            )}>
                              <Upload className="h-8 w-8 text-muted-foreground/50" />
                              <p className="text-sm text-muted-foreground">点击选择文件</p>
                              <p className="text-xs text-muted-foreground/60">支持视频、音频、PDF、图片、文档等</p>
                              <input
                                type="file"
                                className="hidden"
                                accept="*/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setCreateFile(file);
                                  // 自动填充名称为文件名（不含扩展名）
                                  setCreateName(filenameWithoutExtension(file.name));
                                  // 自动检测类型
                                  setCreateType(mimeToResourceType(file.type));
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={saving || !createName.trim() || (createMode === 'resource' && createType !== 'video_url' && !createFile)}
                    size="sm"
                  >
                    {uploading || saving ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : null}
                    {uploading ? '上传中...' : '创建'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : !selectedNode ? (
              // ─── Empty State ───
              <div className="flex flex-col items-center py-16 text-center">
                <FolderOpen className="h-16 w-16 text-muted-foreground/20" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">从左侧目录中选择一个文件夹</p>
                <p className="mt-1 text-xs text-muted-foreground/60">查看和管理该文件夹下的资料</p>
              </div>
            ) : isEditing ? (
              // ─── Edit Form ───
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">编辑：{selectedNode.name}</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>名称</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>

                  {selectedNode.type === 'video_url' && (
                    <div>
                      <Label>视频地址</Label>
                      <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                    </div>
                  )}

                  <div>
                    <MarkdownEditor
                      label="描述（支持 Markdown）"
                      value={editDescription}
                      onChange={setEditDescription}
                      height={180}
                      placeholder="输入描述内容..."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={handleSave} disabled={saving || !editName.trim()} size="sm">
                    {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    <Save className="mr-1.5 h-4 w-4" />
                    保存
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setIsEditing(false);
                    setEditName(selectedNode.name);
                    setEditUrl(selectedNode.url ?? '');
                    setEditDescription(selectedNode.description ?? '');
                  }}>
                    取消
                  </Button>
                </div>
              </div>
            ) : selectedNode.type === 'folder' ? (
              // ─── Folder Browser View ───
              <div className="space-y-4">
                {/* Folder Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 border border-amber-200">
                      <FolderOpen className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{selectedNode.name}</h3>
                        <Badge variant="secondary" className="text-xs">文件夹</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedNode.children?.length || 0} 项
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCreateMode('folder');
                        setCreateParentId(selectedNode.id);
                        setCreateName('');
                        setCreateFile(null);
                        setIsCreating(true);
                      }}
                    >
                      <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                      新建子文件夹
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCreateMode('resource');
                        setCreateParentId(selectedNode.id);
                        setCreateName('');
                        setCreateType('pdf');
                        setCreateUrl('');
                        setCreateFile(null);
                        setIsCreating(true);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      上传资料
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit3 className="mr-1 h-3.5 w-3.5" />
                      重命名
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Children Grid */}
                {(!selectedNode.children || selectedNode.children.length === 0) ? (
                  <div className="flex flex-col items-center py-12 text-center rounded-lg border-2 border-dashed border-border">
                    <Folder className="h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm text-muted-foreground">此文件夹为空</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">点击上方按钮添加子文件夹或上传资料</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {selectedNode.children.map((child) => (
                      <div
                        key={child.id}
                        className={cn(
                          'group relative flex flex-col items-center gap-2 rounded-lg border border-border',
                          'p-3 cursor-pointer transition-all',
                          'hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm',
                        )}
                        onClick={() => {
                          if (child.type === 'folder') {
                            // 导航进入子文件夹
                            selectNode(child);
                            setExpandedIds((prev) => {
                              const next = new Set(prev);
                              next.add(child.id);
                              return next;
                            });
                          } else {
                            // 弹出详情对话框
                            setViewingResource(child);
                            setDialogMode('view');
                            setDialogOpen(true);
                          }
                        }}
                      >
                        {/* Action buttons on hover */}
                        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-0.5">
                          {renamingId === child.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInlineRename(child.id);
                                }}
                                disabled={renameSaving || !renameValue.trim()}
                              >
                                {renameSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingId(null);
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                title="重命名"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingId(child.id);
                                  setRenameValue(child.name);
                                }}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                title="删除"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChild(child.id, child.name);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Icon */}
                        <div className={cn(
                          'flex h-14 w-14 items-center justify-center rounded-xl border',
                          child.type === 'folder' ? 'bg-amber-50 border-amber-200' :
                          child.type.includes('video') ? 'bg-blue-50 border-blue-200' :
                          child.type === 'audio' ? 'bg-emerald-50 border-emerald-200' :
                          child.type === 'pdf' ? 'bg-red-50 border-red-200' :
                          child.type === 'image' ? 'bg-purple-50 border-purple-200' :
                          'bg-muted/50 border-border',
                        )}>
                          {React.createElement(typeIcons[child.type] || File, {
                            className: cn(
                              'h-7 w-7',
                              child.type === 'folder' ? 'text-amber-500' :
                              child.type.includes('video') ? 'text-blue-500' :
                              child.type === 'audio' ? 'text-emerald-500' :
                              child.type === 'pdf' ? 'text-red-500' :
                              child.type === 'image' ? 'text-purple-500' :
                              'text-muted-foreground',
                            ),
                          })}
                        </div>

                        {/* Name */}
                        <div className="w-full text-center min-w-0">
                          {renamingId === child.id ? (
                            <Input
                              className="h-7 text-xs text-center"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') handleInlineRename(child.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <>
                              <p className="text-sm font-medium truncate">{child.name}</p>
                              {child.type !== 'folder' && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {typeLabels[child.type] || child.type}
                                  {child.fileSize ? ` · ${formatSize(child.fileSize)}` : ''}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ─── Resource Detail Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setDialogMode('view');
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewingResource && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {React.createElement(typeIcons[viewingResource.type] || File, {
                    className: cn(
                      'h-5 w-5',
                      viewingResource.type.includes('video') ? 'text-blue-500' :
                      viewingResource.type === 'audio' ? 'text-emerald-500' :
                      viewingResource.type === 'pdf' ? 'text-red-500' :
                      viewingResource.type === 'image' ? 'text-purple-500' :
                      'text-muted-foreground',
                    ),
                  })}
                  {dialogMode === 'edit' ? `编辑：${viewingResource.name}` : viewingResource.name}
                </DialogTitle>
              </DialogHeader>

              {dialogMode === 'delete-confirm' ? (
                // ─── 删除确认 ───
                <div className="space-y-4">
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <Trash2 className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-destructive">确认删除</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          确定要删除 <span className="font-medium text-foreground">「{viewingResource.name}」</span> 吗？
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">此操作不可撤销。</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogMode('view')}
                      disabled={dialogDeleting}
                    >
                      取消
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={dialogDeleting}
                      onClick={async () => {
                        setDialogDeleting(true);
                        try {
                          await deleteResourceNode(viewingResource.id);
                          setDialogOpen(false);
                          setDialogMode('view');
                          const result = await fetchData();
                          if (selectedNode && selectedNode.type === 'folder' && result) {
                            const updatedNode = findNodeById(result.tree, selectedNode.id);
                            if (updatedNode) setSelectedNode(updatedNode);
                          }
                        } catch {
                          // handle error
                        } finally {
                          setDialogDeleting(false);
                        }
                      }}
                    >
                      {dialogDeleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      {dialogDeleting ? '删除中...' : '确认删除'}
                    </Button>
                  </div>
                </div>
              ) : dialogMode === 'edit' ? (
                // ─── 编辑模式 ───
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label>名称</Label>
                      <Input
                        value={dialogEditName}
                        onChange={(e) => setDialogEditName(e.target.value)}
                      />
                    </div>
                    {viewingResource.type === 'video_url' && (
                      <div>
                        <Label>视频地址</Label>
                        <Input
                          value={dialogEditUrl}
                          onChange={(e) => setDialogEditUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    )}
                    <div>
                      <MarkdownEditor
                        label="描述（支持 Markdown）"
                        value={dialogEditDescription}
                        onChange={setDialogEditDescription}
                        height={180}
                        placeholder="输入描述内容..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDialogMode('view');
                        setDialogEditName(viewingResource.name);
                        setDialogEditUrl(viewingResource.url ?? '');
                        setDialogEditDescription(viewingResource.description ?? '');
                      }}
                      disabled={dialogSaving}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      disabled={dialogSaving || !dialogEditName.trim()}
                      onClick={async () => {
                        setDialogSaving(true);
                        try {
                          await updateResourceNode(viewingResource.id, {
                            name: dialogEditName.trim(),
                            url: dialogEditUrl || null,
                            description: dialogEditDescription || null,
                          });
                          const result = await fetchData();
                          if (result) {
                            const updated = findNodeById(result.tree, viewingResource.id);
                            if (updated) {
                              setViewingResource(updated);
                              // 同时刷新当前选中的文件夹
                              if (selectedNode && selectedNode.type === 'folder') {
                                const updatedFolder = findNodeById(result.tree, selectedNode.id);
                                if (updatedFolder) setSelectedNode(updatedFolder);
                              }
                            }
                          }
                          setDialogMode('view');
                        } catch {
                          // handle error
                        } finally {
                          setDialogSaving(false);
                        }
                      }}
                    >
                      {dialogSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                // ─── 查看模式 ───
                <div className="space-y-4">
                  {/* 文件类型 */}
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {typeLabels[viewingResource.type] || viewingResource.type}
                    </Badge>
                  </div>

                  {/* 图片预览 */}
                  {viewingResource.type === 'image' && viewingResource.asset?.url ? (
                    <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
                      <img
                        src={viewingResource.asset.url}
                        alt={viewingResource.name}
                        className="w-full max-h-[50vh] object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : viewingResource.type === 'video' && viewingResource.asset?.url ? (
                    <div className="rounded-lg border border-border overflow-hidden bg-black">
                      <video
                        controls
                        className="w-full max-h-[50vh]"
                        src={viewingResource.asset.url}
                      />
                    </div>
                  ) : viewingResource.type === 'audio' && viewingResource.asset?.url ? (
                    <div className="rounded-lg border border-border p-6 bg-muted/30">
                      <div className="flex items-center gap-3 mb-3">
                        <FileAudio className="h-8 w-8 text-emerald-500" />
                        <div>
                          <p className="text-sm font-medium">{viewingResource.asset.filename}</p>
                        </div>
                      </div>
                      <audio controls className="w-full" src={viewingResource.asset.url} />
                    </div>
                  ) : viewingResource.asset ? (
                    <div className="rounded-lg border border-border p-4 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background border">
                          {React.createElement(typeIcons[viewingResource.type] || File, {
                            className: 'h-6 w-6 text-muted-foreground',
                          })}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{viewingResource.asset.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {viewingResource.asset.mimeType} · {formatSize(viewingResource.asset.size)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(viewingResource.asset!.url, '_blank')}
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          打开文件
                        </Button>
                      </div>
                    </div>
                  ) : viewingResource.type === 'video_url' && viewingResource.url ? (
                    <div className="rounded-lg border border-border p-4 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground mb-2">视频地址</p>
                      <div className="flex items-center gap-2">
                        <FileVideo className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <a
                          href={viewingResource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate"
                        >
                          {viewingResource.url}
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {/* 文件信息 */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {viewingResource.fileSize && (
                      <div>
                        <span className="font-medium">文件大小：</span>
                        {formatSize(viewingResource.fileSize)}
                      </div>
                    )}
                    {viewingResource.mimeType && (
                      <div>
                        <span className="font-medium">MIME 类型：</span>
                        {viewingResource.mimeType}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">创建时间：</span>
                      {new Date(viewingResource.createdAt).toLocaleString('zh-CN')}
                    </div>
                    <div>
                      <span className="font-medium">更新时间：</span>
                      {new Date(viewingResource.updatedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>

                  {/* 描述 */}
                  {viewingResource.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">描述</p>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <MarkdownRenderer content={viewingResource.description} />
                      </div>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDialogEditName(viewingResource.name);
                        setDialogEditUrl(viewingResource.url ?? '');
                        setDialogEditDescription(viewingResource.description ?? '');
                        setDialogMode('edit');
                      }}
                    >
                      <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDialogMode('delete-confirm')}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tree Node Component ───

interface TreeNodeItemProps {
  node: ResourceTreeNode;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (node: ResourceTreeNode) => void;
  onAddFolder: (parentId: string) => void;
}

function TreeNodeItem({
  node, depth, expandedIds, selectedId,
  onToggle, onSelect, onAddFolder,
}: TreeNodeItemProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.type === 'folder';
  const IconComponent = isExpanded && isFolder ? FolderOpen : (typeIcons[node.type] || File);

  // 只渲染文件夹节点
  if (!isFolder) return null;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-1 py-1 cursor-pointer transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted text-foreground/80',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => {
          onSelect(node);
          if (isFolder && hasChildren) {
            onToggle(node.id);
          }
        }}
      >
        {/* Expand/Collapse toggle */}
        <button
          type="button"
          className={cn(
            'flex-shrink-0 p-0.5 rounded hover:bg-muted-foreground/10 transition-colors',
            !hasChildren && 'invisible',
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        <IconComponent
          className={cn(
            'flex-shrink-0 h-4 w-4',
            isFolder ? 'text-amber-500' :
            node.type.includes('video') ? 'text-blue-500' :
            node.type === 'audio' ? 'text-emerald-500' :
            node.type === 'pdf' ? 'text-red-500' :
            node.type === 'image' ? 'text-purple-500' :
            'text-muted-foreground',
          )}
        />

        <span className="text-sm truncate flex-1 min-w-0">{node.name}</span>

        {/* Quick add folder button on hover */}
        {isFolder && (
          <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              className="p-0.5 rounded hover:bg-muted-foreground/15"
              title="添加子文件夹"
              onClick={(e) => {
                e.stopPropagation();
                onAddFolder(node.id);
              }}
            >
              <FolderOpen className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && node.children.map((child) => (
        <TreeNodeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggle={onToggle}
          onSelect={onSelect}
          onAddFolder={onAddFolder}
        />
      ))}
    </div>
  );
}
