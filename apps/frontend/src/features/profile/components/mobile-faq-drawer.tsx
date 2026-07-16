import { useState } from 'react'
import { ChevronDown, MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'

type FaqItem = {
  question: string
  answer: string
}

const FAQ_COPY: Record<string, { title: string; description: string; unresolved: string; feedback: string; items: FaqItem[] }> = {
  'zh-CN': {
    title: '常见问题',
    description: '关于学习、语音、会员和账号的常见问题。',
    unresolved: '没有找到答案？告诉我们遇到了什么问题。',
    feedback: '提交问题反馈',
    items: [
      {
        question: '每天应该练多久？',
        answer: '建议每天完成一次 10～20 分钟的今日任务。比起偶尔长时间练习，持续开口和及时复习更重要。你可以在设置中调整每日目标。',
      },
      {
        question: 'AI 纠错结果应该怎么使用？',
        answer: '先看最影响表达的问题，再按照建议重新说一遍。遇到适合自己的表达可以保存到表达库，之后通过复习任务巩固，不需要一次修改所有细节。',
      },
      {
        question: '录音后没有识别出内容怎么办？',
        answer: '请确认麦克风权限已开启，并尽量在安静环境下说话。说完后稍等片刻再结束录音。如果本地识别失败，可以在设置中开启“失败时回退云端”后重试。',
      },
      {
        question: '学习包下载失败或无法离线使用怎么办？',
        answer: '请先检查网络和设备剩余空间。如果开启了“仅 Wi-Fi 下载”，请连接 Wi-Fi 后重试。仍然失败时，可进入存储管理删除未完成的下载，再重新下载学习包。',
      },
      {
        question: '学习进度没有同步怎么办？',
        answer: '联网后系统会自动同步。你可以在设置中查看“同步记录”确认最近一次结果。如果记录持续显示失败，请保留错误提示并通过问题反馈联系我们。',
      },
      {
        question: '购买会员后权益没有生效怎么办？',
        answer: '请先确认当前登录的是购买时使用的账号，然后在会员中心点击“恢复购买”。权益同步有时需要短暂等待；如果仍未生效，请提交反馈并附上购买时间和订单信息。',
      },
      {
        question: '如何取消或管理自动续订？',
        answer: '在会员中心点击“管理订阅”，前往系统订阅页面操作。取消自动续订后，会员权益仍会保留到当前订阅周期结束。',
      },
      {
        question: '更换手机后，会员和学习记录还在吗？',
        answer: '登录原账号后，已同步的学习记录会自动恢复。Apple 会员可以在会员中心使用“恢复购买”。尚未同步的本地录音或下载内容可能需要重新下载。',
      },
      {
        question: '提交反馈后在哪里查看回复？',
        answer: '客服回复后，系统会发送站内通知。你可以从消息中心查看回复；涉及账号、会员和支付的问题会优先处理。',
      },
    ],
  },
  en: {
    title: 'Frequently Asked Questions',
    description: 'Quick help with learning, speech, membership, and your account.',
    unresolved: "Didn't find your answer? Tell us what happened.",
    feedback: 'Send feedback',
    items: [
      { question: 'How long should I practise each day?', answer: 'Aim for one 10–20 minute daily task. Consistent speaking and review matter more than occasional long sessions. You can change your daily goal in Settings.' },
      { question: 'How should I use AI corrections?', answer: 'Start with the issue that affects your meaning most, then try saying the answer again. Save useful phrases to your expression library for later review.' },
      { question: 'Why was my recording not recognised?', answer: 'Check microphone permission and try again in a quiet place. Pause briefly before ending the recording. You can also enable cloud fallback in Settings.' },
      { question: 'Why can’t I download or use a learning pack offline?', answer: 'Check your connection and available storage. If Wi-Fi-only downloads are enabled, connect to Wi-Fi. You can remove an incomplete download in Storage and try again.' },
      { question: 'Why is my learning progress not syncing?', answer: 'Sync resumes automatically when you are online. Check Sync Records in Settings. If failures continue, send us the displayed error through Feedback.' },
      { question: 'My membership did not activate after purchase.', answer: 'Make sure you are signed in to the account used for the purchase, then choose Restore Purchases in Membership. If it still does not activate, send the purchase time and order details through Feedback.' },
      { question: 'How do I manage or cancel renewal?', answer: 'Open Membership and choose Manage Subscription. Cancelling renewal does not remove access before the end of your current billing period.' },
      { question: 'Will my progress and membership follow me to a new phone?', answer: 'Sign in with the same account to restore synced progress. Use Restore Purchases for an Apple subscription. Offline downloads may need to be downloaded again.' },
      { question: 'Where can I see a reply to my feedback?', answer: 'We send an in-app notification when support replies. Account, membership, and payment issues are prioritised.' },
    ],
  },
  ja: {
    title: 'よくある質問',
    description: '学習、音声、会員、アカウントについてのヘルプです。',
    unresolved: '解決しない場合は、状況をお知らせください。',
    feedback: '問題を報告する',
    items: [
      { question: '毎日どのくらい練習すればよいですか？', answer: '1日10〜20分の今日のタスクがおすすめです。長時間の練習を時々行うより、毎日話して復習することが大切です。' },
      { question: 'AIの添削はどう使えばよいですか？', answer: 'まず意味に最も影響する問題を確認し、アドバイスに沿ってもう一度話してください。役立つ表現は表現ライブラリに保存できます。' },
      { question: '録音が認識されない場合は？', answer: 'マイクの権限を確認し、静かな場所で再試行してください。録音終了前に少し待つか、設定でクラウドへのフォールバックを有効にできます。' },
      { question: '学習パックをダウンロードできません。', answer: '通信状態と空き容量を確認してください。「Wi-Fiのみ」が有効な場合はWi-Fiに接続し、ストレージ管理から未完了のデータを削除して再試行してください。' },
      { question: '学習履歴が同期されない場合は？', answer: 'オンラインになると自動的に再同期します。設定の「同期記録」を確認し、失敗が続く場合は表示されたエラーを添えてお問い合わせください。' },
      { question: '購入後に会員特典が反映されません。', answer: '購入時と同じアカウントでログインしていることを確認し、会員センターの「購入を復元」を実行してください。解決しない場合は購入日時と注文情報をお知らせください。' },
      { question: '自動更新を管理・解約するには？', answer: '会員センターの「サブスクリプション管理」からシステムの購読画面を開いてください。解約後も現在の期間が終了するまで特典を利用できます。' },
      { question: '機種変更後も会員と履歴は残りますか？', answer: '同じアカウントでログインすると同期済みの履歴が復元されます。Appleの購読は「購入を復元」を使用してください。' },
      { question: '問い合わせの返信はどこで確認できますか？', answer: '返信時にアプリ内通知を送信します。アカウント、会員、支払いに関する問題は優先して対応します。' },
    ],
  },
}

export function MobileFaqDrawer({
  open,
  onOpenChange,
  onFeedbackOpen,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFeedbackOpen?: () => void
}) {
  const { i18n } = useTranslation()
  const [openItem, setOpenItem] = useState<number | null>(null)
  const copy = FAQ_COPY[i18n.resolvedLanguage ?? i18n.language] ?? FAQ_COPY['zh-CN']

  const handleFeedback = () => {
    onOpenChange(false)
    window.setTimeout(() => onFeedbackOpen?.(), 180)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setOpenItem(null)
      }}
    >
      <DrawerContent className="h-[min(86dvh,760px)] rounded-t-3xl drawer-surface">
        <DrawerHeader className="shrink-0 px-5 pb-3 pt-4 text-left">
          <DrawerTitle className="text-lg">{copy.title}</DrawerTitle>
          <DrawerDescription className="text-xs leading-5">{copy.description}</DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="min-h-0 flex-1 px-4">
          <div className="overflow-hidden rounded-xl bg-muted/30">
            {copy.items.map((item, index) => {
              const isOpen = openItem === index
              return (
                <Collapsible
                  key={item.question}
                  open={isOpen}
                  onOpenChange={(nextOpen) => setOpenItem(nextOpen ? index : null)}
                >
                  <CollapsibleTrigger className={cn(
                    'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60',
                    index !== copy.items.length - 1 && 'border-b border-border/50',
                  )}>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-5">{item.question}</span>
                    <ChevronDown className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      isOpen && 'rotate-180',
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="border-b border-border/50 bg-background/45 px-4 pb-4 pt-1 text-xs leading-6 text-muted-foreground">
                      {item.answer}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </ScrollArea>

        <DrawerFooter className="shrink-0 gap-2 px-4 pb-[calc(1rem+var(--safe-area-inset-bottom))] pt-3">
          <p className="text-center text-xs text-muted-foreground">{copy.unresolved}</p>
          {/* <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={handleFeedback}>
            <MessageSquareText data-icon="inline-start" />
            {copy.feedback}
          </Button> */}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
