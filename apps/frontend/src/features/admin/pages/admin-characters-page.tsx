import { CharactersTab } from '../components/characters-tab'

/** 兼容旧路由；角色资产的主入口位于“剧情共享资产”。 */
export function AdminCharactersPage() {
  return <div className="space-y-5">
    <header>
      <h1 className="text-2xl font-bold">角色资产</h1>
      <p className="mt-1 text-sm text-muted-foreground">全局维护剧情角色，并通过音色资产引用配置角色声音。</p>
    </header>
    <CharactersTab />
  </div>
}
