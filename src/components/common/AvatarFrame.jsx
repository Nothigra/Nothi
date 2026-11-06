import { useTranslation } from 'react-i18next';
import { ringSVG, gradeFor, levelProgress } from '../../lib/badgeArt';
import BadgeIcon from './BadgeIcon';
import './AvatarFrame.css';

const SIZES = { xs: 24, sm: 32, md: 48, lg: 96, xl: 144 };

/**
 * Profile picture with its grade ring.
 * The ring comes from the XP level (Rookie → Diamond); without a level the
 * picture is shown plain. On large sizes the pinned badges sit on the ring.
 *
 * @param {number} props.level - XP level (optional)
 * @param {number} props.xp - total XP, draws the progress to the next level (optional)
 * @param {string[]} props.badges - up to 3 pinned badge ids shown on the ring (lg/xl)
 * @param {boolean} props.showLevel - level plate under the ring (lg/xl)
 */
export default function AvatarFrame({
  level, xp, imageUrl, size = 'md', fallbackLetter, name, badges = [], showLevel = false, animatePulse = false,
}) {
  const { t } = useTranslation();
  const px = SIZES[size] || SIZES.md;
  const hasRing = Number.isFinite(level) && level > 0;
  const grade = hasRing ? gradeFor(level) : null;
  const big = size === 'lg' || size === 'xl';
  const letter = (fallbackLetter || name || '?').charAt(0).toUpperCase();
  const ringBox = Math.round(px / 0.78);
  const pinned = big && hasRing ? (badges || []).slice(0, 3) : [];
  const pinSize = size === 'xl' ? 'md' : 'sm';

  return (
    <span
      className={`nb-avatar nb-avatar-${size} ${hasRing ? `grade-${grade.id}` : ''} ${animatePulse ? 'is-new' : ''}`}
      style={{ width: px, height: px }}
      title={hasRing ? `${t(`grades.${grade.id}`, { defaultValue: grade.label })} · ${t('grades.level', { defaultValue: 'Level' })} ${level}` : undefined}
    >
      {imageUrl
        ? <img src={imageUrl} alt="" className="nb-avatar-img" loading="lazy" decoding="async" />
        : <span className="nb-avatar-img nb-avatar-letter" aria-hidden="true">{letter}</span>}
      {hasRing && (
        <span
          className="nb-avatar-ring"
          style={{ width: ringBox, height: ringBox, left: (px - ringBox) / 2, top: (px - ringBox) / 2 }}
          // static SVG from lib/badgeArt (numbers only)
          dangerouslySetInnerHTML={{ __html: ringSVG(level, big && Number.isFinite(xp) ? levelProgress(xp, level) : 0) }}
        />
      )}
      {pinned.map((id, i) => {
        // upper-left arc: clear of the name (right), the Pro tick (bottom-right) and the level plate (bottom)
        const a = ((-158 + i * 32) * Math.PI) / 180;
        const r = ringBox / 2 - 2;
        return (
          <span key={id} className="nb-avatar-pin" style={{ left: px / 2 + r * Math.cos(a), top: px / 2 + r * Math.sin(a) }}>
            <BadgeIcon badge={id} size={pinSize} />
          </span>
        );
      })}
      {big && hasRing && showLevel && (
        <span className={`nb-avatar-level grade-${grade.id}`}>{t('grades.lv', { defaultValue: 'Lv' })} {level}</span>
      )}
    </span>
  );
}
