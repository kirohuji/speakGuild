import { useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { synthesizeText, type TtsProviderKey } from '@/lib/tts-api'

interface TtsVoiceTesterProps {
  provider?: string
  model?: string
  voiceId?: string
  disabled?: boolean
}

export function TtsVoiceTester({ provider, model, voiceId, disabled }: TtsVoiceTesterProps) {
  const [text, setText] = useState('Hello! How are you today?')
  const [testing, setTesting] = useState(false)
  const [audioSrc, setAudioSrc] = useState('')

  const test = async () => {
    if (!provider || !voiceId || !text.trim()) return
    setTesting(true)
    setAudioSrc('')
    try {
      const result = await synthesizeText({ text: text.trim(), provider: provider as TtsProviderKey, model: model || '', voiceId })
      setAudioSrc(`data:${result.mimeType};base64,${result.audioBase64}`)
      toast.success('音频已生成')
    } catch (error: any) { toast.error(error?.message || '音色试听失败，请检查厂商配置') }
    finally { setTesting(false) }
  }

  return <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
    <div><p className="text-sm font-medium">音色试听</p><p className="mt-0.5 text-xs text-muted-foreground">输入文本后实时调用当前厂商生成音频，不需要填写试听地址。</p></div>
    <div className="flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="输入测试文本…" onKeyDown={(e) => { if (e.key === 'Enter') void test() }} /><Button type="button" variant="outline" className="shrink-0" disabled={disabled || testing || !provider || !voiceId || !text.trim()} onClick={() => void test()}>{testing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}{testing ? '生成中…' : '生成试听'}</Button></div>
    {audioSrc && <audio controls className="h-9 w-full" src={audioSrc}>您的浏览器不支持音频播放。</audio>}
  </div>
}
