import { useTranslation } from 'react-i18next';
import { badgeSVG, badgeById, RARITIES } from '../../lib/badgeArt';
import './BadgeIcon.css';

/**
 * A Nothi badge (flat enamel-pin style).
 * @param {Object|string} props.badge - catalogue entry or badge id
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} props.size
 * @param {boolean} props.locked - not earned yet (grey)
 * @param {boolean} props.interactive - small lift on hover
 */
export default function BadgeIcon({ badge, size = 'md', locked = false, interactive = false, showTitle = true }) {
  const { t } = useTranslation();
  const b = typeof badge === 'string' ? badgeById(badge) : badge?.id ? badgeById(badge.id) || badge : null;
  if (!b) return null;
  const title = t(`badges.${b.id}.title`, { defaultValue: b.title });
  const rarity = t(`badges.rarity.${b.rarity}`, { defaultValue: RARITIES[b.rarity]?.label });
  return (
    <span
      className={`nb-badge nb-badge-${size} ${interactive ? 'is-interactive' : ''} ${locked ? 'is-locked' : ''}`}
      title={showTitle ? `${title} · ${rarity}` : undefined}
      role="img"
      aria-label={`${title}, ${rarity}${locked ? ' (locked)' : ''}`}
      // static SVG built from constants in lib/badgeArt (no user input)
      dangerouslySetInnerHTML={{ __html: badgeSVG(b, { locked }) }}
    />
  );
}
