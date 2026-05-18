// PRESET: tech / startup — drop-in src/content.ts. Self-contained so the build
// can copy it verbatim. Keep the interface block in sync with src/content.ts.
// Image paths reuse existing template assets as neutral placeholders;
// image-gen replaces them later.

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
  name: 'Northwind',
  type: 'tech',
  vibe: ['modern', 'minimal', 'bold'],
  colors: ['#0f172a', '#e2e8f0'],
  tagline: 'Ship faster. Worry less.',
  description:
    'Northwind is the workflow platform for teams that move fast. Automate the busywork, keep everyone in sync, and launch with confidence — no ops team required.',
  heroImage: '/shop/pexels-freestockpro-12932611.jpg',
  aboutImages: [
    '/shop/pexels-doma-15615844.jpg',
    '/shop/pexels-adri-ana-423950603-31090397.jpg',
    '/shop/pexels-mibernaa-31995177.jpg',
  ],
  galleryImages: [
    '/shop/pexels-olly-947914.jpg',
    '/shop/pexels-pavel-danilyuk-6764300.jpg',
    '/shop/pexels-liza-sigareva-2149951107-34543934.jpg',
    '/shop/pexels-freestockpro-12932611.jpg',
  ],
  products: [
    {
      name: 'Starter',
      price: 0,
      image: '/products/minimalist single flower wrap.jpg',
      description: 'For solo builders — core automation, up to 3 projects',
    },
    {
      name: 'Pro',
      price: 2900,
      image: '/products/pastel spring bouquet.jpg',
      description: 'For growing teams — unlimited projects, integrations, SSO',
    },
    {
      name: 'Enterprise',
      price: 9900,
      image: '/products/moody dark floral arrangement.jpg',
      description: 'For scale — dedicated support, audit logs, custom SLAs',
    },
  ],
  contact: {
    phone: '(555) 901-3360',
    address: '500 Market Street, Suite 1200, San Francisco, CA 94105',
    hours: 'Support Mon–Fri 8am–8pm PT',
  },
  sections: ['hero', 'gallery', 'products', 'about', 'contact', 'order'],
};
