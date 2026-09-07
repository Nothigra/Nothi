export function hexToRGB(hex) {
  let r = 0, g = 0, b = 0;
  if (!hex) return { r, g, b };
  const str = hex.replace('#', '');
  if (str.length === 3) {
    r = parseInt(str[0] + str[0], 16);
    g = parseInt(str[1] + str[1], 16);
    b = parseInt(str[2] + str[2], 16);
  } else if (str.length === 6) {
    r = parseInt(str.substring(0, 2), 16);
    g = parseInt(str.substring(2, 4), 16);
    b = parseInt(str.substring(4, 6), 16);
  }
  return { r, g, b };
}

export function getLuminance({ r, g, b }) {
  const a = [r, g, b].map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function adjustHexColor(hex, amount) {
  let { r, g, b } = hexToRGB(hex);
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  return '#' + [r, g, b].map(x => {
    const hexStr = x.toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  }).join('');
}

export function getContrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function applyCustomTheme(customTheme) {
  if (!customTheme || !customTheme.bg || !customTheme.accent) return;

  const bg = customTheme.bg;
  const accent = customTheme.accent;
  const lum = getLuminance(hexToRGB(bg));
  const isLight = lum > 0.5;

  const style = document.documentElement.style;
  style.setProperty('--color-bg', bg);
  style.setProperty('--color-accent', accent);
  style.setProperty('--color-accent-hover', adjustHexColor(accent, -20));
  
  // Subtle accent (requires RGB)
  const accentRgb = hexToRGB(accent);
  style.setProperty('--color-accent-subtle', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.12)`);

  // Hero Glow Logic
  const glowEnabled = customTheme.heroGlow?.enabled !== false; // defaults to true
  const glow1 = customTheme.heroGlow?.color1 || accent;
  const glow2 = customTheme.heroGlow?.color2 || '#F5A623';
  const glow1Rgb = hexToRGB(glow1);
  const glow2Rgb = hexToRGB(glow2);
  
  style.setProperty('--hero-glow-opacity', glowEnabled ? '1' : '0');
  style.setProperty('--color-hero-glow-1', `rgba(${glow1Rgb.r}, ${glow1Rgb.g}, ${glow1Rgb.b}, 0.15)`);
  style.setProperty('--color-hero-glow-2', `rgba(${glow2Rgb.r}, ${glow2Rgb.g}, ${glow2Rgb.b}, 0.12)`);

  if (isLight) {
    document.documentElement.classList.remove('dark-custom-logo');
    style.setProperty('--color-text-primary', '#14151F');
    style.setProperty('--color-text-secondary', '#5B5F73');
    style.setProperty('--color-text-tertiary', '#8C92AA');
    // Surface logic: if bg is very light, card is pure white. Else, lighten slightly.
    const cardBg = lum > 0.9 ? '#FFFFFF' : adjustHexColor(bg, 15);
    style.setProperty('--color-bg-card', cardBg);
    style.setProperty('--color-bg-secondary', adjustHexColor(bg, -8));
    style.setProperty('--color-bg-tertiary', adjustHexColor(bg, -15));
    style.setProperty('--color-border', adjustHexColor(bg, -20));
    style.setProperty('--color-border-strong', adjustHexColor(bg, -35));
    document.documentElement.style.colorScheme = 'light';
  } else {
    document.documentElement.classList.add('dark-custom-logo');
    style.setProperty('--color-text-primary', '#ECECEA');
    style.setProperty('--color-text-secondary', '#A8A8A4');
    style.setProperty('--color-text-tertiary', '#6E6E6A');
    // Surface logic for dark: lighten slightly
    style.setProperty('--color-bg-card', adjustHexColor(bg, 12));
    style.setProperty('--color-bg-secondary', adjustHexColor(bg, 18));
    style.setProperty('--color-bg-tertiary', adjustHexColor(bg, 25));
    style.setProperty('--color-border', `rgba(255, 255, 255, 0.1)`);
    style.setProperty('--color-border-strong', `rgba(255, 255, 255, 0.18)`);
    document.documentElement.style.colorScheme = 'dark';
  }
}

export function clearCustomTheme() {
  document.documentElement.classList.remove('dark-custom-logo');
  const style = document.documentElement.style;
  const props = [
    '--color-bg', '--color-accent', '--color-accent-hover', '--color-accent-subtle',
    '--color-text-primary', '--color-text-secondary', '--color-text-tertiary',
    '--color-bg-card', '--color-bg-secondary', '--color-bg-tertiary',
    '--color-border', '--color-border-strong',
    '--hero-glow-opacity', '--color-hero-glow-1', '--color-hero-glow-2'
  ];
  props.forEach(p => style.removeProperty(p));
  style.colorScheme = '';
}
