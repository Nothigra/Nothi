import { SOFTWARE_LIST } from '../../lib/seed';
import './SoftwareBanner.css';

// Duplicate for seamless loop
const marqueeItems = [...SOFTWARE_LIST, ...SOFTWARE_LIST, ...SOFTWARE_LIST, ...SOFTWARE_LIST];

export default function SoftwareBanner() {
  return (
    <div className="software-banner">
      <div className="software-marquee">
        {marqueeItems.map((name, idx) => (
          <span key={idx} className="marquee-item">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
