import { createBrowserRouter, Outlet, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { lazyPage, preloadPages } from './lib/lazyPage';

// Layouts
import Layout from './components/layout/Layout';
import DashboardLayout from './components/layout/DashboardLayout';

// Main Pages
const HomePage = lazyPage(() => import('./pages/HomePage'));
const MarketplacePage = lazyPage(() => import('./pages/MarketplacePage'));
const ProductPage = lazyPage(() => import('./pages/ProductPage'));
const BestSellersPage = lazyPage(() => import('./pages/BestSellersPage'));
const PricingPage = lazyPage(() => import('./pages/PricingPage'));
const RewardsPage = lazyPage(() => import('./pages/RewardsPage'));
const TermsPage = lazyPage(() => import('./pages/TermsPage'));
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'));
const CreatorProfilePage = lazyPage(() => import('./pages/CreatorProfilePage'));
const ContactPage = lazyPage(() => import('./pages/ContactPage'));
const AboutPage = lazyPage(() => import('./pages/AboutPage'));

// Shopping Pages
const WishlistPage = lazyPage(() => import('./pages/WishlistPage'));
const DownloadsPage = lazyPage(() => import('./pages/DownloadsPage'));
const CheckoutSuccess = lazyPage(() => import('./pages/CheckoutSuccess'));
const CheckoutCancel = lazyPage(() => import('./pages/CheckoutCancel'));

import CookieBanner from './components/common/CookieBanner';
import XPGainPopup from './components/common/XPGainPopup';
import CommandPalette from './components/ui/CommandPalette';

// Auth Pages
const LoginPage = lazyPage(() => import('./pages/LoginPage'));
const OnboardingPage = lazyPage(() => import('./pages/OnboardingPage'));
const VerifyEmailPage = lazyPage(() => import('./pages/VerifyEmailPage'));
const ResetPasswordPage = lazyPage(() => import('./pages/ResetPasswordPage'));

// Dashboard Pages
const DashboardOverview = lazyPage(() => import('./pages/dashboard/DashboardOverview'));
const DashboardProducts = lazyPage(() => import('./pages/dashboard/DashboardProducts'));
const DashboardFollowing = lazyPage(() => import('./pages/dashboard/DashboardFollowing'));
const DashboardAnalytics = lazyPage(() => import('./pages/dashboard/DashboardAnalytics'));
const DashboardPayouts = lazyPage(() => import('./pages/dashboard/DashboardPayouts'));
const DashboardSettings = lazyPage(() => import('./pages/dashboard/DashboardSettings'));
const DashboardPurchases = lazyPage(() => import('./pages/dashboard/DashboardPurchases'));
const UploadProductPage = lazyPage(() => import('./pages/dashboard/UploadProductPage'));
const DashboardBadges = lazyPage(() => import('./pages/dashboard/DashboardBadges'));
const DashboardSubscription = lazyPage(() => import('./pages/dashboard/DashboardSubscription'));

// Community Pages
const MessagesPage = lazyPage(() => import('./pages/MessagesPage'));
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'));

// Fallback
const NotFoundPage = lazyPage(() => import('./pages/NotFoundPage'));

import { useAuth } from './context/AuthContext';

// Mobile app (Capacitor): its own shell + a few app-only screens
import { isNativeApp } from './lib/native';
import AppShell from './components/app/AppShell';
import AppDiscoverPage from './pages/app/AppDiscoverPage';
import AppProfilePage from './pages/app/AppProfilePage';
import AppSearchPage from './pages/app/AppSearchPage';


function AuthCallback() {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (!profile || !profile.onboarding_completed || !profile.username) {
          navigate('/onboarding');
        } else {
          navigate('/marketplace');
        }
      } else {
        navigate('/login');
      }
    }
  }, [user, profile, isLoading, navigate]);

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loader spin"></div>
    </div>
  );
}

// AppRoot renders the Outlet so that context providers in main.jsx can wrap everything.
function AppRoot() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  useEffect(() => { preloadPages(); }, []);
  return (
    <>
      <Outlet />
      {!isNativeApp && <CookieBanner />}
      <XPGainPopup />
      <CommandPalette isOpen={isCommandPaletteOpen} setIsOpen={setIsCommandPaletteOpen} />
    </>
  );
}

const sitePages = [
  { path: "marketplace", element: <MarketplacePage /> },
  { path: "product/:id", element: <ProductPage /> },
  { path: "best-sellers", element: <BestSellersPage /> },
  { path: "pricing", element: <PricingPage /> },
  { path: "rewards", element: <RewardsPage /> },
  { path: "creator/:username", element: <CreatorProfilePage /> },
  { path: "contact", element: <ContactPage /> },
  { path: "about", element: <AboutPage /> },
  { path: "terms", element: <TermsPage /> },
  { path: "privacy", element: <PrivacyPage /> },
  { path: "downloads", element: <DownloadsPage /> },
  { path: "checkout/success", element: <CheckoutSuccess /> },
  { path: "checkout/cancel", element: <CheckoutCancel /> },
  { path: "login", element: <LoginPage /> },
  { path: "onboarding", element: <OnboardingPage /> },
  { path: "auth/callback", element: <AuthCallback /> },
  { path: "auth/verify", element: <VerifyEmailPage /> },
  { path: "auth/reset-password", element: <ResetPasswordPage /> },
  { path: "notifications", element: <NotificationsPage /> },
];

const dashboardPages = [
  { index: true, element: <DashboardOverview /> },
  { path: "products", element: <DashboardProducts /> },
  { path: "following", element: <DashboardFollowing /> },
  { path: "analytics", element: <DashboardAnalytics /> },
  { path: "payouts", element: <DashboardPayouts /> },
  { path: "settings", element: <DashboardSettings /> },
  { path: "purchases", element: <DashboardPurchases /> },
  { path: "upload", element: <UploadProductPage /> },
  { path: "wishlist", element: <WishlistPage /> },
  { path: "badges", element: <DashboardBadges /> },
  { path: "subscription", element: <DashboardSubscription /> },
  { path: "messages", element: <MessagesPage /> },
];

// Website: public layout + dashboard layout.
// App: ONE persistent shell for every screen, so the tab bar and the kept-alive
// tabs never unmount when moving between public pages and account pages.
const layoutRoutes = isNativeApp
  ? [{
      element: <AppShell />,
      children: [
        { index: true, element: <AppDiscoverPage /> },
        { path: "library", element: <DashboardPurchases /> },
        { path: "me", element: <AppProfilePage /> },
        { path: "search", element: <AppSearchPage /> },
        ...sitePages,
        { path: "dashboard", children: dashboardPages },
        { path: "*", element: <NotFoundPage /> },
      ],
    }]
  : [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
          ...sitePages,
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      { path: "dashboard", element: <DashboardLayout />, children: dashboardPages },
    ];

export const router = createBrowserRouter([
  { path: "/", element: <AppRoot />, children: layoutRoutes },
]);

export default AppRoot;
