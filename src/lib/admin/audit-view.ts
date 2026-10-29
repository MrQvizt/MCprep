/** Owner-friendly labels and links for audit log entries. */

export const ENTITY_LABELS: Record<string, string> = {
  Order: "Orders",
  Customer: "Customers",
  Meal: "Meals",
  Plan: "Plans & prices",
  Promotion: "Promotions",
  SeasonalCampaignLandingPage: "Offer pages",
  FAQ: "FAQs",
  BlogPost: "Blog",
  BlogCategory: "Blog categories",
  GalleryItem: "Instagram gallery",
  MediaAsset: "Media library",
  Testimonial: "Testimonials",
  PageContent: "Page content",
  SiteSetting: "Settings",
  SEOPageMetadata: "SEO",
  RedirectRule: "Redirects",
  BusinessListing: "Business listings",
  DeliveryArea: "Delivery localities",
  CollectionPoint: "Collection points",
  AdminUser: "Admin users",
  EmailOutbox: "Emails",
  SiteHealthCheck: "Site health",
};

export function entityLabel(type: string): string {
  return ENTITY_LABELS[type] ?? type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function entityHref(type: string, id: string | null): string | null {
  switch (type) {
    case "Order":
      return id ? `/admin/orders/${id}` : "/admin/orders";
    case "Customer":
      return id ? `/admin/customers/${id}` : "/admin/customers";
    case "Meal":
      return id ? `/admin/meals/${id}` : "/admin/meals";
    case "Plan":
      return id ? `/admin/plans/${id}` : "/admin/plans";
    case "Promotion":
      return id ? `/admin/promotions/${id}` : "/admin/promotions";
    case "SeasonalCampaignLandingPage":
      return id ? `/admin/landing-pages/${id}` : "/admin/landing-pages";
    case "FAQ":
      return id ? `/admin/faqs/${id}` : "/admin/faqs";
    case "BlogPost":
      return id ? `/admin/blog/${id}` : "/admin/blog";
    case "Testimonial":
      return id ? `/admin/testimonials/${id}` : "/admin/testimonials";
    case "DeliveryArea":
      return id ? `/admin/delivery/areas/${id}` : "/admin/delivery";
    case "CollectionPoint":
      return id ? `/admin/delivery/collection/${id}` : "/admin/delivery";
    case "AdminUser":
      return id ? `/admin/users/${id}` : "/admin/users";
    case "GalleryItem":
      return "/admin/gallery";
    case "MediaAsset":
      return "/admin/media";
    case "PageContent":
      return "/admin/content";
    case "SiteSetting":
      return "/admin/settings";
    case "SEOPageMetadata":
      return "/admin/seo";
    case "RedirectRule":
      return "/admin/redirects";
    case "BusinessListing":
      return "/admin/listings";
    default:
      return null;
  }
}
