// Products.tsx — Product cards grid
// Named component — codegen edits by name. Keep name stable.
// Reads content.products and renders cards with images, names, prices.
// Handles empty state gracefully.

import { content, type SiteProduct } from '../content';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ProductCard({ product, index }: { product: SiteProduct; index: number }) {
  const primaryColor = content.colors?.[0] ?? '#2d5016';
  const hasImage = product.image && !product.image.includes('placeholder');

  return (
    <div
      className="reveal group glass rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
      style={{
        animationDelay: `${index * 0.12}s`,
        boxShadow: `0 0 0 0 ${primaryColor}00`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 48px ${primaryColor}20`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${primaryColor}00`;
      }}
    >
      {/* Image container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-brand-surface-alt">
        {hasImage ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-24 h-24 rounded-full opacity-20"
              style={{
                background: `radial-gradient(circle, ${primaryColor}, transparent)`,
              }}
            />
            <svg
              className="absolute w-12 h-12 text-brand-text-muted opacity-30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Price badge */}
        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full glass text-sm font-semibold">
          {formatPrice(product.price)}
        </div>
      </div>

      {/* Card body */}
      <div className="p-6">
        <h3 className="font-display text-xl font-semibold mb-2 group-hover:text-brand-accent transition-colors duration-300">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-brand-text-muted text-sm leading-relaxed">
            {product.description}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Products() {
  const products = content.products ?? [];

  if (products.length === 0) {
    return (
      <section id="products" className="py-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-brand-text-muted text-lg">
            Products coming soon...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="products" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16 reveal">
          <span className="text-sm font-medium tracking-wider uppercase text-brand-text-muted">
            Our Collection
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-bold mt-3">
            Handcrafted with Care
          </h2>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, i) => (
            <ProductCard key={product.name} product={product} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
