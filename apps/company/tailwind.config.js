import frontendConfig from '../frontend/tailwind.config.js'

/** @type {import('tailwindcss').Config} */
export default {
  ...frontendConfig,
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../frontend/src/features/company/pages/**/*.{ts,tsx}',
    '../frontend/src/components/ui/{badge,dialog,separator}.tsx',
    '../frontend/src/lib/cn.ts',
  ],
}
