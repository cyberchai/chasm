// Hero.tsx — Full-viewport hero section with photo background
// Named component — codegen edits by name. Keep name stable.

import { content } from '../content';

export default function Hero() {
  const { name, tagline, colors, heroImage } = content;
  const primaryColor = colors?.[0] ?? '#2d5016';
  const secondaryColor = colors?.[1] ?? '#f5f0e1';

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background photo */}
      {heroImage && (
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={`${name} shop`}
            className="w-full h-full object-cover"
            style={{ objectPosition: '50% 30%' }}
          />
          {/* Dark overlay for text legibility */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.6) 100%),
                linear-gradient(135deg, ${primaryColor}40 0%, transparent 60%)
              `,
            }}
          />
        </div>
      )}

      {/* Fallback gradient (no photo) */}
      {!heroImage && (
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 20% 50%, ${primaryColor}33 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, ${primaryColor}22 0%, transparent 50%),
              var(--color-surface)
            `,
          }}
        />
      )}

      {/* Floating decorative orbs */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-float opacity-[0.06]"
        style={{
          background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
          top: '10%',
          left: '-10%',
        }}
      />
      <div
        className="absolute w-[300px] h-[300px] rounded-full animate-float opacity-[0.04]"
        style={{
          background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
          bottom: '15%',
          right: '-5%',
          animationDelay: '3s',
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Business type pill */}
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8 animate-fade-in"
          style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: primaryColor }}
          />
          <span className="text-sm font-medium tracking-wider uppercase" style={{ color: secondaryColor }}>
            {content.type || 'Local Business'}
          </span>
        </div>

        {/* Business name */}
        <h1
          className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-fade-in-up"
          style={{ animationDelay: '0.1s', color: '#fff', textShadow: '0 2px 40px rgba(0,0,0,0.3)' }}
        >
          {name || 'Your Business'}
        </h1>

        {/* Decorative divider */}
        <div className="flex items-center justify-center gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="w-12 h-px" style={{ backgroundColor: `${secondaryColor}60` }} />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          <div className="w-12 h-px" style={{ backgroundColor: `${secondaryColor}60` }} />
        </div>

        {/* Tagline */}
        <p
          className="text-xl sm:text-2xl md:text-3xl font-light max-w-2xl mx-auto mb-14 animate-fade-in-up"
          style={{ animationDelay: '0.25s', color: `${secondaryColor}dd` }}
        >
          {tagline || 'Welcome to our shop'}
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <a
            href="#products"
            className="group relative px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style={{
              backgroundColor: primaryColor,
              color: secondaryColor,
            }}
          >
            <span className="relative z-10">View Collection</span>
            <div
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                boxShadow: `0 8px 32px ${primaryColor}60`,
              }}
            />
          </a>
          <a
            href="#contact"
            className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
            }}
          >
            Get in Touch
          </a>
        </div>
      </div>

      {/* Bottom fade to surface */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-brand-surface via-brand-surface/80 to-transparent" />

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-fade-in" style={{ animationDelay: '1s' }}>
        <div className="flex flex-col items-center gap-2 opacity-60">
          <span className="text-xs tracking-widest uppercase" style={{ color: secondaryColor }}>Scroll</span>
          <div className="w-px h-8 animate-pulse" style={{ backgroundColor: `${secondaryColor}80` }} />
        </div>
      </div>
    </section>
  );
}
