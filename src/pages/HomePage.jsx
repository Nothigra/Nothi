import Hero from '../components/home/Hero';
import Categories from '../components/home/Categories';
import FeaturedProducts from '../components/home/FeaturedProducts';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <Hero />
      {/* Products first: a marketplace should show what it sells on the first screen */}
      <FeaturedProducts sort="popular" compact />
      <Categories />
      <FeaturedProducts sort="new" title="New arrivals" description="Freshly published by creators." />
    </div>
  );
}
