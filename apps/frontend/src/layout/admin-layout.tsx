import React, { useEffect, useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Menu, ArrowLeft, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AdminSidebar } from './admin-sidebar'
import { useLayoutStore } from '@/stores/layout.store'
import { useIsMobile } from '@/hooks/use-mobile'

export function AdminLayout() {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const setBottomNavVisible = useLayoutStore((s) => s.setBottomNavVisible)

  useEffect(() => {
    setBottomNavVisible(false)
    return () => setBottomNavVisible(true)
  }, [setBottomNavVisible])

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-border/50 bg-card px-4">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <LayoutDashboard className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">管理后台</span>
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
          <aside className="w-60 flex-shrink-0 overflow-y-auto border-r border-border/50 bg-card">
            <AdminSidebar />
          </aside>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
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
