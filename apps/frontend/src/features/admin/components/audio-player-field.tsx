import { useState, useCallback, useRef } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import WaveSurfer from '@wavesurfer/react';
import type WaveSurferInstance from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/cn';

interface AudioPlayerFieldProps {
  /** 音频 URL */
  src?: string;
  className?: string;
}

/**
 * 音频播放器
 * 基于 wavesurfer.js，显示波形图 + 播放/暂停 + 音量
 */
export function AudioPlayerField({ src, className }: AudioPlayerFieldProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(!!src);
  const [volume, setVolume] = useState(0.5);
  const wsRef = useRef<WaveSurferInstance | null>(null);

  const onReady = useCallback((ws: WaveSurferInstance) => {
    wsRef.current = ws;
    ws.setVolume(volume);
    setLoading(false);
  }, [volume]);

  const togglePlay = () => {
    if (wsRef.current) {
      wsRef.current.playPause();
    }
  };

  const handleVolumeChange = ([v]: number[]) => {
    setVolume(v);
    wsRef.current?.setVolume(v);
  };

  if (!src) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground', className)}>
        暂无音频文件，请先上传
      </div>
    );
  }

  return (
    <div className={cn('space-y-3 rounded-lg border border-border bg-card p-4', className)}>
      {/* 波形 */}
      <div className="relative min-h-[48px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <WaveSurfer
          url={src}
          height={48}
          waveColor="hsl(var(--muted-foreground) / 0.3)"
          progressColor="hsl(var(--primary))"
          cursorColor="hsl(var(--accent))"
          barWidth={2}
          barGap={1}
          barRadius={3}
          onReady={onReady}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onFinish={() => setIsPlaying(false)}
          onError={() => setLoading(false)}
        />
      </div>

      {/* 控件 */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={togglePlay}
          disabled={loading}
          className="size-8 shrink-0"
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>

        <Volume2 className="size-4 shrink-0 text-muted-foreground" />
        <Slider
          value={[volume]}
          onValueChange={handleVolumeChange}
          min={0}
          max={1}
          step={0.05}
          className="w-24"
        />
      </div>
    </div>
  );
}
