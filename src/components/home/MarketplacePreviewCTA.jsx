import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import './MarketplacePreviewCTA.css';

export default function MarketplacePreviewCTA() {
  return (
    <section className="marketplace-cta-section section">
      <div className="container">
        <motion.div 
          className="cta-card glass-card"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="cta-content">
            <h2>Ready to elevate your edits?</h2>
            <p>Join thousands of creators using premium assets to speed up their workflow and produce better videos.</p>
            <div className="cta-actions">
              <Link to="/marketplace" className="btn btn-primary btn-lg btn-pill cta-btn">
                Explore Marketplace <ArrowRight size={20} />
              </Link>
              <Link to="/login" className="btn btn-outline btn-lg btn-pill cta-btn">
                Start Selling
              </Link>
            </div>
          </div>
          
          <div className="cta-background-effects">
            <div className="cta-glow"></div>
            <div className="cta-grid"></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
