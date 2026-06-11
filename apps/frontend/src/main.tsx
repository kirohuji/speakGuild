import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/i18n'

// 🔍 开发调试：暴露学习包状态到 window
if (import.meta.env.DEV) {
  import('./lib/offline').then(({ learningPackService }) => {
    (window as any).__learningPack = learningPackService
    console.log('[dev] 💡 可在控制台运行: await __learningPack.dumpStatus()')
  })

  // ★ 安装长任务监控器（仅开发环境，用于定位 Capacitor 卡顿来源）
  import('./lib/perf').then(({ installLongTaskMonitor }) => {
    installLongTaskMonitor()
  })
}

// function preventBrowserZoom() {
//   const preventDefault = (event: Event) => event.preventDefault()
//   const preventMultiTouch = (event: TouchEvent) => {
//     if (event.touches.length > 1) event.preventDefault()
//   }

//   document.addEventListener('gesturestart', preventDefault, { passive: false })
//   document.addEventListener('gesturechange', preventDefault, { passive: false })
//   document.addEventListener('gestureend', preventDefault, { passive: false })
//   document.addEventListener('touchmove', preventMultiTouch, { passive: false })
//   document.addEventListener('dblclick', preventDefault, { passive: false })
// }

// preventBrowserZoom()

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
)
