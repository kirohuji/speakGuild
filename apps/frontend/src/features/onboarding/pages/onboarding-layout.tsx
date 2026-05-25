import { Outlet } from 'react-router-dom'

/**
 * 新手引导布局
 */
export function OnboardingLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-lg">
        <Outlet />
      </div>
    </div>
  )
}
