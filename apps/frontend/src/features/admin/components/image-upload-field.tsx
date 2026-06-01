import { useEffect, useState, useRef } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { getFileAssetLongLivedUrl, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import type { FileAssetGroup } from '@/features/file-assets/api'

interface ImageUploadFieldProps {
  /** 当前图片 URL */
  value?: string
  /** URL 变更回调（用于直接输入 URL） */
  onChange?: (url: string) => void
  /** 上传完成回调（返回 COS URL 和 assetId） */
  onUploaded?: (cosUrl: string, assetId: string) => void
  /** 占位文本 */
  placeholder?: string
  /** 预览尺寸 */
  previewSize?: 'sm' | 'md' | 'lg'
  /** 是否禁用 */
  disabled?: boolean
  className?: string
  group?: FileAssetGroup
}

const sizeMap = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
}

/**
 * 通用图片上传字段
 * 支持：粘贴 URL / 点击上传到 COS / 拖拽上传
 */
export function ImageUploadField({
  value,
  onChange,
  onUploaded,
  placeholder = '输入图片 URL 或点击上传',
  previewSize = 'md',
  disabled = false,
  className,
  group = 'library',
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(value || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPreviewUrl(value || '')
  }, [value])

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const asset = await uploadFileToCosAndComplete({ file, group })
      const resolved = await getFileAssetLongLivedUrl(asset.id)
      const cosUrl = resolved.url
      setPreviewUrl(cosUrl)
      onUploaded?.(cosUrl, asset.id)
      onChange?.(cosUrl)
    } catch (err) {
      console.warn('Upload failed, falling back to URL input:', err)
      // Don't clear — user can still enter URL manually
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearImage = () => {
    setPreviewUrl('')
    onChange?.('')
  }

  const sizeClass = sizeMap[previewSize]

  return (
    <div className={cn('space-y-2', className)}>
      {/* Preview + Upload area */}
      <div className="flex items-start gap-3">
        {/* Preview */}
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30',
            sizeClass,
          )}
        >
          {previewUrl ? (
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
                  onClick={clearImage}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              )}
            </>
          ) : (
            <ImageIcon className="size-6 text-muted-foreground/40" />
          )}
        </div>

        {/* Upload button */}
        <div className="flex-1 space-y-2">
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
                {uploading ? '上传中...' : '上传图片'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}
          {previewUrl && (
            <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{previewUrl}</p>
          )}
        </div>
      </div>
    </div>
  )
}
