// PRESET: cafe / restaurant — drop-in src/content.ts. Self-contained so the
// build can copy it verbatim. Keep the interface block in sync with
// src/content.ts. Image paths reuse existing template assets as neutral
// placeholders; image-gen replaces them later.

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
  name: 'Daybreak Café',
  type: 'cafe',
  vibe: ['warm', 'cozy', 'artisanal'],
  colors: ['#3b2f2f', '#f4ebdd'],
  tagline: 'Slow mornings, good coffee',
  description:
    'A neighborhood café built on small-batch roasts and unhurried mornings. We pull every shot by hand, bake fresh each day, and keep a seat warm for you.',
  heroImage: '/shop/pexels-olly-947914.jpg',
  aboutImages: [
    '/shop/pexels-pavel-danilyuk-6764300.jpg',
    '/shop/pexels-mibernaa-31995177.jpg',
    '/shop/pexels-doma-15615844.jpg',
  ],
  galleryImages: [
    '/shop/pexels-freestockpro-12932611.jpg',
    '/shop/pexels-adri-ana-423950603-31090397.jpg',
    '/shop/pexels-liza-sigareva-2149951107-34543934.jpg',
    '/shop/pexels-doma-15615844.jpg',
  ],
  products: [
    {
      name: 'House Espresso',
      price: 350,
      image: '/products/minimalist single flower wrap.jpg',
      description: 'Double shot of our signature small-batch roast',
    },
    {
      name: 'Vanilla Oat Latte',
      price: 525,
      image: '/products/pastel spring bouquet.jpg',
      description: 'Espresso, steamed oat milk, a touch of vanilla',
    },
    {
      name: 'Cold Brew',
      price: 475,
      image: '/products/moody dark floral arrangement.jpg',
      description: 'Steeped 18 hours, smooth and low-acid',
    },
    {
      name: 'Butter Croissant',
      price: 400,
      image: '/products/buidal bouquet white flowers.jpg',
      description: 'Laminated by hand, baked every morning',
    },
    {
      name: 'Avocado Toast',
      price: 950,
      image: '/products/garden-style bouquet loose.jpg',
      description: 'Sourdough, smashed avocado, chili, sea salt',
    },
    {
      name: 'Seasonal Galette',
      price: 650,
      image: '/products/dried flower bouquet aesthetic.jpg',
      description: 'Rotating fruit galette — ask what is fresh today',
    },
  ],
  contact: {
    phone: '(555) 248-1190',
    address: '8 Sunrise Avenue, Portland, OR 97209',
    hours: 'Mon–Fri 6:30am–4pm · Sat–Sun 7am–5pm',
  },
  sections: ['hero', 'gallery', 'products', 'about', 'contact', 'order'],
};
