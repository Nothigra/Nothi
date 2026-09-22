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
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

export default function FeaturedProducts() {
  const { t } = useTranslation();
  const [popularProducts, setPopularProducts] = useState([]);
  
  useEffect(() => {
    if (isMockMode) {
      // Mirror real popular_rank ordering using mock sales_count, top 4
      const sorted = [...MOCK_PRODUCTS].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0)).slice(0, 4);
      setPopularProducts(sorted);
      return;
    }
    supabase.from('public_products')
      .select('*')
      .order('popular_rank', { ascending: true }) // Rank 1 is best
      .limit(4)
      .then(({ data }) => {
        if (data) setPopularProducts(data);
      })
      .catch(console.error);
  }, []);

  return (
      <section className="featured-products section">
        <div className="container">
          <div className="section-header" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto var(--space-12) auto' }}>
            <h2>{t('sections.mostPopular', 'Most Popular')}</h2>
            <p className="text-muted">{t('sections.mostPopularDesc', 'Discover our best-selling assets loved by creators.')}</p>
          </div>
  
          {popularProducts.length > 0 && (
            <motion.div 
              className="product-grid"
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
            >
              {popularProducts.map(product => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-12)' }}>
            <Link to="/marketplace" className="btn btn-outline">
              {t('sections.viewAll')} →
            </Link>
          </div>
        </div>
      </section>
  );
}
