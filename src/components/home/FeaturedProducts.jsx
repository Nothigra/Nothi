import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import ProductCard from '../product/ProductCard';
import { supabase, isMockMode } from '../../lib/supabase';
import { MOCK_PRODUCTS } from '../../lib/seed';
import './FeaturedProducts.css';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
};

/**
 * A row of real products on the home page.
 *   sort: 'popular' (popular_rank) | 'new' (most recent)
 */
export default function FeaturedProducts({ sort = 'popular', title, description, compact = false }) {
  const { t } = useTranslation();
  const [popularProducts, setPopularProducts] = useState([]);
  
  useEffect(() => {
    if (isMockMode) {
      const sorted = [...MOCK_PRODUCTS].sort((a, b) => sort === 'new'
        ? new Date(b.created_at || 0) - new Date(a.created_at || 0) || String(b.id).localeCompare(String(a.id))
        : (b.sales_count || 0) - (a.sales_count || 0)).slice(0, 4);
      setPopularProducts(sorted);
      return;
    }
    let alive = true;
    const query = supabase.from('public_products').select('*');
    (sort === 'new' ? query.order('created_at', { ascending: false }) : query.order('popular_rank', { ascending: true }))
      .limit(4)
      .then(({ data }) => { if (alive && data) setPopularProducts(data); })
      .catch(console.error);
    return () => { alive = false; };
  }, [sort]);

  // Nothing to show yet: no empty heading on the page
  if (popularProducts.length === 0) return null;

  return (
      <section className={`featured-products section ${compact ? 'featured-compact' : ''}`}>
        <div className="container">
          <div className="featured-header">
            <div className="section-title-wrapper">
              <h2 className="featured-title">{title || t('sections.mostPopular', 'Most Popular')}</h2>
              <p className="section-desc">{description || t('sections.mostPopularDesc', 'What editors are getting right now.')}</p>
            </div>
            <Link to={sort === 'new' ? '/marketplace' : '/marketplace'} className="view-all-link">
              {t('sections.viewAll')} →
            </Link>
          </div>
  
          <motion.div 
            className="product-grid products-grid-view"
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.05 }}
          >
            {popularProducts.map(product => (
              <motion.div key={product.id} variants={itemVariants}>
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
  );
}
