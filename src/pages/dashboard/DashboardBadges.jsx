import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, PinOff } from 'lucide-react';
import { useGamification } from '../../context/GamificationContext';
import { useAuth } from '../../context/AuthContext';
import BadgeIcon from '../../components/common/BadgeIcon';
import AvatarFrame from '../../components/common/AvatarFrame';
import { BADGES, RARITIES, GRADES, gradeFor, nextGrade, xpForLevel, levelProgress } from '../../lib/badgeArt';
import './DashboardBadges.css';

const MAX_PINNED = 3;
const ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export default function DashboardBadges() {
  const { t } = useTranslation();
  const { gamificationState, markBadgesSeen } = useGamification();
  const { profile, updateProfile } = useAuth();
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => { markBadgesSeen(); }, [markBadgesSeen]);

  const unlocked = useMemo(() => new Set(gamificationState?.unlockedBadges || []), [gamificationState]);
  if (!gamificationState) {
    return <div className="flex-center h-full min-h-[400px]"><div className="loader spin"></div></div>;
  }

  const level = gamificationState.level || 1;
  const xp = gamificationState.xp || 0;
  const grade = gradeFor(level);
  const next = nextGrade(level);
  const pinned = (profile?.shop_settings?.displayed_badges?.length ? profile.shop_settings.displayed_badges : gamificationState.displayedBadges || [])
    .filter((id) => unlocked.has(id));

  const togglePin = async (id) => {
    setNotice('');
    let list;
    if (pinned.includes(id)) list = pinned.filter((x) => x !== id);
    else if (pinned.length >= MAX_PINNED) { setNotice(t('badges.ui.maxPinned', { defaultValue: 'You can pin up to 3 badges. Unpin one first.' })); return; }
    else list = [...pinned, id];
    setBusy(id);
    try {
      // the shop reads shop_settings.displayed_badges; the profile column is kept in sync
      await updateProfile({ displayed_badges: list, shop_settings: { ...(profile?.shop_settings || {}), displayed_badges: list } });
    } finally {
      setBusy(null);
    }
  };

  const title = (b) => t(`badges.${b.id}.title`, { defaultValue: b.title });
  const desc = (b) => t(`badges.${b.id}.desc`, { defaultValue: b.desc });

  return (
    <div className="nb-badges-page pb-3xl">
      <header className="nb-badges-head">
        <div>
          <h1 className="dashboard-title">{t('badges.ui.title', { defaultValue: 'Grade & badges' })}</h1>
          <p className="dashboard-subtitle">{t('badges.ui.subtitle', { defaultValue: 'Your grade grows with XP. Badges are earned with specific actions — pin up to 3 on your shop.' })}</p>
        </div>
        <div className="nb-badges-count"><b>{unlocked.size}</b> / {BADGES.length} {t('badges.ui.earned', { defaultValue: 'earned' })}</div>
      </header>

      <section className="nb-grade-card">
        <AvatarFrame level={level} xp={xp} badges={pinned} showLevel imageUrl={profile?.avatar_url || profile?.shop_settings?.profile_image_url} name={profile?.username} size="lg" />
        <div className="nb-grade-info">
          <div className="nb-grade-name">{t(`grades.${grade.id}`, { defaultValue: grade.label })} · {t('grades.level', { defaultValue: 'Level' })} {level}</div>
          <div className="nb-grade-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(levelProgress(xp, level) * 100)}>
            <i style={{ width: `${Math.round(levelProgress(xp, level) * 100)}%` }} />
          </div>
          <div className="nb-grade-sub">
            {xp.toLocaleString(document.documentElement.lang || 'en')} XP · {Math.max(0, xpForLevel(level + 1) - xp).toLocaleString(document.documentElement.lang || 'en')} XP {t('grades.toNextLevel', { defaultValue: 'to level' })} {level + 1}
            {next && <> · {t(`grades.${next.id}`, { defaultValue: next.label })} {t('grades.atLevel', { defaultValue: 'at level' })} {next.level}</>}
          </div>
          <ol className="nb-grade-ladder" aria-label={t('badges.ui.grades', { defaultValue: 'Grades' })}>
            {GRADES.map((g) => (
              <li key={g.id} className={level >= g.level ? 'is-on' : ''}>
                <span className={`nb-grade-dot grade-${g.id}`} />
                {t(`grades.${g.id}`, { defaultValue: g.label })}<small>{g.level}</small>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {notice && <p className="nb-badges-notice" role="status">{notice}</p>}

      {ORDER.map((rk) => {
        const list = BADGES.filter((b) => b.rarity === rk);
        const got = list.filter((b) => unlocked.has(b.id)).length;
        return (
          <section key={rk} className="nb-rarity">
            <h2 className="nb-rarity-head">
              <i style={{ background: RARITIES[rk].swatch }} />
              {t(`badges.rarity.${rk}`, { defaultValue: RARITIES[rk].label })}
              <span>{got}/{list.length}</span>
            </h2>
            <div className="nb-badge-grid">
              {list.map((b) => {
                const on = unlocked.has(b.id);
                const isPinned = pinned.includes(b.id);
                return (
                  <div key={b.id} className={`nb-badge-tile ${on ? '' : 'is-locked'}`}>
                    <BadgeIcon badge={b} locked={!on} size="xl" showTitle={false} />
                    <div className="nb-badge-text">
                      <b>{title(b)}</b>
                      <small>{desc(b)}</small>
                    </div>
                    {on ? (
                      <button type="button" className={`nb-pin-btn ${isPinned ? 'is-on' : ''}`} disabled={busy === b.id} onClick={() => togglePin(b.id)}>
                        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                        {isPinned ? t('badges.ui.unpin', { defaultValue: 'Unpin' }) : t('badges.ui.pin', { defaultValue: 'Pin to shop' })}
                      </button>
                    ) : (
                      <span className="nb-badge-locked">{t('badges.ui.locked', { defaultValue: 'Not earned yet' })}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
