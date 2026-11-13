import React from 'react'
import { LandingFooter, LandingHeader } from './landing-shell'

interface SystemArticleLayoutProps {
  title: string
  children: React.ReactNode
}

/**
 * 隐私政策 / 服务条款等正文页：使用与 Marketing、Support 一致的 Header，
 * 正文区域无边框、无阴影。
 */
export function SystemArticleLayout({ title, children }: SystemArticleLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <h1 className="mb-8 font-display text-2xl font-extrabold tracking-tight text-foreground lg:text-3xl">
          {title}
        </h1>
        <div className="border-0 bg-transparent p-0 shadow-none">{children}</div>
      </main>
      <LandingFooter />
    </div>
  )
}
