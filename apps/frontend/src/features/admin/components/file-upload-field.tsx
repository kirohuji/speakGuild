import { useEffect, useState, useRef } from 'react'
import { Upload, X, ImageIcon, Music, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { getFileAssetLongLivedUrl, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import type { FileAssetGroup } from '@/features/file-assets/api'

interface FileUploadFieldProps {
  /** 当前文件 URL */
  value?: string
  /** URL 变更回调 */
  onChange?: (url: string) => void
  /** 上传完成回调（返回 COS URL 和 assetId） */
  onUploaded?: (cosUrl: string, assetId: string) => void
  /** 占位文本 */
  placeholder?: string
  /** 接受的 MIME 类型，如 "image/*" "audio/*" ".mp3,.ogg" 等 */
  accept?: string
  /** 上传按钮文案 */
  uploadLabel?: string
  /** 预览尺寸（仅图片时生效） */
  previewSize?: 'sm' | 'md' | 'lg'
  /** 是否禁用 */
  disabled?: boolean
  /** COS 文件分组 */
  group?: FileAssetGroup
  className?: string
}

const sizeMap = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
}

/**
 * 通用文件上传字段
 * 支持：粘贴 URL / 点击上传到 COS
 * 图片显示预览，音频/其他显示文件名
 */
export function FileUploadField({
  value,
  onChange,
  onUploaded,
  placeholder = '输入文件 URL 或点击上传',
  accept,
  uploadLabel = '上传文件',
  previewSize = 'md',
  disabled = false,
  group = 'library',
  className,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(value || '')
  const [fileType, setFileType] = useState<'image' | 'audio' | 'other'>('other')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPreviewUrl(value || '')
    if (value) {
      detectFileType(value)
    }
  }, [value])

  /** 根据 URL 后缀判断文件类型 */
  const detectFileType = (url: string) => {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext ?? '')) {
      setFileType('image')
    } else if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'opus'].includes(ext ?? '')) {
      setFileType('audio')
    } else {
      setFileType('other')
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      // 根据 MIME 类型判断
      if (file.type.startsWith('image/')) setFileType('image')
      else if (file.type.startsWith('audio/')) setFileType('audio')
      else setFileType('other')

      const asset = await uploadFileToCosAndComplete({ file, group })
      const resolved = await getFileAssetLongLivedUrl(asset.id)
      const cosUrl = resolved.url
      setPreviewUrl(cosUrl)
      onUploaded?.(cosUrl, asset.id)
      onChange?.(cosUrl)
    } catch (err) {
      console.warn('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clear = () => {
    setPreviewUrl('')
    setFileType('other')
    onChange?.('')
  }

  const sizeClass = sizeMap[previewSize]

  const fileName = (() => {
    if (!previewUrl) return '';
    // CSS gradient 字符串，不是 URL，截断显示
    if (previewUrl.startsWith('linear-gradient') || previewUrl.startsWith('radial-gradient') || previewUrl.startsWith('conic-gradient')) {
      return previewUrl.length > 60 ? previewUrl.slice(0, 60) + '…' : previewUrl;
    }
    // 正常 URL：提取文件名
    try {
      const name = decodeURIComponent(previewUrl.split('/').pop()?.split('?')[0] ?? previewUrl);
      return name;
    } catch {
      const name = previewUrl.split('/').pop()?.split('?')[0] ?? previewUrl;
      return name;
    }
  })();

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-3">
        {/* Preview area */}
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30',
            fileType === 'image' ? sizeClass : 'h-12 max-w-[180px] min-w-[80px] px-3',
          )}
        >
          {previewUrl ? (
            <>
              {fileType === 'image' ? (
                <>
                  <img
                    src={previewUrl}
                    alt="预览"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  {!disabled && (
                    <button
                      type="button"
                      onClick={clear}
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 truncate py-1">
                  {fileType === 'audio' ? (
                    <Music className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-xs font-medium text-foreground">{fileName}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={clear}
                      className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <ImageIcon className="size-6 text-muted-foreground/40" />
          )}
        </div>

        {/* Upload button + URL input */}
        <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
          {!disabled && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {uploading ? '上传中...' : uploadLabel}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}
          {previewUrl && fileType !== 'image' && (
            <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
              {previewUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
