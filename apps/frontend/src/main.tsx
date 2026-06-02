import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/i18n'

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
