import { Globe } from 'lucide-react';
import { platformById } from '../../lib/socialLinks';

/** Monochrome brand mark (uses currentColor, so it follows the theme). */
export default function SocialIcon({ platform, size = 18 }) {
  const p = platformById(platform);
  if (!p.icon) return <Globe size={size} aria-hidden="true" />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={p.icon.path} />
    </svg>
  );
}
