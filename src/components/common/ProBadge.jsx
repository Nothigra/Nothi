import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './ProBadge.css';

/**
 * Verified-style "Nothi Pro" badge.
 *
 *   <ProBadge />                      inline, next to a name
 *   <ProBadge variant="avatar" />     pinned to the bottom-right of an avatar
 *                                     (parent must be position: relative)
 *
 * Only render it when the data says so (public_profiles.is_pro /
 * public_products.creator_is_pro), which already respects the member's
 * "show Pro badge" setting.
 */
export default function ProBadge({ variant = 'inline', size }) {
  const { t } = useTranslation();
  const label = t('billing.proBadgeTitle', 'Nothi Pro member');
  const iconSize = size ?? (variant === 'avatar' ? 22 : 18);

  return (
    <span
      className={`pro-badge-verified pro-badge-${variant}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <BadgeCheck size={iconSize} strokeWidth={2.4} aria-hidden="true" />
    </span>
  );
}
