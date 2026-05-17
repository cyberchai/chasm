// OrderButton.tsx — Stripe Checkout trigger (test mode)
// Named component — codegen edits by name. Keep name stable.
// Calls POST /api/checkout → gets a Stripe Checkout URL → redirects.

import { useState } from 'react';
import { content } from '../content';

export default function OrderButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primaryColor = content.colors?.[0] ?? '#2d5016';

  const products = content.products ?? [];

  async function handleCheckout() {
    if (products.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const items = products.map((p) => ({
        name: p.name,
        price: p.price,
        quantity: 1,
      }));

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Checkout failed (${res.status})`);
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="order" className="py-24 px-6">
      <div className="max-w-2xl mx-auto text-center reveal">
        {/* Section header */}
        <span className="text-sm font-medium tracking-wider uppercase text-brand-text-muted">
          Ready to Order?
        </span>
        <h2 className="font-display text-4xl sm:text-5xl font-bold mt-3 mb-4">
          Place Your Order
        </h2>
        <p className="text-brand-text-muted text-lg mb-10 max-w-md mx-auto">
          {products.length > 0
            ? `${products.length} item${products.length > 1 ? 's' : ''} available. Secure checkout powered by Stripe.`
            : 'Check back soon for our latest offerings.'}
        </p>

        {/* Checkout button */}
        <button
          onClick={handleCheckout}
          disabled={loading || products.length === 0}
          className="group relative px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            backgroundColor: primaryColor,
            color: content.colors?.[1] ?? '#f5f0e1',
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-3">
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                Order Now
              </>
            )}
          </span>

          {/* Glow effect on hover */}
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              boxShadow: `0 0 40px ${primaryColor}50, 0 0 80px ${primaryColor}20`,
            }}
          />
        </button>

        {/* Error message */}
        {error && (
          <p className="mt-4 text-red-400 text-sm animate-fade-in">{error}</p>
        )}

        {/* Test mode badge */}
        <div className="mt-8 inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-brand-text-muted">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
          Stripe Test Mode
        </div>
      </div>
    </section>
  );
}
