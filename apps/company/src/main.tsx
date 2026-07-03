import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import CompanyPage from '../../frontend/src/features/company/pages/company-page'
import '../../frontend/src/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <CompanyPage />
    </HelmetProvider>
  </React.StrictMode>
)
