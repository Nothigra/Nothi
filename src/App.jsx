import { createBrowserRouter, Outlet, useLocation, useNavigate } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

// Layouts
import Layout from './components/layout/Layout';
import DashboardLayout from './components/layout/DashboardLayout';

// Main Pages
import HomePage from './pages/HomePage';
import MarketplacePage from './pages/MarketplacePage';
import ProductPage from './pages/ProductPage';
import BestSellersPage from './pages/BestSellersPage';
import PricingPage from './pages/PricingPage';
import RewardsPage from './pages/RewardsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import CreatorProfilePage from './pages/CreatorProfilePage';
import ContactPage from './pages/ContactPage';
import AboutPage from './pages/AboutPage';

// Shopping Pages
import WishlistPage from './pages/WishlistPage';
import DownloadsPage from './pages/DownloadsPage';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';

import CookieBanner from './components/common/CookieBanner';
import XPGainPopup from './components/common/XPGainPopup';

// Auth Pages
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Dashboard Pages
import DashboardOverview from './pages/dashboard/DashboardOverview';
import DashboardProducts from './pages/dashboard/DashboardProducts';
import DashboardFollowing from './pages/dashboard/DashboardFollowing';
import DashboardAnalytics from './pages/dashboard/DashboardAnalytics';
import DashboardPayouts from './pages/dashboard/DashboardPayouts';
import DashboardSettings from './pages/dashboard/DashboardSettings';
import DashboardPurchases from './pages/dashboard/DashboardPurchases';
import UploadProductPage from './pages/dashboard/UploadProductPage';
import DashboardBadges from './pages/dashboard/DashboardBadges';

// Community Pages
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';

// Fallback
import NotFoundPage from './pages/NotFoundPage';

import { useAuth } from './context/AuthContext';

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
  return (
    <>
      <Outlet />
      <CookieBanner />
      <XPGainPopup />
    </>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppRoot />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
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
          { path: "*", element: <NotFoundPage /> },
        ]
      },
      {
        path: "dashboard",
        element: <DashboardLayout />,
        children: [
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
          { path: "messages", element: <MessagesPage /> },
        ]
      }
    ]
  }
]);

export default AppRoot;
