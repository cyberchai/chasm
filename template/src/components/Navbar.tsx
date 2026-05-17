// Navbar.tsx — Sticky translucent navigation bar
// Named component — codegen edits by name. Keep name stable.

import { useState, useEffect } from 'react';
import { content } from '../content';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const primaryColor = content.colors?.[0] ?? '#2d5016';
  const secondaryColor = content.colors?.[1] ?? '#f5f0e1';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Collection', href: '#products' },
    { label: 'Our Story', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(14,14,14,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#hero" className="flex items-center gap-3 group">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${primaryColor}40` }}
          >
            <span className="font-display font-bold text-sm" style={{ color: secondaryColor }}>
              {(content.name || 'B')[0]}
            </span>
          </div>
          <span
            className="font-display font-semibold text-lg hidden sm:block"
            style={{ color: secondaryColor }}
          >
            {content.name}
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium tracking-wide transition-all duration-300 hover:opacity-100 opacity-70"
              style={{ color: secondaryColor }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#order"
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: primaryColor,
              color: secondaryColor,
            }}
          >
            Order Now
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg transition-colors duration-200"
          style={{ color: secondaryColor }}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden px-6 pb-6 animate-fade-in"
          style={{
            background: 'rgba(14,14,14,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-lg font-medium transition-opacity duration-200 hover:opacity-100 opacity-70"
              style={{ color: secondaryColor }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#order"
            onClick={() => setMobileOpen(false)}
            className="block mt-4 text-center px-5 py-3 rounded-lg text-lg font-semibold"
            style={{
              backgroundColor: primaryColor,
              color: secondaryColor,
            }}
          >
            Order Now
          </a>
        </div>
      )}
    </nav>
  );
}
