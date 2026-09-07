import { useState, useEffect } from 'react';
import { Outlet, useLocation, useOutlet } from 'react-router';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from '../cart/CartDrawer';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Freezes the current outlet during exit animations so the OLD page
 * content fades out (not the new page).
 * Captures the first non-null outlet and keeps it frozen, which handles
 * both same-layout transitions (frozen exit) and cross-layout mounts (initial null).
 */
const AnimatedOutlet = () => {
  const currentOutlet = useOutlet();
  const [frozenOutlet, setFrozenOutlet] = useState(currentOutlet);

  useEffect(() => {
    if (currentOutlet && !frozenOutlet) {
      setFrozenOutlet(currentOutlet);
    }
  }, [currentOutlet, frozenOutlet]);

  return <>{frozenOutlet || currentOutlet}</>;
};

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '80vh' }}>
        <AnimatePresence 
          mode="wait"
          onExitComplete={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
        >
          <motion.div
            key={pathname}
            initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            exit={{ opacity: 0, filter: 'blur(10px)', y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <AnimatedOutlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
