import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getLocalizedString } from '../utils/i18nHelpers';

// Simple debounce utility hook
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useUnifiedSearch(query, lang = 'en') {
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim() === '') {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    const lowerQuery = debouncedQuery.toLowerCase().trim();
    setIsSearching(true);

    async function fetchAndScore() {
      try {
        const [productsRes, profilesRes] = await Promise.all([
          supabase.from('public_products')
            .select('*')
            .or(`title.ilike.%${lowerQuery}%,description.ilike.%${lowerQuery}%`)
            .limit(10),
          supabase.from('public_profiles')
            .select('*')
            .or(`username.ilike.%${lowerQuery}%,bio.ilike.%${lowerQuery}%`)
            .limit(10)
        ]);

        if (!isMounted) return;

        let combinedResults = [];

        // Score Products
        if (productsRes.data) {
          productsRes.data.forEach(p => {
            let score = 0;
            const title = getLocalizedString(p.title, lang).toLowerCase();
            const desc = getLocalizedString(p.description, lang).toLowerCase();
            
            let tagsArray = [];
            if (Array.isArray(p.tags)) {
              tagsArray = p.tags;
            } else if (p.tags) {
              tagsArray = p.tags[lang] || p.tags.en || Object.values(p.tags)[0] || [];
            }

            if (title === lowerQuery) score += 100;
            else if (title.startsWith(lowerQuery)) score += 80;
            else if (title.includes(lowerQuery)) score += 50;

            if (desc.includes(lowerQuery)) score += 20;
            if (tagsArray.some(t => t.toLowerCase().includes(lowerQuery))) score += 20;

            if (score > 0) {
              combinedResults.push({ type: 'product', data: p, score });
            }
          });
        }

        // Score Sellers
        if (profilesRes.data) {
          profilesRes.data.forEach(c => {
            let score = 0;
            const name = (c.name || '').toLowerCase();
            const username = (c.username || '').toLowerCase();
            const bio = (c.bio || '').toLowerCase();

            if (name === lowerQuery || username === lowerQuery) score += 100;
            else if (name.startsWith(lowerQuery) || username.startsWith(lowerQuery)) score += 80;
            else if (name.includes(lowerQuery) || username.includes(lowerQuery)) score += 50;

            if (bio.includes(lowerQuery)) score += 20;

            if (score > 0) {
              combinedResults.push({ type: 'seller', data: c, score });
            }
          });
        }

        // Sort by score descending and return top 6
        combinedResults.sort((a, b) => b.score - a.score);
        setResults(combinedResults.slice(0, 6));
      } catch (err) {
        console.error('Unified search error:', err);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }

    fetchAndScore();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, lang]);

  return { results, debouncedQuery, isSearching };
}
