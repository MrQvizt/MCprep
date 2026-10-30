/**
 * Content release: the real MC PREPS menu, the package builder prices and
 * the "first week at €6 a meal" offer (all supplied by the owner, Oct 2026).
 */

/** Studio photos of the dishes are square (1200 × 1200). */
export const DISH_PHOTO_SIZE = 1200;

export const MENU = [
  {
    slug: "chicken-pokebowl", // kept from the original starter content
    name: "Chicken Poke Bowl",
    shortDescription: "Seasoned pulled chicken, edamame, sweetcorn and red cabbage with a creamy drizzle and sesame.",
    description:
      "Our best-selling bowl: seasoned pulled chicken with edamame, sweetcorn and red cabbage, finished with a creamy drizzle and toasted sesame. Big on protein, easy on the fat.",
    calories: 544,
    proteinG: 45,
    carbsG: 63,
    fatG: 7,
    label: "Fan favourite",
    image: "/images/dishes/chicken-poke-bowl.webp",
    previousImage: "/images/menu/chicken-poke-bowl.webp",
    imageAlt: "Chicken Poke Bowl from above: pulled chicken, edamame, sweetcorn, red cabbage and sweet potato with sesame",
  },
  {
    slug: "honey-sriracha-chicken-rice",
    name: "Honey Sriracha Chicken and Rice",
    shortDescription: "Sticky honey sriracha chicken on fluffy white rice with sesame and fresh herbs.",
    description:
      "Sweet heat done right: sticky honey sriracha chicken on a bed of fluffy white rice, topped with sesame seeds and fresh herbs.",
    calories: 540,
    proteinG: 40,
    carbsG: 64,
    fatG: 8,
    label: null,
    image: "/images/dishes/honey-sriracha-chicken-rice.webp",
    previousImage: "/images/menu/honey-sriracha-chicken-rice.webp",
    imageAlt: "Honey Sriracha Chicken on white rice with sesame seeds and herbs, from above",
  },
  {
    slug: "mexican-beef-bowl",
    name: "Mexican Beef Bowl",
    shortDescription: "Spiced Mexican-style beef with kidney beans over grains, finished with a creamy drizzle.",
    description:
      "Spiced Mexican-style beef with kidney beans over a bed of grains, finished with a creamy drizzle and fresh parsley. Comfort food with the macros on the label.",
    calories: 528,
    proteinG: 39,
    carbsG: 68,
    fatG: 7,
    label: null,
    image: "/images/dishes/mexican-beef-bowl.webp",
    previousImage: "/images/menu/mexican-beef-bowl.webp",
    imageAlt: "Mexican Beef Bowl from above: spiced beef, kidney beans and couscous with a yoghurt drizzle",
  },
  {
    slug: "pepper-pesto-pasta",
    name: "Pepper Pesto Pasta",
    shortDescription: "Penne in a creamy red pepper pesto with seasoned chicken and fresh parsley.",
    description:
      "Penne tossed in a creamy red pepper pesto with seasoned chicken and fresh parsley — the highest-protein pasta you'll eat all week.",
    calories: 564,
    proteinG: 45,
    carbsG: 72,
    fatG: 10,
    label: "45g protein",
    image: "/images/dishes/pepper-pesto-pasta.webp",
    previousImage: "/images/menu/pepper-pesto-pasta.webp",
    imageAlt: "Pepper Pesto Pasta from above: penne and chicken in a creamy pepper pesto with parsley",
  },
  {
    slug: "biscoff-cheesecake",
    name: "Biscoff Cheesecake",
    shortDescription: "High-protein Biscoff cheesecake pot — dessert that still hits your macros.",
    description:
      "Dessert that works for your goals: a creamy high-protein cheesecake pot with caramelised biscuit flavour and 30 g of protein.",
    calories: 397,
    proteinG: 30,
    carbsG: 56,
    fatG: 4,
    label: "Protein dessert",
    image: "/images/dishes/biscoff-cheesecake.webp",
    previousImage: "/images/menu/biscoff-cheesecake.webp",
    imageAlt: "Biscoff Cheesecake protein dessert from above, topped with a Lotus biscuit and crumbs",
  },
] as const;

export const NUTRITION_SOURCE = "MC PREPS menu card supplied by the owner (October 2026).";

const PACKAGE_FEATURES = ["Choose your dishes from the weekly menu", "Calories & macros on every meal", "Collection or delivery"];

export const PACKAGES = [
  {
    slug: "lunch-5-days",
    name: "Lunch · 5 days",
    tagline: "Weekday lunches",
    description: "A macro-tracked lunch for every workday.",
    mealsPerDay: 1,
    daysPerWeek: 5,
    isSubscription: false,
    durationDays: 7,
    priceCents: 5250, // €10.50 a meal
    savingsLabel: null,
    isRecommended: false,
  },
  {
    slug: "lunch-7-days",
    name: "Lunch · 7 days",
    tagline: "Every day",
    description: "Lunch sorted, seven days a week.",
    mealsPerDay: 1,
    daysPerWeek: 7,
    isSubscription: false,
    durationDays: 7,
    priceCents: 7000, // €10.00 a meal
    savingsLabel: null,
    isRecommended: false,
  },
  {
    slug: "lunch-dinner-5-days",
    name: "Lunch + Dinner · 5 days",
    tagline: "Most popular",
    description: "Lunch and dinner for every workday — 10 meals a week.",
    mealsPerDay: 2,
    daysPerWeek: 5,
    isSubscription: false,
    durationDays: 7,
    priceCents: 9500, // €9.50 a meal
    savingsLabel: null,
    isRecommended: true,
  },
  {
    slug: "lunch-dinner-7-days",
    name: "Lunch + Dinner · 7 days",
    tagline: "All in",
    description: "Lunch and dinner every day — 14 meals a week.",
    mealsPerDay: 2,
    daysPerWeek: 7,
    isSubscription: false,
    durationDays: 7,
    priceCents: 11900, // €8.50 a meal
    savingsLabel: "Lowest weekly price per meal",
    isRecommended: false,
  },
  {
    slug: "monthly-lunch-dinner-5-days",
    name: "Monthly · Lunch + Dinner · 5 days",
    tagline: "Subscription",
    description: "10 meals a week for 4 weeks, billed monthly.",
    mealsPerDay: 2,
    daysPerWeek: 5,
    isSubscription: true,
    durationDays: 28,
    priceCents: 36000, // €360 / 4 weeks (40 meals, €9.00 a meal)
    savingsLabel: "Save €20 a month vs weekly",
    isRecommended: false,
  },
  {
    slug: "monthly-lunch-dinner-7-days",
    name: "Monthly · Lunch + Dinner · 7 days",
    tagline: "Best value",
    description: "14 meals a week for 4 weeks, billed monthly.",
    mealsPerDay: 2,
    daysPerWeek: 7,
    isSubscription: true,
    durationDays: 28,
    priceCents: 45000, // €450 / 4 weeks (56 meals, €8.04 a meal)
    savingsLabel: "Save €26 a month vs weekly",
    isRecommended: false,
  },
].map((p, i) => ({
  ...p,
  mealsIncluded: p.mealsPerDay * p.daysPerWeek * Math.round(p.durationDays / 7),
  features: PACKAGE_FEATURES,
  sortOrder: i,
}));

/** Placeholder plans from the original starter content (never priced). */
export const LEGACY_PLAN_SLUGS = ["1-week", "2-weeks", "1-month"];

export const INTRO_OFFER = {
  slug: "first-week-6-euro",
  name: "First week €6 a meal",
  theme: "NEW_CUSTOMER_WELCOME" as const,
  headline: "Your first week: €6 a meal",
  subheadline: "Order within 2 hours to lock in your first-week price.",
  description:
    "New to MC PREPS? Build any package and your first week is charged at just €6 per meal. Monthly subscriptions get their first week at €6 a meal too, then the normal monthly price.",
  badgeText: "New customers",
  ctaText: "Build your package",
  discountType: "FIRST_WEEK_MEAL_PRICE" as const,
  discountValue: 600,
  audience: "NEW_CUSTOMERS" as const,
  personalWindowMinutes: 120,
  perCustomerLimit: 1,
  priority: 10,
  terms:
    "New customers only, one per customer. The first week of any weekly package is charged at €6 per meal; monthly subscriptions get their first week at €6 per meal, then the normal monthly price. Your 2-hour window starts the first time you see this offer on this device and doesn't restart. Eligibility is confirmed by our team before your order is confirmed. No payment is taken online.",
};
