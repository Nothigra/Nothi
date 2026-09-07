import { useTranslation } from 'react-i18next';
import './TrustedBrands.css';

const brands = [
  'Adobe', 'Final Cut Pro', 'DaVinci Resolve', 'After Effects', 
  'Premiere Pro', 'Cinema 4D', 'Blender', 'Nuke',
  'Adobe', 'Final Cut Pro', 'DaVinci Resolve', 'After Effects', 
  'Premiere Pro', 'Cinema 4D', 'Blender', 'Nuke' // Duplicated for seamless loop
];

export default function TrustedBrands() {
  const { t } = useTranslation();

  return (
    <section className="trusted-brands">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto var(--space-12) auto' }}>
          <h2>{t('sections.trustedBrands', 'Trusted by Professionals')}</h2>
          <p className="text-muted">{t('sections.trustedBrandsDesc', 'Leading creators and studios use Nothi for their daily workflow.')}</p>
        </div>
        
        <div className="marquee-container">
          <div className="marquee-content">
            {brands.map((brand, index) => (
              <span key={index} className="brand-item">{brand}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
