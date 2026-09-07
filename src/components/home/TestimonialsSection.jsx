import './TestimonialsSection.css';
import { Star } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    name: "Alex Rivera",
    role: "Freelance Video Editor",
    image: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    rating: 5,
    text: "Nothi completely changed my workflow. The motion presets I bought here saved me hours on every project. Highly recommend to any serious editor."
  },
  {
    id: 2,
    name: "Sarah Chen",
    role: "YouTube Creator",
    image: "https://i.pravatar.cc/150?u=a04258a2462d826712d",
    rating: 5,
    text: "I started selling my own LUT packs on Nothi last month and the experience has been incredibly smooth. The platform is premium and the audience is top tier."
  },
  {
    id: 3,
    name: "Marcus Johnson",
    role: "Commercial Director",
    image: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    rating: 5,
    text: "The quality of assets on this marketplace is unmatched. It's like having a dedicated motion graphics team at my fingertips. Clean, fast, and reliable."
  }
];

export default function TestimonialsSection() {
  return (
    <section className="testimonials-section section">
      <div className="container">
        <div className="section-header-inline" style={{ display: 'flex', alignItems: 'baseline', gap: '24px', marginBottom: '48px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>Trusted by Professionals</h2>
          <p style={{ margin: 0, fontSize: '15px', color: 'var(--color-text-secondary)' }}>Join thousands of editors who buy and sell premium assets every day.</p>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="testimonial-card">
              <div className="testimonial-header">
                <img src={testimonial.image} alt={testimonial.name} className="testimonial-avatar" />
                <div className="testimonial-meta">
                  <h4>{testimonial.name}</h4>
                  <span>{testimonial.role}</span>
                </div>
              </div>
              <div className="testimonial-stars">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="testimonial-text">"{testimonial.text}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
