import { supabase, withTimeoutSafety } from '../lib/supabase';

const RANGE_TO_DAYS = {
  'Today': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
  'All': 3650,
};

/**
 * Real seller analytics: views/sources/devices from analytics_events (via
 * the seller_daily_views rollup), and revenue/orders from real purchases.
 * Returns honest zeros/empty arrays if the seller has no data yet — never
 * fabricated numbers.
 */
export async function getSellerAnalytics(sellerId, range = '30d') {
  const days = RANGE_TO_DAYS[range] ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  const [viewsResult, purchasesResult, productsResult] = await Promise.all([
    withTimeoutSafety(() =>
      supabase
        .from('seller_daily_views')
        .select('*')
        .eq('seller_id', sellerId)
        .gte('day', sinceISO)
        .order('day', { ascending: true })
    ),
    withTimeoutSafety(() =>
      supabase
        .from('purchases')
        .select('id, price_paid, purchased_at, product_id, product:products(title)')
        .eq('seller_id', sellerId)
        .eq('status', 'completed')
        .gte('purchased_at', sinceISO)
        .order('purchased_at', { ascending: true })
    ),
    withTimeoutSafety(() =>
      supabase
        .from('products')
        .select('id, title, views')
        .eq('seller_id', sellerId)
    ),
  ]);

  const dailyViews = viewsResult?.data || [];
  const purchases = purchasesResult?.data || [];
  const products = productsResult?.data || [];

  const totalViews = dailyViews.reduce((sum, d) => sum + (d.views || 0), 0);
  const totalRevenue = purchases.reduce((sum, p) => sum + (p.price_paid || 0), 0);
  const totalOrders = purchases.length;
  const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

  const sourceTotals = dailyViews.reduce((acc, d) => {
    acc.direct += d.direct_views || 0;
    acc.google += d.google_views || 0;
    acc.social += d.social_views || 0;
    acc.other += d.other_views || 0;
    return acc;
  }, { direct: 0, google: 0, social: 0, other: 0 });

  const deviceTotals = dailyViews.reduce((acc, d) => {
    acc.mobile += d.mobile_views || 0;
    acc.desktop += d.desktop_views || 0;
    acc.tablet += d.tablet_views || 0;
    return acc;
  }, { mobile: 0, desktop: 0, tablet: 0 });

  // Revenue grouped by day, for the chart
  const revenueByDay = {};
  purchases.forEach(p => {
    const day = p.purchased_at.slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] || 0) + (p.price_paid || 0);
  });
  const revenueChart = Object.entries(revenueByDay).map(([day, revenue]) => ({ day, revenue }));

  // Top products by revenue
  const revenueByProduct = {};
  purchases.forEach(p => {
    const title = p.product?.title || 'Unknown product';
    revenueByProduct[title] = (revenueByProduct[title] || 0) + (p.price_paid || 0);
  });
  const topProducts = Object.entries(revenueByProduct)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    totalViews,
    totalRevenue,
    totalOrders,
    conversionRate,
    sourceTotals,
    deviceTotals,
    revenueChart,
    topProducts,
    hasAnyData: totalViews > 0 || totalOrders > 0,
  };
}
