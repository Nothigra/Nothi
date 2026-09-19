import './TestimonialsSection.css';
import { SOFTWARE_LIST } from '../../lib/seed';

export default function TestimonialsSection() {
  return (
    <section className="trust-bar-section section">
      <div className="container">
        <p className="trust-bar-label">Compatible with the tools you already use</p>
        <div className="trust-bar-track">
          <div className="trust-bar-marquee">
            {[...SOFTWARE_LIST, ...SOFTWARE_LIST].map((name, i) => (
              <span key={i} className="trust-bar-item">{name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
