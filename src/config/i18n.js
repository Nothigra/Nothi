import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

i18n
  .use(LanguageDetector)
  .use(resourcesToBackend((language, namespace) => import(`../locales/${language}.json`)))
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'es'],
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'digilab-lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

// Set document direction for RTL languages
const rtlLanguages = ['ar'];
const updateDirection = (lng) => {
  const dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
};

const currentLang = localStorage.getItem('digilab-lang') || 'en';
updateDirection(currentLang);

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('digilab-lang', lng);
  updateDirection(lng);
});

export const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

export default i18n;
