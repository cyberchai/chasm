// Gallery.tsx — Full-width photo gallery strip
// Named component — codegen edits by name. Keep name stable.
// Uses galleryImages from content for immersive shop ambiance.

import { content } from '../content';

export default function Gallery() {
  const images = content.galleryImages ?? [];
  const primaryColor = content.colors?.[0] ?? '#2d5016';

  if (images.length === 0) return null;

  return (
    <section id="gallery" className="py-4 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4">
        {/* Section label */}
        <div className="text-center mb-10 reveal">
          <span className="text-sm font-medium tracking-wider uppercase text-brand-text-muted">
            Our Workshop
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">
            Where the Magic Happens
          </h2>
        </div>

        {/* Masonry-style photo grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 reveal">
          {images.map((src, i) => {
            // Vary aspect ratios for visual interest
            const isFeature = i === 0 || i === 3;
            return (
              <div
                key={src}
                className={`group relative overflow-hidden rounded-xl cursor-pointer transition-all duration-500 hover:z-10 ${
                  isFeature ? 'row-span-2' : ''
                }`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                <img
                  src={src}
                  alt={`${content.name} shop ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  style={{ minHeight: isFeature ? '400px' : '200px' }}
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500"
                  style={{
                    background: `linear-gradient(180deg, transparent 50%, ${primaryColor}90 100%)`,
                  }}
                />
                {/* Hover corner accent */}
                <div
                  className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: content.colors?.[1] ?? '#f5f0e1' }}
                    />
                    <span
                      className="text-xs font-medium tracking-wider uppercase"
                      style={{ color: content.colors?.[1] ?? '#f5f0e1' }}
                    >
                      {content.name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
