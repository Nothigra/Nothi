import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command } from 'lucide-react';
import { useNavigate } from 'react-router';
import './CommandPalette.css';

export default function CommandPalette({ isOpen, setIsOpen }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  const links = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Products', path: '/dashboard/products' },
    { name: 'Orders', path: '/dashboard/orders' },
    { name: 'Customers', path: '/dashboard/customers' },
    { name: 'Analytics', path: '/dashboard/analytics' },
    { name: 'Followers', path: '/dashboard/followers' },
    { name: 'Messages', path: '/dashboard/messages' },
    { name: 'Reviews', path: '/dashboard/reviews' },
    { name: 'Rewards', path: '/dashboard/rewards' },
    { name: 'Best Sellers', path: '/dashboard/best-sellers' },
    { name: 'Withdrawals', path: '/dashboard/withdrawals' },
    { name: 'Store', path: '/dashboard/store' },
    { name: 'Settings', path: '/dashboard/settings' },
  ];

  const filteredLinks = links.filter((link) =>
    link.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="command-overlay" onClick={() => setIsOpen(false)}>
          <motion.div
            className="command-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="command-input-container">
              <Search className="command-search-icon" size={20} />
              <input
                type="text"
                autoFocus
                placeholder="Type a command or search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="command-input"
              />
              <div className="command-badge">
                <Command size={14} /> K
              </div>
            </div>

            <div className="command-results">
              {filteredLinks.length > 0 ? (
                filteredLinks.map((link) => (
                  <button
                    key={link.path}
                    className="command-result-item"
                    onClick={() => handleSelect(link.path)}
                  >
                    {link.name}
                  </button>
                ))
              ) : (
                <div className="command-no-results">No results found.</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
