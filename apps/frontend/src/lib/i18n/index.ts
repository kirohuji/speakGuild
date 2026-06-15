import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './zh-CN'
import ja from './ja'
import en from './en'
i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': zhCN,
    en: en,
    ja: ja,
  },
  lng: localStorage.getItem('manyu-language') || 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
})

export default i18n
