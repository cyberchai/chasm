// App.tsx — Composes named components in content.sections order.
// Codegen depends on these component names being stable.

import { useEffect } from 'react';
import { content } from './content';
import { applyTheme } from './theme';

import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Gallery from './components/Gallery';
import Products from './components/Products';
import About from './components/About';
import Contact from './components/Contact';
import OrderButton from './components/OrderButton';
import Footer from './components/Footer';

/** Maps section keys (from content.sections) to their React components */
const SECTION_MAP: Record<string, React.FC> = {
  hero: Hero,
  gallery: Gallery,
  products: Products,
  about: About,
  contact: Contact,
  order: OrderButton,
};

/** Intersection Observer for scroll-triggered reveals */
function useRevealOnScroll() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    // Observe initial and late-rendered elements
    const observe = () => {
      document.querySelectorAll('.reveal:not(.visible)').forEach((el) => observer.observe(el));
    };

    observe();
    // Re-observe after images load (may cause layout shifts)
    window.addEventListener('load', observe);

    return () => {
      observer.disconnect();
      window.removeEventListener('load', observe);
    };
  }, []);
}

export default function App() {
  useEffect(() => {
    applyTheme();
  }, []);

  useRevealOnScroll();

  const sections = content.sections ?? ['hero', 'products', 'about', 'contact', 'order'];

  return (
    <div className="min-h-screen bg-brand-surface text-brand-text">
      <Navbar />
      {sections.map((key) => {
        const Component = SECTION_MAP[key];
        if (!Component) return null;
        return <Component key={key} />;
      })}
      <Footer />
    </div>
  );
}
