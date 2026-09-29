import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Crown, Lock, Download, ArrowUpRight, ArrowDownRight, Minus, Rocket, Clock } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { getAdvancedAnalytics, billingErrorMessage } from '../../api/billingApi';
import { getLocalizedString } from '../../utils/i18nHelpers';
import './AdvancedAnalytics.css';
import { isNativeApp } from '../../lib/native';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

function pctChange(current, previous) {
  if (!previous) return current > 0 ? null : 0; // null = "new" (no baseline)
  return ((current - previous) / previous) * 100;
}

function Delta({ current, previous }) {
  const { t } = useTranslation();
  const change = pctChange(current, previous);
  if (change === null) return <span className="aa-delta aa-delta-neutral">{t('billing.aaNew', 'new')}</span>;
  if (Math.abs(change) < 0.5) {
    return <span className="aa-delta aa-delta-neutral"><Minus size={12} /> 0%</span>;
  }
  const up = change > 0;
  return (
    <span className={`aa-delta ${up ? 'aa-delta-up' : 'aa-delta-down'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(change).toFixed(0)}%
    </span>
  );
}

/** Upsell shown to Free sellers — no data is fetched (the RPC would refuse anyway). */
function LockedTeaser() {
  const { t } = useTranslation();
  return (
    <div className="settings-card m-0 aa-locked">
      <div className="aa-locked-preview" aria-hidden="true">
        <div className="aa-fake-row" /><div className="aa-fake-row" /><div className="aa-fake-row" />
        <div className="aa-fake-grid">
          {Array.from({ length: 84 }).map((_, i) => (
            <span key={i} style={{ opacity: 0.15 + ((i * 37) % 10) / 14 }} />
          ))}
        </div>
      </div>
      <div className="aa-locked-overlay">
        <Lock size={22} />
        <h3>{t('billing.aaLockedTitle', 'Advanced analytics')}</h3>
        <p>{t('billing.aaLockedDesc', 'See conversion per product, the best days and hours to post, comparison with the previous period and the real impact of your boosts.')}</p>
        {isNativeApp
          ? <p className="text-secondary text-sm">{t('billing.aaOnWebsite', 'Available with Nothi Pro, on the Nothi website.')}</p>
          : <Link to="/pricing" className="btn btn-primary"><Crown size={16} /> {t('billing.aaUnlock', 'Unlock with Pro')}</Link>}
      </div>
    </div>
  );
}

export default function AdvancedAnalytics({ isPro, rangeDays }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const { formatPrice } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: 'revenue', dir: 'desc' });
  const [hoverCell, setHoverCell] = useState(null);

  useEffect(() => {
    if (!isPro) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdvancedAnalytics(rangeDays)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(billingErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isPro, rangeDays]);

  // Heatmap: server buckets are UTC; shift into the viewer's local time.
  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    const offsetHours = Math.round(-new Date().getTimezoneOffset() / 60);
    (data?.heatmap || []).forEach(({ dow, hour, views }) => {
      let h = hour + offsetHours;
      let d = dow;
      if (h >= 24) { h -= 24; d = (d + 1) % 7; }
      if (h < 0) { h += 24; d = (d + 6) % 7; }
      grid[d][h] += Number(views) || 0;
    });
    let max = 0; let peak = null;
    grid.forEach((row, d) => row.forEach((v, h) => { if (v > max) { max = v; peak = { d, h, v }; } }));
    return { grid, max, peak };
  }, [data]);

  const products = useMemo(() => {
    const rows = (data?.products || []).map((p) => ({
      ...p,
      name: getLocalizedString(p.title, lang) || 'Untitled',
      views: Number(p.views) || 0,
      sales: Number(p.sales) || 0,
      revenue: Number(p.revenue) || 0,
      conversion_rate: Number(p.conversion_rate) || 0,
    }));
    const { key, dir } = sort;
    rows.sort((a, b) => {
      const av = a[key]; const bv = b[key];
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, sort, lang]);

  const boosts = useMemo(() => {
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    const days = data?.range_days || rangeDays;
    return (data?.boosts || []).map((b) => {
      const p = byId[b.product_id];
      const start = new Date(b.starts_at);
      const end = new Date(Math.min(new Date(b.ends_at).getTime(), Date.now()));
      const boostedDays = Math.max((end - start) / 86400000, 1 / 24);
      const duringPerDay = (Number(b.views_during) || 0) / boostedDays;
      const baselinePerDay = p ? Math.max(p.views - (Number(b.views_during) || 0), 0) / Math.max(days - boostedDays, 1) : 0;
      return {
        ...b,
        name: p?.name || '—',
        duringPerDay,
        lift: baselinePerDay > 0 ? ((duringPerDay - baselinePerDay) / baselinePerDay) * 100 : null,
      };
    });
  }, [data, products, rangeDays]);

  if (!isPro) return <LockedTeaser />;

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const exportCsv = () => {
    const header = ['Product', 'Views', 'Sales', 'Conversion %', 'Revenue'];
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [header.join(',')].concat(
      products.map((p) => [esc(p.name), p.views, p.sales, p.conversion_rate, p.revenue].join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nothi-analytics-${rangeDays}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cur = data?.current || { views: 0, sales: 0, revenue: 0 };
  const prev = data?.previous || { views: 0, sales: 0, revenue: 0 };
  const curConv = cur.views > 0 ? (cur.sales / cur.views) * 100 : 0;
  const prevConv = prev.views > 0 ? (prev.sales / prev.views) * 100 : 0;
  const level = (v) => (v === 0 || heat.max === 0 ? 0 : Math.min(4, Math.ceil((v / heat.max) * 4)));
  const sortArrow = (key) => (sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '');

  return (
    <section className="aa-section">
      <div className="aa-section-title">
        <h2><Crown size={18} className="text-accent" /> {t('billing.aaTitle', 'Advanced analytics')}</h2>
        <span className="text-xs text-secondary">{t('billing.aaVsPrevious', 'Compared with the previous {{n}} days', { n: data?.range_days || rangeDays })}</span>
      </div>

      {error && <div className="settings-card m-0 p-lg text-secondary">{error}</div>}
      {loading && !data && <div className="flex items-center justify-center py-2xl"><div className="loader spin" /></div>}

      {data && (
        <>
          {/* Period comparison */}
          <div className="aa-compare-grid">
            {[
              { label: t('billing.aaViews', 'Views'), c: Number(cur.views), p: Number(prev.views), fmt: (v) => v },
              { label: t('billing.aaSales', 'Sales'), c: Number(cur.sales), p: Number(prev.sales), fmt: (v) => v },
              { label: t('billing.aaRevenue', 'Revenue'), c: Number(cur.revenue), p: Number(prev.revenue), fmt: (v) => formatPrice(v) },
              { label: t('billing.aaConversion', 'Conversion'), c: curConv, p: prevConv, fmt: (v) => `${v.toFixed(1)}%` },
            ].map((m) => (
              <div key={m.label} className="premium-stat-card aa-compare">
                <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">{m.label}</p>
                <div className="aa-compare-value">
                  <h3 className="text-2xl font-bold font-display">{m.fmt(m.c)}</h3>
                  <Delta current={m.c} previous={m.p} />
                </div>
                <p className="text-xs text-tertiary">{t('billing.aaBefore', 'Before: {{v}}', { v: m.fmt(m.p) })}</p>
              </div>
            ))}
          </div>

          {/* Per-product funnel */}
          <div className="settings-card m-0">
            <div className="card-header pb-md border-b border-border flex justify-between items-center">
              <h3 className="card-title text-base">{t('billing.aaProductPerf', 'Product performance')}</h3>
              <button className="btn btn-outline btn-sm flex items-center gap-xs" onClick={exportCsv} disabled={!products.length}>
                <Download size={14} /> CSV
              </button>
            </div>
            {products.length ? (
              <div className="table-responsive">
                <table className="dashboard-table aa-table">
                  <thead>
                    <tr>
                      <th><button onClick={() => toggleSort('name')}>{t('billing.aaProduct', 'Product')}{sortArrow('name')}</button></th>
                      <th className="num"><button onClick={() => toggleSort('views')}>{t('billing.aaViews', 'Views')}{sortArrow('views')}</button></th>
                      <th className="num"><button onClick={() => toggleSort('sales')}>{t('billing.aaSales', 'Sales')}{sortArrow('sales')}</button></th>
                      <th className="num"><button onClick={() => toggleSort('conversion_rate')}>{t('billing.aaConversion', 'Conversion')}{sortArrow('conversion_rate')}</button></th>
                      <th className="num"><button onClick={() => toggleSort('revenue')}>{t('billing.aaRevenue', 'Revenue')}{sortArrow('revenue')}</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="aa-product-name">{p.name}</span>
                          {p.is_boosted && <span className="aa-chip"><Rocket size={10} /> {t('billing.aaBoosted', 'Boosted')}</span>}
                        </td>
                        <td className="num">{p.views}</td>
                        <td className="num">{p.sales}</td>
                        <td className="num">{p.conversion_rate.toFixed(1)}%</td>
                        <td className="num">{formatPrice(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-body text-center text-secondary text-sm py-xl">{t('billing.aaNoProducts', 'No products yet.')}</div>
            )}
          </div>

          {/* Best time heatmap */}
          <div className="settings-card m-0">
            <div className="card-header pb-md border-b border-border">
              <h3 className="card-title text-base flex items-center gap-sm"><Clock size={16} /> {t('billing.aaBestTimes', 'When buyers look at your products')}</h3>
            </div>
            <div className="card-body">
              {heat.max === 0 ? (
                <p className="text-secondary text-sm text-center py-lg">{t('billing.aaNoViews', 'No views recorded for this period yet.')}</p>
              ) : (
                <>
                  <p className="text-sm mb-md">
                    {t('billing.aaPeak', 'Peak: {{day}} around {{hour}}:00 ({{views}} views). Publish or boost just before.', {
                      day: DAY_NAMES[heat.peak.d], hour: String(heat.peak.h).padStart(2, '0'), views: heat.peak.v,
                    })}
                  </p>
                  <div className="aa-heatmap" role="table" aria-label={t('billing.aaBestTimes', 'When buyers look at your products')}>
                    {DISPLAY_ORDER.map((d) => (
                      <div key={d} className="aa-heat-row" role="row">
                        <span className="aa-heat-day" role="rowheader">{DAY_NAMES[d]}</span>
                        {heat.grid[d].map((v, h) => (
                          <span
                            key={h}
                            role="cell"
                            className={`aa-heat-cell aa-level-${level(v)}`}
                            aria-label={`${DAY_NAMES[d]} ${h}:00 — ${v} views`}
                            onMouseEnter={() => setHoverCell({ d, h, v })}
                            onMouseLeave={() => setHoverCell(null)}
                          />
                        ))}
                      </div>
                    ))}
                    <div className="aa-heat-row aa-heat-axis" aria-hidden="true">
                      <span className="aa-heat-day" />
                      {Array.from({ length: 24 }).map((_, h) => (
                        <span key={h} className="aa-heat-hour">{h % 6 === 0 ? `${h}h` : ''}</span>
                      ))}
                    </div>
                  </div>
                  <div className="aa-heat-footer">
                    <span className="text-xs text-secondary" aria-live="polite">
                      {hoverCell ? `${DAY_NAMES[hoverCell.d]} ${String(hoverCell.h).padStart(2, '0')}:00 — ${hoverCell.v} ${t('billing.aaViewsLower', 'views')}` : ' '}
                    </span>
                    <span className="aa-heat-legend text-xs text-secondary">
                      {t('billing.aaLess', 'Less')}
                      {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`aa-heat-cell aa-level-${l}`} />)}
                      {t('billing.aaMore', 'More')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Boost impact */}
          <div className="settings-card m-0">
            <div className="card-header pb-md border-b border-border">
              <h3 className="card-title text-base flex items-center gap-sm"><Rocket size={16} /> {t('billing.aaBoostImpact', 'Boost impact')}</h3>
            </div>
            {boosts.length ? (
              <div className="card-body p-0">
                {boosts.map((b, i) => (
                  <div key={i} className="aa-boost-row">
                    <div>
                      <div className="font-medium text-sm">{b.name}</div>
                      <div className="text-xs text-tertiary">
                        {new Date(b.starts_at).toLocaleDateString(i18n.language)} · {b.duration_days === 1 ? '24h' : `${b.duration_days}d`} · {b.source === 'subscription' ? 'Pro' : t('billing.aaPaid', 'paid')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{b.duringPerDay.toFixed(1)} {t('billing.aaViewsPerDay', 'views/day')}</div>
                      {b.lift !== null && (
                        <div className={`text-xs ${b.lift >= 0 ? 'text-success' : 'text-secondary'}`}>
                          {b.lift >= 0 ? '+' : ''}{b.lift.toFixed(0)}% {t('billing.aaVsUsual', 'vs usual')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-body text-center text-secondary text-sm py-xl">
                {t('billing.aaNoBoosts', 'No boosts in this period. Boost a product to measure its effect here.')}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
