import { useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

interface ColorPickerFieldProps {
  /** 当前 HSL 值，如 "212 100% 18.6%" */
  value?: string;
  /** 变更回调，返回 HSL 字符串 */
  onChange?: (hsl: string) => void;
  /** 占位 */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 将 HSL 字符串（如 "212 100% 18.6%"）转换为 hex 颜色
 */
function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return '#cccccc';
  const h = parseFloat(parts[0]) % 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * 将 hex 颜色转换为 HSL 字符串（"H S% L%" 格式，一位小数）
 */
function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16) / 255;
    g = parseInt(hex[2] + hex[2], 16) / 255;
    b = parseInt(hex[3] + hex[3], 16) / 255;
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16) / 255;
    g = parseInt(hex.substring(3, 5), 16) / 255;
    b = parseInt(hex.substring(5, 7), 16) / 255;
  } else {
    return '0 0% 50%';
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100 * 10) / 10}%`;
}

/**
 * 颜色选择器字段
 * 点击色块弹出 react-colorful 面板，选择后自动转回 HSL 字符串
 */
export function ColorPickerField({
  value,
  onChange,
  placeholder = '选择颜色',
  disabled = false,
  className,
}: ColorPickerFieldProps) {
  const [open, setOpen] = useState(false);

  const hexColor = value ? hslToHex(value) : '#cccccc';

  const handleChange = useCallback(
    (hex: string) => {
      onChange?.(hexToHsl(hex));
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span
            className="inline-block size-5 shrink-0 rounded border border-border/60"
            style={{ background: hexColor }}
          />
          <span className={value ? 'font-mono text-xs' : 'text-muted-foreground'}>
            {value || placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" side="bottom" align="start">
        <HexColorPicker color={hexColor} onChange={handleChange} />
      </PopoverContent>
    </Popover>
  );
}
