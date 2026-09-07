/**
 * i18nHelpers.js
 * 
 * Utilities for handling dynamic multilingual content, such as products or categories,
 * ensuring seamless and performant language fallback.
 */

// Simple cache to avoid re-evaluating the same object references multiple times per render.
// Using WeakMap ensures we don't cause memory leaks if the product object is garbage collected.
const translationCache = new WeakMap();

/**
 * Safely extracts a localized string from a field that might be a string or a multilingual JSON object.
 * 
 * @param {string | object} field - The field to translate (e.g., "Hello" or { en: "Hello", fr: "Bonjour" })
 * @param {string} currentLang - The active language code (e.g., 'fr')
 * @param {string} fallbackLang - The language to fallback to if the active one isn't found
 * @returns {string} - The best matched localized string
 */
export const getLocalizedString = (field, currentLang, fallbackLang = 'en') => {
  if (!field) return '';
  
  // If it's just a regular string, return it directly
  if (typeof field === 'string') return field;
  
  // If we've already cached the resolution for this specific object and language, return it
  if (translationCache.has(field)) {
    const cachedLangs = translationCache.get(field);
    if (cachedLangs[currentLang] !== undefined) {
      return cachedLangs[currentLang];
    }
  } else {
    translationCache.set(field, {});
  }
  
  let result = '';
  
  // Resolve translation
  if (field[currentLang]) {
    result = field[currentLang];
  } else if (field[fallbackLang]) {
    result = field[fallbackLang];
  } else {
    // Ultimate fallback: just return the first available value
    const availableKeys = Object.keys(field);
    if (availableKeys.length > 0) {
      result = field[availableKeys[0]];
    }
  }
  
  // Store in cache
  const cachedLangs = translationCache.get(field);
  cachedLangs[currentLang] = result;
  
  return result;
};
