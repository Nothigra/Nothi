/**
 * seed.js — Mock fallback data for design review.
 * 
 * This file is ONLY used when Supabase credentials are missing (isMockMode === true).
 * Once real credentials are provided, all data flows from Supabase instead.
 * 
 * To remove: delete this file and remove all `isMockMode` branches in the codebase.
 */

export const MOCK_PRODUCTS = [
  { 
    id: 'p1', 
    creator_id: '50baef0e-53bc-4829-9ea8-2b959c2cce25', 
    title: { 
      en: 'Cinematic Color Grading Pack', 
      fr: 'Pack de Colorimétrie Cinématique', 
      es: 'Paquete de Gradación de Color Cinemático' 
    }, 
    description: {
      en: 'A comprehensive pack of 50+ cinematic color grading presets for DaVinci Resolve and Premiere Pro. Perfect for films, music videos, and commercial projects.',
      fr: 'Un pack complet de plus de 50 presets de colorimétrie cinématique pour DaVinci Resolve et Premiere Pro. Parfait pour les films, clips musicaux et projets commerciaux.',
      es: 'Un paquete completo de más de 50 preajustes de gradación de color cinemático para DaVinci Resolve y Premiere Pro. Perfecto para películas, videos musicales y proyectos comerciales.'
    }, 
    category: 'effects', price: 49.99, currency: 'USD', rating: 4.9, reviews_count: 127, sales_count: 834, views: 12400, 
    tags: {
      en: ['cinematic', 'color grading', 'premiere pro'],
      fr: ['cinématique', 'étalonnage', 'premiere pro'],
      es: ['cinemático', 'gradación de color', 'premiere pro']
    }, 
    software: ['Premiere Pro', 'DaVinci Resolve'], 
    style: ['Movie', 'Ads', 'YouTube'],
    file_size: '245 MB', format: '.cube, .look', status: 'published', images: [], video_url: '', created_at: '2024-06-01T00:00:00Z' 
  },
  { 
    id: 'p2', 
    creator_id: '8d5978d0-ba59-48dd-a90e-adf4b6b00a65', 
    title: { 
      en: 'Smooth Transitions Pack V2', 
      fr: 'Pack de Transitions Fluides V2',
      es: 'Paquete de Transiciones Suaves V2'
    }, 
    description: {
      en: '100+ seamless transitions for any video project. Includes zoom, spin, warp, glitch, and lens distortion transitions.',
      fr: 'Plus de 100 transitions fluides pour tout projet vidéo. Inclut des transitions de zoom, rotation, déformation, glitch et distorsion.',
      es: 'Más de 100 transiciones fluidas para cualquier proyecto de video. Incluye transiciones de zoom, giro, deformación, fallo y distorsión.'
    }, 
    category: 'transitions', price: 39.99, sale_price: 29.99, currency: 'USD', rating: 4.8, reviews_count: 89, sales_count: 567, views: 8900, 
    tags: {
      en: ['transitions', 'seamless', 'premiere pro'],
      fr: ['transitions', 'fluide', 'premiere pro'],
      es: ['transiciones', 'fluido', 'premiere pro']
    }, 
    software: ['Premiere Pro', 'After Effects', 'Final Cut Pro'], 
    style: ['Transitions', 'Flow', 'Motion Design'],
    file_size: '1.2 GB', format: '.prproj, .aep', status: 'published', images: [], video_url: '', created_at: '2024-06-10T00:00:00Z' 
  },
  { id: 'p3', creator_id: 'mock-user-3', title: 'VFX Essentials Bundle', description: 'Everything you need for professional VFX work. Includes green screen tools, particle effects, light leaks, and compositing presets.', category: 'overlays', price: 79.99, currency: 'USD', rating: 4.9, reviews_count: 203, sales_count: 1245, views: 18700, tags: ['vfx', 'effects', 'compositing'], software: ['After Effects', 'Blender'], file_size: '1.2 GB', format: '.aep, .mov', status: 'published', images: [], video_url: '', created_at: '2024-05-20T00:00:00Z' },
  { id: 'p4', creator_id: 'mock-user-4', title: 'Film Look LUT Collection', description: '35 premium film emulation LUTs that recreate the look of iconic film stocks. From Kodak Portra to Fuji Velvia.', category: 'luts', price: 34.99, currency: 'USD', rating: 4.7, reviews_count: 56, sales_count: 423, views: 6200, tags: ['luts', 'film', 'color grading'], software: ['Premiere Pro', 'Final Cut Pro'], file_size: '15 MB', format: '.cube', status: 'published', images: [], video_url: '', created_at: '2024-08-01T00:00:00Z' },
  { id: 'p5', creator_id: 'mock-user-5', title: 'YouTube Creator Toolkit', description: 'Complete toolkit for YouTube creators including intro templates, lower thirds, subscribe animations, and end screens.', category: 'templates', price: 59.99, sale_price: 44.99, currency: 'USD', rating: 4.8, reviews_count: 167, sales_count: 2100, views: 24500, tags: ['youtube', 'templates', 'intro'], software: ['Premiere Pro', 'After Effects'], file_size: '350 MB', format: '.mogrt, .aep', status: 'published', images: [], video_url: '', created_at: '2024-04-10T00:00:00Z' },
  { id: 'p6', creator_id: 'mock-user-6', title: 'Cinematic SFX Library', description: '500+ royalty-free cinematic sound effects. Includes impacts, risers, whooshes, drones, and ambient textures.', category: 'sfx', price: 29.99, currency: 'USD', rating: 4.9, reviews_count: 234, sales_count: 1890, views: 15600, tags: ['sfx', 'sound effects', 'cinematic'], software: ['Premiere Pro', 'DaVinci Resolve'], file_size: '2.1 GB', format: '.wav, .mp3', status: 'published', images: [], video_url: '', created_at: '2024-09-01T00:00:00Z' },
  { id: 'p7', creator_id: '8d5978d0-ba59-48dd-a90e-adf4b6b00a65', title: 'Glitch & Distortion Pack', description: '75+ glitch effects, distortions, and digital artifacts for creating trendy, modern video content.', category: 'overlays', price: 24.99, currency: 'USD', rating: 4.6, reviews_count: 45, sales_count: 378, views: 5400, tags: ['glitch', 'distortion', 'effects'], software: ['After Effects', 'CapCut'], file_size: '450 MB', format: '.mov, .mp4', status: 'published', images: [], video_url: '', created_at: '2024-10-01T00:00:00Z' },
  { id: 'p8', creator_id: 'mock-user-4', title: 'Wedding Film Preset Pack', description: '40 beautiful wedding color presets designed for romantic, soft, and timeless wedding films.', category: 'effects', price: 39.99, currency: 'USD', rating: 4.8, reviews_count: 78, sales_count: 645, views: 9100, tags: ['wedding', 'presets', 'romantic'], software: ['Lightroom', 'DaVinci Resolve'], file_size: '120 MB', format: '.cube, .look', status: 'published', images: [], video_url: '', created_at: '2024-11-01T00:00:00Z' },
  { id: 'p9', creator_id: 'mock-user-3', title: 'Motion Graphics Toolkit', description: 'Professional motion graphics templates including titles, callouts, infographics, and animated icons.', category: 'projects', price: 69.99, sale_price: 49.99, currency: 'USD', rating: 4.9, reviews_count: 156, sales_count: 1340, views: 20100, tags: ['motion graphics', 'titles', 'after effects'], software: ['After Effects'], style: ['Typography', 'Trend', 'AMV'], file_size: '450 MB', format: '.aep', status: 'published', images: [], video_url: '', created_at: '2024-06-15T00:00:00Z' },
  { id: 'p10', creator_id: 'mock-user-5', title: 'Premiere Pro Editing Pack', description: 'Complete editing pack with transitions, titles, effects, and presets. 200+ assets for Premiere Pro.', category: 'packs', price: 89.99, currency: 'USD', rating: 4.8, reviews_count: 198, sales_count: 1567, views: 22300, tags: ['premiere pro', 'editing pack', 'transitions'], software: ['Premiere Pro', 'Final Cut Pro'], file_size: '1.5 GB', format: '.prproj, .mogrt', status: 'published', images: [], video_url: '', created_at: '2025-01-01T00:00:00Z' },
  { id: 'p11', creator_id: 'mock-user-6', title: 'Ambient Music Pack', description: '25 royalty-free ambient music tracks for vlogs, documentaries, and corporate videos.', category: 'sfx', price: 19.99, currency: 'USD', rating: 4.5, reviews_count: 34, sales_count: 290, views: 4100, tags: ['music', 'ambient', 'royalty free'], software: ['Final Cut Pro', 'CapCut'], file_size: '780 MB', format: '.wav, .mp3', status: 'published', images: [], video_url: '', created_at: '2025-02-01T00:00:00Z' },
  { id: 'p12', creator_id: '50baef0e-53bc-4829-9ea8-2b959c2cce25', title: 'Documentary LUT Pack', description: '20 carefully crafted LUTs designed for documentary filmmaking. Authentic, natural looks.', category: 'luts', price: 29.99, sale_price: 19.99, currency: 'USD', rating: 4.7, reviews_count: 42, sales_count: 310, views: 5300, tags: ['documentary', 'luts', 'film'], software: ['DaVinci Resolve', 'Lightroom'], file_size: '8 MB', format: '.cube', status: 'published', images: [], video_url: '', created_at: '2025-03-01T00:00:00Z' },
];

export const MOCK_CREATORS = [
  // TEMP: real UUIDs for Follow system testing, do not commit.
  { id: '50baef0e-53bc-4829-9ea8-2b959c2cce25', username: 'alexrivera', avatar_url: null, bio: 'Professional video editor specializing in cinematic presets.', software: ['Premiere Pro', 'DaVinci Resolve'], sales_count: 1847, follower_count: 842, rating: 4.9, products_count: 24 },
  { id: '8d5978d0-ba59-48dd-a90e-adf4b6b00a65', username: 'sarahchen', avatar_url: null, bio: 'Motion designer creating premium transitions and effects.', software: ['Premiere Pro', 'After Effects'], sales_count: 1234, follower_count: 1056, rating: 4.8, products_count: 18 },
  { id: 'mock-user-3', username: 'marcusjfx', avatar_url: null, bio: 'VFX artist with 10+ years of experience.', software: ['After Effects', 'Blender'], sales_count: 2456, follower_count: 320, rating: 4.9, products_count: 32 },
  { id: 'mock-user-4', username: 'elenavolkov', avatar_url: null, bio: 'Color scientist creating professional LUTs.', software: ['DaVinci Resolve', 'Lightroom'], sales_count: 890, follower_count: 98, rating: 4.7, products_count: 15 },
  { id: 'mock-user-5', username: 'davidpark', avatar_url: null, bio: 'Full-time content creator and template designer.', software: ['Premiere Pro', 'After Effects'], sales_count: 1567, follower_count: 1560, rating: 4.8, products_count: 21 },
  { id: 'mock-user-6', username: 'miathompson', avatar_url: null, bio: 'Sound designer creating professional SFX libraries.', software: ['Premiere Pro', 'DaVinci Resolve'], sales_count: 2100, follower_count: 4200, rating: 4.9, products_count: 27 },
];

export const CATEGORIES = [
  { id: 'packs', name: 'Packs', icon: 'Package' },
  { id: 'effects', name: 'Effects', icon: 'Sparkles' },
  { id: 'projects', name: 'Project Files', icon: 'FolderArchive' },
  { id: 'luts', name: 'LUTs', icon: 'Contrast' },
  { id: 'sfx', name: 'SFX', icon: 'Volume2' },
  { id: 'transitions', name: 'Transitions', icon: 'ArrowRightLeft' },
  { id: 'templates', name: 'Templates', icon: 'LayoutTemplate' },
  { id: 'scripts', name: 'Scripts', icon: 'TerminalSquare' },
  { id: 'overlays', name: 'Overlays', icon: 'Layers' },
];

export const SOFTWARE_LIST = [
  'After Effects', 'CapCut', 'Premiere Pro', 'DaVinci Resolve', 
  'Alight Motion', 'Blender', 'Cinema 4D', 'Final Cut Pro', 
  'Filmora', 'iMovie', 'Blurrr', 'Vegas Pro'
];

export const STYLE_LIST = [
  'Movie', 'AMV', 'Football', 'Flow', 'Typography', 'Transitions', 
  'Motion Design', 'Shorts', 'Ads', 'YouTube', '3D Transitions', 
  'Warp', 'Hard Shake', 'Trend', 'Agony'
];

export const CURRENCY_LIST = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
];

export const COUNTRY_LIST = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
  'France', 'Spain', 'Italy', 'Netherlands', 'Brazil', 
  'Mexico', 'India', 'Japan', 'South Korea', 'China', 
  'Russia', 'South Africa', 'Nigeria', 'Argentina', 'Colombia',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland',
  'Belgium', 'Austria', 'Poland', 'Turkey', 'Saudi Arabia',
  'United Arab Emirates', 'Singapore', 'Malaysia', 'Indonesia', 'Philippines',
  'Vietnam', 'Thailand', 'New Zealand', 'Ireland', 'Portugal',
  'Greece', 'Israel', 'Egypt', 'Morocco', 'Kenya', 'Other'
].sort();
