// PRESET: florist — drop-in src/content.ts. Self-contained so the build can
// copy it verbatim. Keep the interface block in sync with src/content.ts.

export interface SiteProduct {
  name: string;
  /** Price in cents (Stripe convention). */
  price: number;
  /** Path relative to public/, e.g. "/products/spring.png" */
  image: string;
  /** Optional short description */
  description?: string;
}

export interface SiteContact {
  phone: string;
  address: string;
  hours: string;
}

export interface SiteContent {
  businessId: string;
  name: string;
  type: string;
  vibe: string[];
  /** Hex color strings. [0] = primary, [1] = secondary */
  colors: string[];
  tagline: string;
  description?: string;
  products: SiteProduct[];
  contact: SiteContact;
  /** Section render order */
  sections: string[];
  /** Hero background image path */
  heroImage?: string;
  /** Images for the About / gallery section */
  aboutImages?: string[];
  /** Full-width gallery images (shop ambiance) */
  galleryImages?: string[];
}

export const content: SiteContent = {
  businessId: 'demo',
  name: 'Rose & Thorn',
  type: 'florist',
  vibe: ['cozy', 'modern', 'artisanal'],
  colors: ['#2d5016', '#f5f0e1'],
  tagline: 'Fresh arrangements, made daily',
  description:
    'We are a neighborhood florist crafting thoughtful arrangements from locally sourced blooms. Every bouquet tells a story — from garden roses to wild seasonal stems, designed to bring warmth into your space.',
  heroImage: '/shop/pexels-olly-947914.jpg',
  aboutImages: [
    '/shop/pexels-pavel-danilyuk-6764300.jpg',
    '/shop/pexels-mibernaa-31995177.jpg',
    '/shop/pexels-liza-sigareva-2149951107-34543934.jpg',
  ],
  galleryImages: [
    '/shop/pexels-doma-15615844.jpg',
    '/shop/pexels-freestockpro-12932611.jpg',
    '/shop/pexels-adri-ana-423950603-31090397.jpg',
    '/shop/pexels-olly-947914.jpg',
  ],
  products: [
    {
      name: 'Spring Bouquet',
      price: 4500,
      image: '/products/pastel spring bouquet.jpg',
      description: 'Bright seasonal blooms in soft pastel tones',
    },
    {
      name: 'Bridal Whites',
      price: 8500,
      image: '/products/buidal bouquet white flowers.jpg',
      description: 'Elegant white arrangement for special occasions',
    },
    {
      name: 'Dried Botanicals',
      price: 5500,
      image: '/products/dried flower bouquet aesthetic.jpg',
      description: 'Long-lasting dried stems, beautifully arranged',
    },
    {
      name: 'Garden Style',
      price: 6500,
      image: '/products/garden-style bouquet loose.jpg',
      description: 'Loose, natural arrangement with garden roses',
    },
    {
      name: 'Moody Florals',
      price: 7200,
      image: '/products/moody dark floral arrangement.jpg',
      description: 'Rich, dark tones for a dramatic statement',
    },
    {
      name: 'Single Stem Wrap',
      price: 2800,
      image: '/products/minimalist single flower wrap.jpg',
      description: 'Minimalist single bloom, gift-wrapped',
    },
  ],
  contact: {
    phone: '(555) 123-4567',
    address: '42 Bloom Street, Portland, OR 97201',
    hours: 'Mon–Sat 9am–6pm · Sun 10am–4pm',
  },
  sections: ['hero', 'gallery', 'products', 'about', 'contact', 'order'],
};
