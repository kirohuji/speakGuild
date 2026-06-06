import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Users, Settings, BarChart3, Bell,
  ChevronRight, ChevronDown, CreditCard, Receipt,
  MessageSquare, MapPin, Film, Award, Palette, Quote,
  Smartphone, FileText, Wrench, PanelLeftClose, PanelLeftOpen, Library,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ──────────────────────────────────────────────────

interface MenuItem {
  key: string
  label: string
  icon: React.ElementType
  path: string
  soon?: boolean
}

interface MenuGroup {
  key: string
  label: string
  icon: React.ElementType
  items: MenuItem[]
}

// ─── Menu Data ──────────────────────────────────────────────

const menuGroups: MenuGroup[] = [
  {
    key: 'users',
    label: '用户与运营',
    icon: Users,
    items: [
      { key: 'users', label: '用户管理', icon: Users, path: '/admin/users' },
      { key: 'members', label: '会员管理', icon: CreditCard, path: '/admin/members' },
      { key: 'billing', label: '账单管理', icon: Receipt, path: '/admin/billing' },
      { key: 'feedbacks', label: '反馈管理', icon: MessageSquare, path: '/admin/feedbacks' },
      { key: 'notifications', label: '消息推送', icon: Bell, path: '/admin/notifications' },
    ],
  },
  {
    key: 'content',
    label: '内容管理',
    icon: FileText,
    items: [
      { key: 'scenes', label: '场景管理', icon: MapPin, path: '/admin/scenes' },
      { key: 'script', label: '剧本管理', icon: Film, path: '/admin/script' },
      { key: 'achievements', label: '成就管理', icon: Award, path: '/admin/achievements' },
      { key: 'daily-sentences', label: '每日一句', icon: Quote, path: '/admin/daily-sentences' },
      { key: 'content-library', label: '内容语料库', icon: Library, path: '/admin/content-library' },
      { key: 'nqtr', label: 'NQTR 内容工坊', icon: Palette, path: '/admin/nqtr' },
    ],
  },
  {
    key: 'system',
    label: '系统设置',
    icon: Wrench,
    items: [
      { key: 'themes', label: '主题管理', icon: Palette, path: '/admin/themes' },
      { key: 'analytics', label: '数据统计', icon: BarChart3, path: '/admin/analytics' },
      { key: 'mobile-bundles', label: 'OTA 安装包', icon: Smartphone, path: '/admin/mobile-bundles' },
      { key: 'settings', label: '系统设置', icon: Settings, path: '/admin/settings' },
    ],
  },
]

// ─── Component ──────────────────────────────────────────────

interface AdminSidebarProps {
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function AdminSidebar({ onClose, collapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const location = useLocation()
  const currentPath = location.pathname

  // 根据当前路由自动展开所属分组
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const active = new Set<string>()
    for (const group of menuGroups) {
      if (group.items.some((item) => currentPath === item.path || currentPath.startsWith(item.path + '/'))) {
        active.add(group.key)
      }
    }
    return active
  })

  // 路由变化时重新计算展开状态
  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      for (const group of menuGroups) {
        const hasActive = group.items.some((item) => currentPath === item.path || currentPath.startsWith(item.path + '/'))
        if (hasActive) {
          next.add(group.key)
        }
      }
      return next
    })
  }, [currentPath])

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const isItemActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/')

  // ── 折叠模式：仅显示分组图标 ──
  if (collapsed) {
    return (
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-3 overflow-y-auto p-2">
          {menuGroups.map((group) => {
            const GroupIcon = group.icon
            const hasActiveChild = group.items.some((item) => isItemActive(item.path))

            return (
              <div
                key={group.key}
                className="flex justify-center"
                title={group.label}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    hasActiveChild
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <GroupIcon className="size-[18px]" />
                </div>
              </div>
            )
          })}
        </nav>

        {/* 底部：展开侧边栏 */}
        <div className="border-t border-border/40 p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="展开菜单"
          >
            <PanelLeftOpen className="size-[18px]" />
          </button>
        </div>
      </div>
    )
  }

  // ── 展开模式：完整菜单 ──
  return (
    <div className="flex h-full flex-col">
      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {menuGroups.map((group) => {
          const expanded = expandedGroups.has(group.key)
          const GroupIcon = group.icon
          const hasActiveChild = group.items.some((item) => isItemActive(item.path))

          return (
            <div key={group.key} className="space-y-0.5">
              {/* 分组标题 — 可点击展开/折叠 */}
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                  hasActiveChild
                    ? 'text-foreground'
                    : 'text-muted-foreground/60 hover:text-muted-foreground',
                )}
              >
                <GroupIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200',
                    expanded && 'rotate-180',
                  )}
                />
              </button>

              {/* 分组下的菜单项 */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                <div className="space-y-0.5 pb-1 pl-1">
                  {group.items.map((item) => {
                    const active = isItemActive(item.path)
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
                          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
                          active
                            ? 'bg-primary text-primary-foreground font-medium'
                            : item.soon
                              ? 'text-muted-foreground/40 cursor-not-allowed'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-3.5 w-3.5 flex-shrink-0',
                            active && 'text-primary-foreground',
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.soon && (
                          <span className="flex-shrink-0 rounded-full border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            即将推出
                          </span>
                        )}
                        {active && (
                          <ChevronRight className="h-3 w-3 flex-shrink-0 text-primary-foreground/60" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* 底部：折叠菜单 */}
      <div className="border-t border-border/40 p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelLeftClose className="size-4" />
          折叠菜单
        </button>
      </div>
    </div>
  )
}
