import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { Menu, ArrowLeft, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AdminSidebar } from './admin-sidebar'
import { useLayoutStore } from '@/stores/layout.store'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { canAccessManagementPath, managementHome } from '@/features/admin/management-access'

const COLLAPSED_KEY = 'admin-sidebar-collapsed'

export function AdminLayout() {
  const location = useLocation()
  const { session, isLoading } = useAuth()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const setBottomNavVisible = useLayoutStore((s) => s.setBottomNavVisible)

  useEffect(() => {
    setBottomNavVisible(false)
    return () => setBottomNavVisible(true)
  }, [setBottomNavVisible])

  if (isLoading) return null
  const role = session?.user?.role
  if (!canAccessManagementPath(role, location.pathname)) {
    if (role === 'creator' && location.pathname !== managementHome(role)) {
      return <Navigate to={managementHome(role)} replace />
    }
    return <Navigate to="/" replace />
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-border/50 bg-card px-4 pt-[env(safe-area-inset-top,0px)]">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开管理菜单"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <LayoutDashboard className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">{role === 'creator' ? '创作管理' : '管理后台'}</span>
        </div>
        <div className="flex-1" />
        <Link to="/">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回前台
          </Button>
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!isMobile && (
          <aside
            className={cn(
              'flex-shrink-0 overflow-y-auto border-r border-border/50 bg-card transition-all duration-300',
              collapsed ? 'w-14' : 'w-60',
            )}
          >
            <AdminSidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
          </aside>
        )}
        <main className="flex-1 overflow-y-auto" id="admin-main-content">
          <div className="admin-workspace p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetTitle className="sr-only">管理后台导航</SheetTitle>
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
