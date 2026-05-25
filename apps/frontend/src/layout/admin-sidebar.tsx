import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Users, Database, FileText, Settings, BarChart3, Bell,
  ChevronRight, ArrowLeft, CreditCard, Receipt, FolderOpen,
  Tag, MessageSquare, MapPin, BookOpen, Film, Award,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface MenuItem {
  key: string
  label: string
  icon: React.ElementType
  path: string
  soon?: boolean
}

const menuItems: MenuItem[] = [
  {
    key: 'users',
    label: '用户管理',
    icon: Users,
    path: '/admin/users',
  },
  {
    key: 'members',
    label: '会员管理',
    icon: CreditCard,
    path: '/admin/members',
  },
  {
    key: 'billing',
    label: '账单管理',
    icon: Receipt,
    path: '/admin/billing',
  },
  {
    key: 'notifications',
    label: '消息通知',
    icon: Bell,
    path: '/admin/notifications',
  },
  // {
  //   key: 'resources',
  //   label: '资料库管理',
  //   icon: FolderOpen,
  //   path: '/admin/resources',
  // },
  // {
  //   key: 'coupons',
  //   label: '优惠券管理',
  //   icon: Tag,
  //   path: '/admin/coupons',
  // },
  {
    key: 'feedbacks',
    label: '反馈管理',
    icon: MessageSquare,
    path: '/admin/feedbacks',
  },
  // {
  //   key: 'question-bank',
  //   label: '题库管理',
  //   icon: Database,
  //   path: '/admin/question-bank',
  // },
  {
    key: 'content',
    label: '内容审核',
    icon: FileText,
    path: '/admin/content',
    soon: true,
  },
  {
    key: 'scenes',
    label: '场景管理',
    icon: MapPin,
    path: '/admin/scenes',
  },
  {
    key: 'chunks',
    label: 'Chunk 管理',
    icon: BookOpen,
    path: '/admin/chunks',
  },
  {
    key: 'script',
    label: '剧本管理',
    icon: Film,
    path: '/admin/script',
  },
  {
    key: 'achievements',
    label: '成就管理',
    icon: Award,
    path: '/admin/achievements',
  },
  {
    key: 'analytics',
    label: '数据统计',
    icon: BarChart3,
    path: '/admin/analytics',
  },
  {
    key: 'settings',
    label: '系统设置',
    icon: Settings,
    path: '/admin/settings',
  },
]

interface AdminSidebarProps {
  onClose?: () => void
}

export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const location = useLocation()
  const currentPath = location.pathname

  const isActive = (path: string) => currentPath === path

  return (
    <div className="flex h-full flex-col">
      {/* 导航菜单 */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          主菜单
        </p>
        {menuItems.map((item) => {
          const active = isActive(item.path)
          const Icon = item.icon

          return (
            <Link
              key={item.key}
              to={item.soon ? '#' : item.path}
              onClick={(e) => {
                if (item.soon) e.preventDefault()
                onClose?.()
              }}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                active
                  ? 'bg-primary text-primary-foreground font-medium'
                  : item.soon
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'h-4 w-4 flex-shrink-0',
                active && 'text-primary-foreground'
              )} />
              <span className="flex-1">{item.label}</span>
              {item.soon && (
                <span className="rounded-full border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  即将推出
                </span>
              )}
              {active && <ChevronRight className="h-3.5 w-3.5 text-primary-foreground/70" />}
            </Link>
          )
        })}
      </nav>

      {/* 底部：返回前台 */}
      <div className="border-t border-border/40 p-3">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回前台
        </Link>
      </div>
    </div>
  )
}
