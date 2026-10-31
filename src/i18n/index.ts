import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ml from './locales/ml.json';

const savedLang = typeof window !== 'undefined' ? window.localStorage.getItem('asty_lang') || 'en' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ml: { translation: ml },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

