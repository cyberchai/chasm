// Placeholder — buildInitialSite overwrites this from the business profile.
export const content = {
  businessId: "demo",
  name: "Placeholder Business",
  type: "business",
  vibe: [] as string[],
  colors: ["#222222", "#ffffff"],
  tagline: "",
  products: [] as { name: string; price: number; image: string }[],
  contact: { phone: "", address: "", hours: "" },
  sections: ["hero"] as string[],
} as const;

export type SiteContent = typeof content;
