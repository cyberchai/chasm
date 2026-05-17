// About.tsx — Business story section with photo collage
// Named component — codegen edits by name. Keep name stable.

import { content } from '../content';

export default function About() {
  const { name, description, vibe, aboutImages } = content;
  const primaryColor = content.colors?.[0] ?? '#2d5016';
  const secondaryColor = content.colors?.[1] ?? '#f5f0e1';

  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text column */}
          <div className="reveal">
            {/* Section label */}
            <span className="text-sm font-medium tracking-wider uppercase text-brand-text-muted">
              About Us
            </span>

            {/* Heading */}
            <h2 className="font-display text-4xl sm:text-5xl font-bold mt-3 mb-8">
              The Story of{' '}
              <span style={{ color: primaryColor }}>
                {name || 'Our Business'}
              </span>
            </h2>

            {/* Description */}
            {description && (
              <p className="text-lg sm:text-xl text-brand-text-muted leading-relaxed mb-10 max-w-xl">
                {description}
              </p>
            )}

            {/* Vibe tags */}
            {vibe && vibe.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-10">
                {vibe.map((v) => (
                  <span
                    key={v}
                    className="px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 cursor-default"
                    style={{
                      backgroundColor: `${primaryColor}18`,
                      border: `1px solid ${primaryColor}30`,
                      color: secondaryColor,
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-brand-border">
              <div>
                <p className="font-display text-3xl font-bold" style={{ color: primaryColor }}>15+</p>
                <p className="text-sm text-brand-text-muted mt-1">Years of craft</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold" style={{ color: primaryColor }}>2k+</p>
                <p className="text-sm text-brand-text-muted mt-1">Happy customers</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold" style={{ color: primaryColor }}>100%</p>
                <p className="text-sm text-brand-text-muted mt-1">Locally sourced</p>
              </div>
            </div>
          </div>

          {/* Photo collage column */}
          <div className="reveal relative" style={{ animationDelay: '0.2s' }}>
            {aboutImages && aboutImages.length >= 3 ? (
              <div className="relative">
                {/* Main large photo */}
                <div className="rounded-2xl overflow-hidden shadow-2xl">
                  <img
                    src={aboutImages[0]}
                    alt={`${name} — our team`}
                    className="w-full h-[420px] object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Smaller overlapping photo */}
                <div
                  className="absolute -bottom-6 -left-6 w-48 h-64 rounded-xl overflow-hidden shadow-xl border-4"
                  style={{ borderColor: 'var(--color-surface)' }}
                >
                  <img
                    src={aboutImages[1]}
                    alt={`${name} — our shop`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Accent photo */}
                <div
                  className="absolute -top-4 -right-4 w-36 h-48 rounded-xl overflow-hidden shadow-xl border-4"
                  style={{ borderColor: 'var(--color-surface)' }}
                >
                  <img
                    src={aboutImages[2]}
                    alt={`${name} — fresh blooms`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Decorative dot pattern */}
                <div
                  className="absolute -z-10 -bottom-8 -right-8 w-32 h-32 opacity-20"
                  style={{
                    backgroundImage: `radial-gradient(${primaryColor} 2px, transparent 2px)`,
                    backgroundSize: '12px 12px',
                  }}
                />
              </div>
            ) : (
              /* Fallback decorative element */
              <div className="glass rounded-2xl p-12 flex items-center justify-center min-h-[400px]">
                <div
                  className="w-32 h-32 rounded-full opacity-20"
                  style={{
                    background: `radial-gradient(circle, ${primaryColor}, transparent)`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Decorative divider */}
        <div className="mt-20 flex items-center gap-4 reveal">
          <div className="flex-1 h-px bg-brand-border" />
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          <div className="flex-1 h-px bg-brand-border" />
        </div>
      </div>
    </section>
  );
}
