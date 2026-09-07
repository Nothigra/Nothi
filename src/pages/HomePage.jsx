import Hero from '../components/home/Hero';
import Categories from '../components/home/Categories';
import FeaturedProducts from '../components/home/FeaturedProducts';
import TestimonialsSection from '../components/home/TestimonialsSection';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <Hero />
      <Categories />
      <FeaturedProducts />
      <TestimonialsSection />
    </div>
  );
}
