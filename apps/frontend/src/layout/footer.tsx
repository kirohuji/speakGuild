import React from 'react'
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-[1480px] px-4 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">导游说</span>
            <span className="text-muted-foreground text-sm">专业导游外语口试备考平台</span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">题库</Link>
            <Link to="/mock" className="hover:text-foreground transition-colors">模考</Link>
            <Link to="/member" className="hover:text-foreground transition-colors">会员权益</Link>
            <Link to="/profile" className="hover:text-foreground transition-colors">个人中心</Link>
          </nav>

          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap justify-center sm:justify-start">
            <Link to="/system/privacy" className="hover:text-foreground transition-colors">隐私政策</Link>
            <Link to="/system/privacy-concise" className="hover:text-foreground transition-colors">隐私简明版</Link>
            <Link to="/system/terms" className="hover:text-foreground transition-colors">用户协议</Link>
            <Link to="/system/permissions" className="hover:text-foreground transition-colors">权限说明</Link>
            <Link to="/system/sdk-list" className="hover:text-foreground transition-colors">SDK目录</Link>
            <Link to="/system/collect-info" className="hover:text-foreground transition-colors">信息收集清单</Link>
            <Link to="/system/icp" className="hover:text-foreground transition-colors">ICP备案</Link>
            <Link to="/system/contact" className="hover:text-foreground transition-colors">联系我们</Link>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} 导游说. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
