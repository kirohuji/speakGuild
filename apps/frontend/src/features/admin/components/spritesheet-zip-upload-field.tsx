import { useRef, useState } from "react";
import {
  BlobReader,
  BlobWriter,
  TextWriter,
  ZipReader,
  type Entry,
  type FileEntry,
} from "@zip.js/zip.js";
import { FileArchive, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getFileAssetLongLivedUrl,
  uploadFileToCosAndComplete,
} from "@/features/file-assets/api";

export type SpritesheetImportValue = {
  imageUrl: string;
  spritesheetUrl: string;
  animationNames: string[];
};

type AtlasFrame = {
  filename?: string;
  frame?: { x: number; y: number; w: number; h: number };
  duration?: number;
  [key: string]: unknown;
};

type AtlasData = {
  frames?: Record<string, AtlasFrame> | AtlasFrame[];
  animations?: Record<string, string[]>;
  meta?: {
    image?: string;
    frameTags?: Array<{
      name: string;
      from: number;
      to: number;
      direction?: "forward" | "reverse" | "pingpong";
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

function mimeFromFilename(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

function findEntry(entries: Entry[], filename: string): FileEntry | undefined {
  const normalized = filename.replace(/\\/g, "/").toLowerCase();
  const nameOnly = basename(normalized);
  return entries.find((entry): entry is FileEntry => {
    if (entry.directory) return false;
    const candidate = entry.filename.replace(/\\/g, "/").toLowerCase();
    return candidate === normalized || basename(candidate) === nameOnly;
  });
}

function normalizeAtlas(data: AtlasData) {
  const frames: Record<string, AtlasFrame> = Array.isArray(data.frames)
    ? Object.fromEntries(
        data.frames.map((frame, index) => [
          frame.filename || `frame_${index}`,
          frame,
        ]),
      )
    : (data.frames ?? {});
  const frameNames = Object.keys(frames);
  if (!frameNames.length) throw new Error("JSON 中没有可用帧");

  const animations: Record<string, string[]> = {
    ...(data.animations ?? {}),
  };
  for (const tag of data.meta?.frameTags ?? []) {
    const from = Math.max(0, Math.min(frameNames.length - 1, tag.from));
    const to = Math.max(from, Math.min(frameNames.length - 1, tag.to));
    const sequence = frameNames.slice(from, to + 1);
    if (tag.direction === "reverse") sequence.reverse();
    if (tag.direction === "pingpong" && sequence.length > 2) {
      sequence.push(...sequence.slice(1, -1).reverse());
    }
    animations[tag.name] = sequence;
  }
  if (!Object.keys(animations).length) animations.default = frameNames;

  return {
    ...data,
    frames,
    animations,
    meta: { ...(data.meta ?? {}) },
  };
}

export function SpritesheetZipUploadField({
  value,
  onChange,
  disabled = false,
}: {
  value?: SpritesheetImportValue | null;
  onChange: (value: SpritesheetImportValue | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const importZip = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("请选择 ZIP 格式的 spritesheet 包");
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      toast.error("Spritesheet ZIP 不能超过 80MB");
      return;
    }

    setUploading(true);
    const reader = new ZipReader(new BlobReader(file));
    try {
      const entries = await reader.getEntries();
      const unpackedBytes = entries.reduce(
        (sum, entry) => sum + Number(entry.uncompressedSize ?? 0),
        0,
      );
      if (entries.length > 2000 || unpackedBytes > 160 * 1024 * 1024) {
        throw new Error("ZIP 内容过大或文件数量过多");
      }
      const jsonEntry = entries.find(
        (entry): entry is FileEntry =>
          !entry.directory && entry.filename.toLowerCase().endsWith(".json"),
      );
      if (!jsonEntry) throw new Error("ZIP 中缺少图集 JSON");
      const raw = JSON.parse(
        await jsonEntry.getData(new TextWriter()),
      ) as AtlasData;
      if (
        Array.isArray(raw.meta?.related_multi_packs) &&
        raw.meta.related_multi_packs.length
      ) {
        throw new Error("当前导入器暂不支持 MultiPack，请导出为单张图集");
      }
      const atlas = normalizeAtlas(raw);
      const declaredImage = atlas.meta.image;
      const imageEntry = declaredImage
        ? findEntry(entries, declaredImage)
        : entries.find(
            (entry): entry is FileEntry =>
              !entry.directory &&
              /\.(png|webp|jpe?g)$/i.test(entry.filename),
          );
      if (!imageEntry) {
        throw new Error("ZIP 中缺少 JSON 所引用的 PNG/WebP 图集");
      }

      const imageName = basename(imageEntry.filename);
      const imageBlob = await imageEntry.getData(
        new BlobWriter(mimeFromFilename(imageName)),
      );
      const imageAsset = await uploadFileToCosAndComplete({
        file: new File([imageBlob], imageName, { type: imageBlob.type }),
        group: "library",
      });
      const imageUrl = (await getFileAssetLongLivedUrl(imageAsset.id)).url;

      atlas.meta.image = imageUrl;
      const atlasName = `${basename(jsonEntry.filename).replace(/\.json$/i, "")}-pixi.json`;
      const atlasFile = new File(
        [JSON.stringify(atlas)],
        atlasName,
        { type: "application/json" },
      );
      const atlasAsset = await uploadFileToCosAndComplete({
        file: atlasFile,
        group: "library",
      });
      const spritesheetUrl = (
        await getFileAssetLongLivedUrl(atlasAsset.id)
      ).url;
      const animationNames = Object.keys(atlas.animations);
      onChange({ imageUrl, spritesheetUrl, animationNames });
      toast.success(`Spritesheet 已导入：${animationNames.length} 个动画`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      toast.error(`Spritesheet 导入失败：${message}`);
    } finally {
      await reader.close().catch(() => undefined);
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
          {value?.imageUrl ? (
            <img
              src={value.imageUrl}
              alt="Spritesheet 图集"
              className="size-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <FileArchive className="size-7 text-muted-foreground/50" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">PixiJS Spritesheet ZIP</p>
            <p className="text-[11px] leading-5 text-muted-foreground">
              包含一个 JSON，以及它引用的 PNG、WebP 或 JPG 图集。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              {uploading ? "解包并上传…" : value ? "重新导入" : "选择 ZIP"}
            </Button>
            {value && (
              <>
                <Badge variant="secondary">
                  {value.animationNames.length} 个动画
                </Badge>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="移除 spritesheet"
                  onClick={() => onChange(null)}
                >
                  <X />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".zip,application/zip"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importZip(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
