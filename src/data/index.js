export const categories = [
  { id: 'presets', name: 'Presets', icon: 'Palette', count: 234 },
  { id: 'transitions', name: 'Transitions', icon: 'ArrowRightLeft', count: 187 },
  { id: 'luts', name: 'LUTs', icon: 'SunMedium', count: 156 },
  { id: 'overlays', name: 'Overlays', icon: 'Layers', count: 98 },
  { id: 'sfx', name: 'SFX', icon: 'Volume2', count: 312 },
  { id: 'project-files', name: 'Project Files', icon: 'FolderOpen', count: 67 },
  { id: 'editing-packs', name: 'Editing Packs', icon: 'Package', count: 45 },
  { id: 'motion-graphics', name: 'Motion Graphics', icon: 'Sparkles', count: 123 },
  { id: 'templates', name: 'Templates', icon: 'LayoutTemplate', count: 89 },
];

export const creators = [
  { id: 'c1', name: 'Alex Rivera', username: 'alexrivera', avatar: null, followers: 12400, products: 24, sales: 1847, rating: 4.9, verified: true, bio: 'Professional video editor specializing in cinematic presets and color grading.' },
  { id: 'c2', name: 'Sarah Chen', username: 'sarahchen', avatar: null, followers: 8900, products: 18, sales: 1234, rating: 4.8, verified: true, bio: 'Motion designer creating premium transitions and effects.' },
  { id: 'c3', name: 'Marcus Johnson', username: 'marcusjfx', avatar: null, followers: 15200, products: 32, sales: 2456, rating: 4.9, verified: true, bio: 'VFX artist with 10+ years of experience in film and advertising.' },
  { id: 'c4', name: 'Elena Volkov', username: 'elenavolkov', avatar: null, followers: 6700, products: 15, sales: 890, rating: 4.7, verified: true, bio: 'Color scientist creating professional LUTs and color presets.' },
  { id: 'c5', name: 'David Park', username: 'davidpark', avatar: null, followers: 9300, products: 21, sales: 1567, rating: 4.8, verified: true, bio: 'Full-time content creator and template designer.' },
  { id: 'c6', name: 'Mia Thompson', username: 'miathompson', avatar: null, followers: 11100, products: 27, sales: 2100, rating: 4.9, verified: true, bio: 'Sound designer creating professional SFX libraries.' },
];

export const products = [
  {
    id: "p1",
    title: {
      en: "Cinematic Color Grading Pack",
      fr: "Pack d'Étalonnage Cinématique",
      es: "Paquete de Gradación de Color Cinemático"
    },
    description: {
      en: "A comprehensive pack of 50+ cinematic color grading presets for DaVinci Resolve and Premiere Pro. Perfect for films, music videos, and commercial projects. Each preset is carefully crafted to give your footage a professional, cinematic look.",
      fr: "Un pack complet de plus de 50 préréglages...",
      es: "Un paquete completo de más de 50 ajustes preestablecidos..."
    },
    category: "presets",
    price: 49.99,
    salePrice: null,
    rating: 4.9,
    reviews: 127,
    sales: 834,
    views: 12400,
    creator: "c1",
    creatorName: "Alex Rivera",
    tags: [
      "cinematic",
      "color grading",
      "premiere pro",
      "davinci resolve"
    ],
    software: [
      "Premiere Pro",
      "DaVinci Resolve"
    ],
    compatibility: "Premiere Pro, DaVinci Resolve, Final Cut Pro",
    fileSize: "245 MB",
    format: ".cube, .look",
    featured: true,
    isNew: false,
    images: []
  },
  {
    id: "p2",
    title: {
      en: "Smooth Transitions Pack V2",
      fr: "Pack de Transitions Fluides V2",
      es: "Paquete de Transiciones Suaves V2"
    },
    description: {
      en: "100+ seamless transitions for any video project. Includes zoom, spin, warp, glitch, and lens distortion transitions. Drag and drop, no plugins required.",
      fr: "100+ seamless transitions for any video project. Includes zoom, spin, warp, glitch, and lens distortion transitions. Drag and drop, no plugins required. [FR]",
      es: "100+ seamless transitions for any video project. Includes zoom, spin, warp, glitch, and lens distortion transitions. Drag and drop, no plugins required. [ES]"
    },
    category: "transitions",
    price: 39.99,
    salePrice: 29.99,
    rating: 4.8,
    reviews: 89,
    sales: 567,
    views: 8900,
    creator: "c2",
    creatorName: "Sarah Chen",
    tags: [
      "transitions",
      "seamless",
      "premiere pro"
    ],
    software: [
      "Premiere Pro",
      "After Effects"
    ],
    compatibility: "Premiere Pro, After Effects",
    fileSize: "180 MB",
    format: ".prproj, .mogrt",
    featured: true,
    isNew: true,
    images: []
  },
  {
    id: "p3",
    title: {
      en: "VFX Essentials Bundle",
      fr: "VFX Essentials Bundle [FR]",
      es: "VFX Essentials Bundle [ES]"
    },
    description: {
      en: "Everything you need for professional VFX work. Includes green screen tools, particle effects, light leaks, and compositing presets.",
      fr: "Everything you need for professional VFX work. Includes green screen tools, particle effects, light leaks, and compositing presets. [FR]",
      es: "Everything you need for professional VFX work. Includes green screen tools, particle effects, light leaks, and compositing presets. [ES]"
    },
    category: "overlays",
    price: 79.99,
    salePrice: null,
    rating: 4.9,
    reviews: 203,
    sales: 1245,
    views: 18700,
    creator: "c3",
    creatorName: "Marcus Johnson",
    tags: [
      "vfx",
      "effects",
      "compositing",
      "green screen"
    ],
    software: [
      "After Effects",
      "Blender"
    ],
    compatibility: "After Effects, Nuke, Fusion",
    fileSize: "1.2 GB",
    format: ".aep, .mov",
    featured: true,
    isNew: false,
    images: []
  },
  {
    id: "p4",
    title: {
      en: "Film Look LUT Collection",
      fr: "Film Look LUT Collection [FR]",
      es: "Film Look LUT Collection [ES]"
    },
    description: {
      en: "35 premium film emulation LUTs that recreate the look of iconic film stocks. From Kodak Portra to Fuji Velvia.",
      fr: "35 premium film emulation LUTs that recreate the look of iconic film stocks. From Kodak Portra to Fuji Velvia. [FR]",
      es: "35 premium film emulation LUTs that recreate the look of iconic film stocks. From Kodak Portra to Fuji Velvia. [ES]"
    },
    category: "luts",
    price: 34.99,
    salePrice: null,
    rating: 4.7,
    reviews: 56,
    sales: 423,
    views: 6200,
    creator: "c4",
    creatorName: "Elena Volkov",
    tags: [
      "luts",
      "film",
      "color grading",
      "film stock"
    ],
    software: [
      "Premiere Pro",
      "Final Cut Pro"
    ],
    compatibility: "Any NLE with LUT support",
    fileSize: "15 MB",
    format: ".cube",
    featured: false,
    isNew: false,
    images: []
  },
  {
    id: "p5",
    title: {
      en: "YouTube Creator Toolkit",
      fr: "YouTube Creator Toolkit [FR]",
      es: "YouTube Creator Toolkit [ES]"
    },
    description: {
      en: "Complete toolkit for YouTube creators including intro templates, lower thirds, subscribe animations, end screens, and transitions.",
      fr: "Complete toolkit for YouTube creators including intro templates, lower thirds, subscribe animations, end screens, and transitions. [FR]",
      es: "Complete toolkit for YouTube creators including intro templates, lower thirds, subscribe animations, end screens, and transitions. [ES]"
    },
    category: "templates",
    price: 59.99,
    salePrice: 44.99,
    rating: 4.8,
    reviews: 167,
    sales: 2100,
    views: 24500,
    creator: "c5",
    creatorName: "David Park",
    tags: [
      "youtube",
      "templates",
      "intro",
      "lower thirds"
    ],
    software: [
      "Premiere Pro",
      "After Effects"
    ],
    compatibility: "Premiere Pro, After Effects",
    fileSize: "350 MB",
    format: ".mogrt, .aep",
    featured: true,
    isNew: false,
    images: []
  },
  {
    id: "p6",
    title: {
      en: "Cinematic SFX Library",
      fr: "Cinematic SFX Library [FR]",
      es: "Cinematic SFX Library [ES]"
    },
    description: {
      en: "500+ royalty-free cinematic sound effects. Includes impacts, risers, whooshes, drones, and ambient textures.",
      fr: "500+ royalty-free cinematic sound effects. Includes impacts, risers, whooshes, drones, and ambient textures. [FR]",
      es: "500+ royalty-free cinematic sound effects. Includes impacts, risers, whooshes, drones, and ambient textures. [ES]"
    },
    category: "sfx",
    price: 29.99,
    salePrice: null,
    rating: 4.9,
    reviews: 234,
    sales: 1890,
    views: 15600,
    creator: "c6",
    creatorName: "Mia Thompson",
    tags: [
      "sfx",
      "sound effects",
      "cinematic",
      "royalty free"
    ],
    software: [
      "Premiere Pro",
      "DaVinci Resolve"
    ],
    compatibility: "Any audio/video editor",
    fileSize: "2.1 GB",
    format: ".wav, .mp3",
    featured: false,
    isNew: true,
    images: []
  },
  {
    id: "p7",
    title: {
      en: "Glitch & Distortion Pack",
      fr: "Glitch & Distortion Pack [FR]",
      es: "Glitch & Distortion Pack [ES]"
    },
    description: {
      en: "75+ glitch effects, distortions, and digital artifacts for creating trendy, modern video content.",
      fr: "75+ glitch effects, distortions, and digital artifacts for creating trendy, modern video content. [FR]",
      es: "75+ glitch effects, distortions, and digital artifacts for creating trendy, modern video content. [ES]"
    },
    category: "overlays",
    price: 24.99,
    salePrice: null,
    rating: 4.6,
    reviews: 45,
    sales: 378,
    views: 5400,
    creator: "c2",
    creatorName: "Sarah Chen",
    tags: [
      "glitch",
      "distortion",
      "effects",
      "overlay"
    ],
    software: [
      "After Effects",
      "CapCut"
    ],
    compatibility: "Any NLE",
    fileSize: "450 MB",
    format: ".mov, .mp4",
    featured: false,
    isNew: false,
    images: []
  },
  {
    id: "p8",
    title: {
      en: "Wedding Film Preset Pack",
      fr: "Wedding Film Preset Pack [FR]",
      es: "Wedding Film Preset Pack [ES]"
    },
    description: {
      en: "40 beautiful wedding color presets designed for romantic, soft, and timeless wedding films.",
      fr: "40 beautiful wedding color presets designed for romantic, soft, and timeless wedding films. [FR]",
      es: "40 beautiful wedding color presets designed for romantic, soft, and timeless wedding films. [ES]"
    },
    category: "presets",
    price: 39.99,
    salePrice: null,
    rating: 4.8,
    reviews: 78,
    sales: 645,
    views: 9100,
    creator: "c4",
    creatorName: "Elena Volkov",
    tags: [
      "wedding",
      "presets",
      "color grading",
      "romantic"
    ],
    software: [
      "Lightroom",
      "DaVinci Resolve"
    ],
    compatibility: "Premiere Pro, DaVinci Resolve",
    fileSize: "120 MB",
    format: ".cube, .look",
    featured: false,
    isNew: false,
    images: []
  },
  {
    id: "p9",
    title: {
      en: "Motion Graphics Toolkit",
      fr: "Motion Graphics Toolkit [FR]",
      es: "Motion Graphics Toolkit [ES]"
    },
    description: {
      en: "Professional motion graphics templates including titles, callouts, infographics, and animated icons.",
      fr: "Professional motion graphics templates including titles, callouts, infographics, and animated icons. [FR]",
      es: "Professional motion graphics templates including titles, callouts, infographics, and animated icons. [ES]"
    },
    category: "motion-graphics",
    price: 69.99,
    salePrice: 49.99,
    rating: 4.9,
    reviews: 156,
    sales: 1340,
    views: 20100,
    creator: "c3",
    creatorName: "Marcus Johnson",
    tags: [
      "motion graphics",
      "titles",
      "infographics",
      "after effects"
    ],
    software: [
      "After Effects",
      "Photoshop"
    ],
    compatibility: "After Effects",
    fileSize: "890 MB",
    format: ".aep",
    featured: true,
    isNew: false,
    images: []
  },
  {
    id: "p10",
    title: {
      en: "Premiere Pro Editing Pack",
      fr: "Premiere Pro Editing Pack [FR]",
      es: "Premiere Pro Editing Pack [ES]"
    },
    description: {
      en: "Complete editing pack with transitions, titles, effects, and presets. 200+ assets for Premiere Pro.",
      fr: "Complete editing pack with transitions, titles, effects, and presets. 200+ assets for Premiere Pro. [FR]",
      es: "Complete editing pack with transitions, titles, effects, and presets. 200+ assets for Premiere Pro. [ES]"
    },
    category: "editing-packs",
    price: 89.99,
    salePrice: null,
    rating: 4.8,
    reviews: 198,
    sales: 1567,
    views: 22300,
    creator: "c5",
    creatorName: "David Park",
    tags: [
      "premiere pro",
      "editing pack",
      "transitions",
      "titles"
    ],
    software: [
      "Premiere Pro",
      "Final Cut Pro"
    ],
    compatibility: "Premiere Pro 2024+",
    fileSize: "1.5 GB",
    format: ".prproj, .mogrt",
    featured: true,
    isNew: false,
    images: []
  },
  {
    id: "p11",
    title: {
      en: "Ambient Music Pack",
      fr: "Ambient Music Pack [FR]",
      es: "Ambient Music Pack [ES]"
    },
    description: {
      en: "25 royalty-free ambient music tracks perfect for background music in vlogs, documentaries, and corporate videos.",
      fr: "25 royalty-free ambient music tracks perfect for background music in vlogs, documentaries, and corporate videos. [FR]",
      es: "25 royalty-free ambient music tracks perfect for background music in vlogs, documentaries, and corporate videos. [ES]"
    },
    category: "sfx",
    price: 19.99,
    salePrice: null,
    rating: 4.5,
    reviews: 34,
    sales: 290,
    views: 4100,
    creator: "c6",
    creatorName: "Mia Thompson",
    tags: [
      "music",
      "ambient",
      "background",
      "royalty free"
    ],
    software: [
      "Final Cut Pro",
      "CapCut"
    ],
    compatibility: "Any video/audio editor",
    fileSize: "780 MB",
    format: ".wav, .mp3",
    featured: false,
    isNew: true,
    images: []
  },
  {
    id: "p12",
    title: {
      en: "Documentary LUT Pack",
      fr: "Documentary LUT Pack [FR]",
      es: "Documentary LUT Pack [ES]"
    },
    description: {
      en: "20 carefully crafted LUTs designed for documentary filmmaking. Authentic, natural looks with subtle color shifts.",
      fr: "20 carefully crafted LUTs designed for documentary filmmaking. Authentic, natural looks with subtle color shifts. [FR]",
      es: "20 carefully crafted LUTs designed for documentary filmmaking. Authentic, natural looks with subtle color shifts. [ES]"
    },
    category: "luts",
    price: 29.99,
    salePrice: 19.99,
    rating: 4.7,
    reviews: 42,
    sales: 310,
    views: 5300,
    creator: "c1",
    creatorName: "Alex Rivera",
    tags: [
      "documentary",
      "luts",
      "natural",
      "film"
    ],
    software: [
      "DaVinci Resolve",
      "Lightroom"
    ],
    compatibility: "Any NLE with LUT support",
    fileSize: "8 MB",
    format: ".cube",
    featured: false,
    isNew: false,
    images: []
  }
];

export const reviews = [
  { id: 'r1', productId: 'p1', userId: 'u1', userName: 'James Wilson', rating: 5, comment: 'Absolutely incredible presets. The cinematic look is spot on and very easy to customize. Best purchase I\'ve made this year!', date: '2025-04-15', verified: true },
  { id: 'r2', productId: 'p1', userId: 'u2', userName: 'Sophie Adams', rating: 5, comment: 'These presets transformed my workflow. The quality is professional-grade and the variety is impressive.', date: '2025-04-10', verified: true },
  { id: 'r3', productId: 'p1', userId: 'u3', userName: 'Mike Chen', rating: 4, comment: 'Great presets overall. A few of them needed some tweaking for my footage but the base looks are excellent.', date: '2025-03-28', verified: true },
  { id: 'r4', productId: 'p2', userId: 'u4', userName: 'Lisa Park', rating: 5, comment: 'Smoothest transitions I\'ve ever used. No plugins required which is a huge plus. Very well organized too.', date: '2025-04-12', verified: true },
  { id: 'r5', productId: 'p2', userId: 'u5', userName: 'Tom Richards', rating: 4, comment: 'Solid pack of transitions. The zoom ones are particularly good. Would love to see more variety in the next update.', date: '2025-04-05', verified: true },
  { id: 'r6', productId: 'p3', userId: 'u6', userName: 'Anna Kowalski', rating: 5, comment: 'This bundle is worth every penny. The VFX tools are professional quality and the documentation is excellent.', date: '2025-03-20', verified: true },
];

export const analyticsData = {
  revenue: [
    { month: 'Jan', revenue: 2400, sales: 45 },
    { month: 'Feb', revenue: 3100, sales: 58 },
    { month: 'Mar', revenue: 2800, sales: 52 },
    { month: 'Apr', revenue: 3600, sales: 67 },
    { month: 'May', revenue: 4200, sales: 78 },
    { month: 'Jun', revenue: 3900, sales: 73 },
    { month: 'Jul', revenue: 4800, sales: 89 },
    { month: 'Aug', revenue: 5200, sales: 96 },
    { month: 'Sep', revenue: 4600, sales: 85 },
    { month: 'Oct', revenue: 5800, sales: 108 },
    { month: 'Nov', revenue: 6200, sales: 115 },
    { month: 'Dec', revenue: 7100, sales: 132 },
  ],
  productViews: [
    { day: 'Mon', views: 420 },
    { day: 'Tue', views: 380 },
    { day: 'Wed', views: 510 },
    { day: 'Thu', views: 470 },
    { day: 'Fri', views: 560 },
    { day: 'Sat', views: 620 },
    { day: 'Sun', views: 490 },
  ],
  salesByCategory: [
    { category: 'Presets', value: 35 },
    { category: 'Transitions', value: 22 },
    { category: 'LUTs', value: 15 },
    { category: 'SFX', value: 12 },
    { category: 'Templates', value: 10 },
    { category: 'Other', value: 6 },
  ],
};

export const orders = [
  { id: 'ord-001', product: 'Cinematic Color Grading Pack', customer: 'James Wilson', email: 'james@email.com', amount: 49.99, status: 'completed', date: '2025-05-18' },
  { id: 'ord-002', product: 'Smooth Transitions Pack V2', customer: 'Sophie Adams', email: 'sophie@email.com', amount: 29.99, status: 'completed', date: '2025-05-17' },
  { id: 'ord-003', product: 'VFX Essentials Bundle', customer: 'Mike Chen', email: 'mike@email.com', amount: 79.99, status: 'pending', date: '2025-05-17' },
  { id: 'ord-004', product: 'Film Look LUT Collection', customer: 'Lisa Park', email: 'lisa@email.com', amount: 34.99, status: 'completed', date: '2025-05-16' },
  { id: 'ord-005', product: 'YouTube Creator Toolkit', customer: 'Tom Richards', email: 'tom@email.com', amount: 44.99, status: 'completed', date: '2025-05-15' },
  { id: 'ord-006', product: 'Cinematic SFX Library', customer: 'Anna Kowalski', email: 'anna@email.com', amount: 29.99, status: 'cancelled', date: '2025-05-14' },
  { id: 'ord-007', product: 'Motion Graphics Toolkit', customer: 'David Kim', email: 'david@email.com', amount: 49.99, status: 'completed', date: '2025-05-13' },
  { id: 'ord-008', product: 'Premiere Pro Editing Pack', customer: 'Emma Brown', email: 'emma@email.com', amount: 89.99, status: 'pending', date: '2025-05-12' },
];

export const messages = [
  { id: 'conv-1', with: { name: 'James Wilson', avatar: null, online: true }, lastMessage: 'Thanks for the quick response!', time: '2 min ago', unread: 2, messages: [
    { id: 'm1', from: 'them', text: 'Hi, I just purchased your Cinematic Pack. Quick question about the LUT compatibility.', time: '10:30 AM' },
    { id: 'm2', from: 'me', text: 'Hey James! Thanks for the purchase. The LUTs work with any NLE that supports .cube files. What software are you using?', time: '10:32 AM' },
    { id: 'm3', from: 'them', text: 'I\'m using DaVinci Resolve. Just wanted to make sure they work there.', time: '10:35 AM' },
    { id: 'm4', from: 'me', text: 'Absolutely! DaVinci Resolve has great LUT support. Just drag them into the LUT folder and they\'ll appear in the color panel.', time: '10:36 AM' },
    { id: 'm5', from: 'them', text: 'Thanks for the quick response!', time: '10:38 AM' },
  ]},
  { id: 'conv-2', with: { name: 'Sophie Adams', avatar: null, online: false }, lastMessage: 'Would love to collaborate on a new pack!', time: '1 hour ago', unread: 0, messages: [
    { id: 'm6', from: 'them', text: 'Hey! I love your transition packs. Would love to collaborate on a new pack!', time: 'Yesterday' },
    { id: 'm7', from: 'me', text: 'That sounds great! I\'d be interested. What kind of pack were you thinking?', time: 'Yesterday' },
    { id: 'm8', from: 'them', text: 'Would love to collaborate on a new pack!', time: '1 hour ago' },
  ]},
  { id: 'conv-3', with: { name: 'Mike Chen', avatar: null, online: true }, lastMessage: 'Can you send the updated files?', time: '3 hours ago', unread: 1, messages: [
    { id: 'm9', from: 'them', text: 'Hey, I noticed a small bug in the green screen preset. The edges are a bit rough.', time: '3 hours ago' },
    { id: 'm10', from: 'me', text: 'Thanks for letting me know! I\'ll fix that right away.', time: '3 hours ago' },
    { id: 'm11', from: 'them', text: 'Can you send the updated files?', time: '3 hours ago' },
  ]},
];

export const notifications = [
  { id: 'n1', type: 'sale', title: 'New sale!', message: 'James Wilson purchased Cinematic Color Grading Pack', time: '2 min ago', read: false },
  { id: 'n2', type: 'follower', title: 'New follower', message: 'Sophie Adams started following you', time: '1 hour ago', read: false },
  { id: 'n3', type: 'review', title: 'New review', message: 'Mike Chen left a 5-star review on VFX Essentials', time: '3 hours ago', read: true },
  { id: 'n4', type: 'sale', title: 'New sale!', message: 'Lisa Park purchased Film Look LUT Collection', time: '5 hours ago', read: true },
  { id: 'n5', type: 'message', title: 'New message', message: 'Tom Richards sent you a message', time: 'Yesterday', read: true },
  { id: 'n6', type: 'approved', title: 'Product approved', message: 'Your product "Wedding Film Preset Pack" has been approved', time: '2 days ago', read: true },
];
