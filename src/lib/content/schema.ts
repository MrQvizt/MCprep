import { z } from "zod";

/**
 * Editable page content blocks (PageContent table). Each key has a schema and
 * default copy. Text fields are plain text; blank lines separate paragraphs.
 * Legal pages hold sanitised HTML edited with the rich-text editor.
 *
 * Copy rules: authentic MC PREPS voice, no invented facts (prices, addresses,
 * fees, certifications, testimonials, nutrition claims beyond listed macros).
 */

const text = (def: string, max = 4000) => z.string().max(max).catch(def).default(def);
const optText = (max = 4000) => z.string().max(max).catch("").default("");
const media = () => z.string().nullable().catch(null).default(null);
const cta = (label: string, href: string) =>
  z
    .object({ label: z.string().max(60), href: z.string().max(300) })
    .catch({ label, href })
    .default({ label, href });

const textItem = z.object({ title: z.string().max(120), body: z.string().max(600) });
const faqItem = z.object({ question: z.string().max(240), answer: z.string().max(2000) });
const section = z.object({ heading: z.string().max(160), body: z.string().max(6000) });

function list<T extends z.ZodTypeAny>(item: T, def: z.infer<T>[]) {
  return z.array(item).max(24).catch(def).default(def);
}

// ── Homepage ────────────────────────────────────────────────────────────────

export const homeHeroSchema = z.object({
  kicker: text("High-protein meal prep in Malta", 120),
  headline: text("Fuel your lift.", 80),
  subheadline: text(
    "Macro-tracked lunches and dinners, cooked fresh. Build your package, pick your dishes — collect or get it delivered.",
    300,
  ),
  primaryCta: cta("Build your package", "/order"),
  secondaryCta: cta("See the menu", "/menu"),
  imageId: media(),
  imageAlt: text("MC PREPS meal prep — fresh, high-protein meals", 200),
  proofPoints: list(z.string().max(60), [
    "High protein",
    "Macros on every meal",
    "Pick your dishes",
    "Menu changes every few weeks",
    "Collection & delivery",
  ]),
});

export const homeIntroSchema = z.object({
  heading: text("Premium meal prep in Malta", 120),
  body: text(
    "MC PREPS cooks high-protein, macro-counted meals fresh every week for lifters, athletes, active people and busy professionals in Malta.\n\nBuild your package — lunch, or lunch and dinner, five or seven days a week — pick your dishes from the current menu and send your request online. Our team then contacts you personally to confirm collection or delivery and payment. Nothing is charged online.\n\nCalories and macros are listed on every meal, so tracking your intake is simple whether you're building strength, cutting, or just want to eat well without the weekly cooking marathon.",
  ),
});

export const homeBenefitsSchema = z.object({
  eyebrow: text("Why MC PREPS", 60),
  heading: text("Built for people who train", 120),
  items: list(textItem.extend({ icon: z.string().max(40).default("flame") }), [
    { icon: "flame", title: "Cooked fresh every week", body: "Your meals are prepared fresh each week, ready for the days ahead." },
    { icon: "target", title: "Macro-tracked", body: "Calories, protein, carbs and fat listed, so hitting your numbers is simple." },
    { icon: "dumbbell", title: "High-protein by design", body: "Made for lifters and active lifestyles — protein-forward meals without the guesswork." },
    { icon: "truck", title: "Collection or delivery", body: "Collect your meals or have them delivered within our Malta delivery areas." },
    { icon: "message-circle", title: "Personal service", body: "Send your request online and we confirm everything with you directly. No online payment." },
  ]),
});

export const homeFeaturedMealsSchema = z.object({
  eyebrow: text("On the menu", 60),
  heading: text("This week's menu", 120),
  subheading: text("Real food with the numbers on the label. The menu changes every few weeks.", 300),
  ctaLabel: text("See the full menu", 60),
});

export const homeHowItWorksSchema = z.object({
  eyebrow: text("How it works", 60),
  heading: text("Three steps to a stocked fridge", 120),
  steps: list(textItem, [
    { title: "Build your package", body: "Lunch, or lunch and dinner. Five or seven days a week. Weekly, or monthly and save." },
    { title: "Pick your dishes", body: "Choose how many of each dish you'd like — or mix them evenly in one tap." },
    { title: "We confirm, you eat well", body: "We contact you to confirm collection or delivery and payment. Nothing is charged online." },
  ]),
  note: text("Orders are requests until our team confirms them with you.", 300),
});

export const homeFulfillmentSchema = z.object({
  eyebrow: text("Collection & delivery", 60),
  heading: text("Your meals, your way", 120),
  body: text("Pick up your meals or have them delivered. Available delivery localities, days and any fees are shown when you place your order.", 600),
  collectionTitle: text("Collection", 60),
  collectionBody: text("Collect your meals from us. Collection details are confirmed with you when we confirm your order.", 600),
  deliveryTitle: text("Delivery", 60),
  deliveryBody: text("Delivery to supported localities in Malta. Choose your locality in the order form to see availability.", 600),
});

export const homePlansSchema = z.object({
  eyebrow: text("Packages", 60),
  heading: text("Build your package", 120),
  subheading: text("Lunch, or lunch and dinner. Five or seven days. Weekly, or monthly and save — we confirm everything before anything is paid.", 300),
});

export const homeInstagramSchema = z.object({
  eyebrow: text("On Instagram", 60),
  heading: text("Follow the prep", 120),
  ctaLabel: text("Follow us on Instagram", 60),
});

export const homeFaqSchema = z.object({
  eyebrow: text("FAQ", 60),
  heading: text("Questions, answered", 120),
});

export const homeTestimonialsSchema = z.object({
  eyebrow: text("From our customers", 60),
  heading: text("What people say", 120),
});

export const homeFinalCtaSchema = z.object({
  headline: text("Your goals. Your fuel.", 80),
  body: text("Build your package and pick your dishes in under two minutes. We'll take it from there.", 300),
  cta: cta("Build your package", "/order"),
  imageId: media(),
});

export const homeSectionsSchema = z.object({
  showBenefits: z.boolean().catch(true).default(true),
  showFeaturedMeals: z.boolean().catch(true).default(true),
  showHowItWorks: z.boolean().catch(true).default(true),
  showFulfillment: z.boolean().catch(true).default(true),
  showPlans: z.boolean().catch(true).default(true),
  showPromotion: z.boolean().catch(true).default(true),
  showInstagram: z.boolean().catch(true).default(true),
  showTestimonials: z.boolean().catch(true).default(true),
  showFaq: z.boolean().catch(true).default(true),
  showFinalCta: z.boolean().catch(true).default(true),
  featuredMealLimit: z.number().int().min(1).max(12).catch(6).default(6),
  galleryLimit: z.number().int().min(3).max(12).catch(6).default(6),
});

// ── Inner pages ─────────────────────────────────────────────────────────────

export const simplePageSchema = (heading: string, intro: string, body = "") =>
  z.object({
    eyebrow: optText(60),
    heading: text(heading, 120),
    intro: text(intro, 1200),
    body: text(body, 8000),
    imageId: media(),
  });

export const aboutPageSchema = z.object({
  eyebrow: text("About MC PREPS", 60),
  heading: text("Meal prep for serious lifters", 120),
  intro: text(
    "MC PREPS is a Malta-based meal prep brand cooking high-protein, macro-counted meals fresh every week.",
    1200,
  ),
  body: text(
    "We cook for powerlifters, bodybuilders and anyone who takes their training seriously — and for busy people who simply want good food they don't have to think about.\n\nEvery plan starts with a conversation. You send an order request online, and we confirm the details with you personally: your meals, any allergies or preferences, collection or delivery, and payment.",
    8000,
  ),
  values: list(textItem, [
    { title: "Real numbers", body: "Calories and macros listed, so you can track with confidence." },
    { title: "Fresh every week", body: "Meals cooked fresh every week." },
    { title: "Straightforward service", body: "Talk to a real person on WhatsApp, Instagram or email." },
  ]),
  imageId: media(),
  ownerNote: optText(1200),
});

export const howItWorksPageSchema = z.object({
  eyebrow: text("How it works", 60),
  heading: text("From package to plate", 120),
  intro: text(
    "Ordering from MC PREPS is simple and personal. You build your package, pick your dishes and send a request — we confirm everything with you before your meals are prepared.",
    1200,
  ),
  steps: list(textItem, [
    { title: "Build your package", body: "Lunch, or lunch and dinner. Five or seven days a week. Weekly, or subscribe monthly and save." },
    { title: "Pick your dishes", body: "Choose how many of each dish on the current menu you'd like each week — or mix them evenly. The menu changes every few weeks." },
    { title: "Send your order request", body: "Add your contact details, choose collection or delivery, and tell us about any preferences or allergies. It takes a couple of minutes." },
    { title: "We get in touch", body: "Our team contacts you by phone, WhatsApp or email to confirm availability, your start date, collection or delivery details, and payment." },
    { title: "Your meals are prepared", body: "Once confirmed, your meals are cooked fresh and ready for collection or delivery as agreed." },
  ]),
  body: text(
    "No payment is taken on this website. If an offer is running, the discounted price is shown when you order — new-customer offers are confirmed by our team before your price is final.",
    4000,
  ),
});

export const contactPageSchema = z.object({
  eyebrow: text("Contact", 60),
  heading: text("Talk to us", 120),
  intro: text("Questions about plans, meals, allergies or delivery? Message us — we're happy to help.", 1200),
});

export const faqPageSchema = z.object({
  eyebrow: text("FAQ", 60),
  heading: text("Frequently asked questions", 120),
  intro: text("Everything you need to know about ordering from MC PREPS.", 600),
});

export const menuPageSchema = z.object({
  eyebrow: text("The menu", 60),
  heading: text("On the menu", 120),
  intro: text(
    "High-protein meals cooked fresh in Malta, with calories and macros on every dish. Choose any mix of them in your package — the menu changes every few weeks.",
    1200,
  ),
  nutritionNote: text(
    "Nutrition values are provided by MC PREPS for guidance and may vary slightly between batches. Allergen information is shown where provided — always tell us about allergies when ordering.",
    1200,
  ),
});

export const plansPageSchema = z.object({
  eyebrow: text("Packages & pricing", 60),
  heading: text("Build your package", 120),
  intro: text(
    "Lunch, or lunch and dinner. Five or seven days a week. Pay weekly, or subscribe monthly and save. Choose your dishes, send your request — our team confirms everything with you before anything is paid.",
    1200,
  ),
  note: text("Prices are shown in euro. Any delivery fees are shown in your order summary when you choose your locality.", 600),
});

export const galleryPageSchema = z.object({
  eyebrow: text("Gallery", 60),
  heading: text("From the MC PREPS kitchen", 120),
  intro: text("A look at the meals and the prep, straight from our Instagram.", 600),
});

export const offersPageSchema = z.object({
  eyebrow: text("Offers", 60),
  heading: text("Current offers", 120),
  intro: text("Genuine, time-limited offers on MC PREPS meal plans. Each offer shows its real end date.", 600),
  emptyMessage: text("There are no offers running right now. Follow us on Instagram to hear about the next one.", 600),
});

export const deliveryAreasPageSchema = z.object({
  eyebrow: text("Delivery areas", 60),
  heading: text("Meal prep delivery in Malta", 120),
  intro: text(
    "MC PREPS offers collection and delivery. Below are the localities we currently deliver to, with delivery days and any fees. Don't see your area? Message us — we may still be able to help, or you can choose collection.",
    2000,
  ),
  body: optText(6000),
});

export const blogIndexSchema = z.object({
  eyebrow: text("Journal", 60),
  heading: text("Meal prep & nutrition notes", 120),
  intro: text("Practical guides on meal prep, macros and eating well in Malta.", 600),
});

export const footerSchema = z.object({
  tagline: text("Macro-tracked meal prep for serious lifters and busy lives. Prepared in Malta.", 300),
  smallPrint: optText(600),
});

// ── SEO service pages ───────────────────────────────────────────────────────

export const servicePageSchema = (def: {
  eyebrow: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  faqs: { question: string; answer: string }[];
  ctaLabel: string;
  ctaHref: string;
}) =>
  z.object({
    eyebrow: text(def.eyebrow, 80),
    h1: text(def.h1, 140),
    intro: text(def.intro, 2000),
    sections: list(section, def.sections),
    faqs: list(faqItem, def.faqs),
    cta: cta(def.ctaLabel, def.ctaHref),
    imageId: media(),
    showPlans: z.boolean().catch(true).default(true),
    showMeals: z.boolean().catch(true).default(true),
  });

export const mealPrepMaltaSchema = servicePageSchema({
  eyebrow: "Meal prep Malta",
  h1: "Meal prep in Malta, cooked fresh every week",
  intro:
    "MC PREPS is a Malta-based meal prep service for people who want high-protein, macro-counted meals without spending their Sunday cooking. Choose a plan, send an order request, and we confirm everything with you personally.",
  sections: [
    {
      heading: "What is MC PREPS meal prep?",
      body: "Meal prep means having your week's meals cooked and portioned in advance. We do the planning, shopping and cooking; you get ready-to-eat meals with their calories and macros listed.\n\nOur menu is built around protein-forward meals for lifters, athletes and active people — but plenty of our customers are simply busy professionals who want to eat well during the working week.",
    },
    {
      heading: "Macro-counted, so tracking is easy",
      body: "If you track your intake, you'll know how tedious weighing and logging every ingredient can be. Our meals list calories, protein, carbohydrates and fat, so you can log a meal in seconds and stay on target.",
    },
    {
      heading: "Packages that fit your routine",
      body: "Lunch only, or lunch and dinner. Five or seven days a week. Pay week by week, or subscribe monthly for the lowest price per meal. Every package's price is shown on our packages page — and you choose your dishes from the current menu.",
    },
    {
      heading: "Collection or delivery in Malta",
      body: "You can collect your meals or have them delivered to the localities we serve. The order form only shows localities we can actually deliver to, along with delivery days and any fees.",
    },
  ],
  faqs: [
    {
      question: "How do I order meal prep from MC PREPS?",
      answer: "Build your package, pick your dishes and send the order request. No payment is taken online — our team contacts you to confirm the details and arrange payment.",
    },
    {
      question: "Can I tell you about allergies or preferences?",
      answer: "Yes. The order form has space for dietary preferences and allergies. We review them with you before your order is confirmed.",
    },
  ],
  ctaLabel: "Build your package",
  ctaHref: "/order",
});

export const healthyMealDeliveryMaltaSchema = servicePageSchema({
  eyebrow: "Healthy meal delivery Malta",
  h1: "Healthy meal delivery in Malta",
  intro:
    "Fresh, macro-counted meals delivered to supported localities in Malta — or ready for collection if that suits you better. Here's how delivery with MC PREPS works.",
  sections: [
    {
      heading: "Where we deliver",
      body: "We deliver to a set list of localities, which you can see on our delivery areas page. When you place an order request, you choose your locality from that list so you know straight away whether delivery is available.",
    },
    {
      heading: "Delivery days and fees",
      body: "Delivery days and any delivery fee depend on your locality and are shown in the order form and on the delivery areas page. Your order summary includes any fee before you submit your request.",
    },
    {
      heading: "Prefer to collect?",
      body: "Collection is available too. Choose collection in the order form and we'll confirm the collection details with you when we confirm your order.",
    },
    {
      heading: "What arrives",
      body: "Ready-to-eat meals from our menu, with calories and macros listed. Tell us about any allergies or intolerances when ordering so we can confirm what's suitable for you.",
    },
  ],
  faqs: [
    {
      question: "Is my area covered?",
      answer: "Check the delivery areas page or the locality list in the order form. If your area isn't listed, message us on WhatsApp or Instagram — or choose collection.",
    },
    {
      question: "Do I pay for delivery online?",
      answer: "No. Nothing is paid on the website. Any delivery fee is shown in your order summary and confirmed with you by our team.",
    },
  ],
  ctaLabel: "Check delivery areas",
  ctaHref: "/delivery-areas",
});

export const mealPlansMaltaSchema = servicePageSchema({
  eyebrow: "Meal plans Malta",
  h1: "Meal plans in Malta: lunch, or lunch and dinner",
  intro:
    "Not sure which MC PREPS package to pick? This guide explains how our packages work and who each one suits, so you can choose with confidence.",
  sections: [
    {
      heading: "Lunch: weekdays or every day",
      body: "Five or seven macro-tracked lunches a week. A great place to start if you're new to meal prep or only need your workday meals sorted.",
    },
    {
      heading: "Lunch + dinner: the full day sorted",
      body: "Ten or fourteen meals a week — our most popular way to eat. Two meals a day off your mind, and a lower price per meal.",
    },
    {
      heading: "Monthly subscription: set and forget",
      body: "Lunch and dinner for four weeks at a time, billed monthly, at our lowest price per meal. Ideal if you want your nutrition sorted with fewer decisions each week.",
    },
    {
      heading: "How ordering works",
      body: "Build your package, pick your dishes and send your order request. Our team contacts you to confirm your start date, collection or delivery, and payment. If a genuine offer is running, its price and real deadline are shown on the package cards.",
    },
  ],
  faqs: [
    {
      question: "Can I change my package later?",
      answer: "Yes — tell us when we confirm your order, or any time after. We'll move you to the package that fits.",
    },
    {
      question: "Are prices final when I submit my request?",
      answer: "The price shown is your quote. Our team confirms the final amount with you — for example, new-customer offers are verified before they're applied.",
    },
  ],
  ctaLabel: "Compare packages",
  ctaHref: "/plans",
});

export const highProteinMealsMaltaSchema = servicePageSchema({
  eyebrow: "High-protein meals Malta",
  h1: "High-protein meals in Malta for lifters and active people",
  intro:
    "MC PREPS started with the people who take their training seriously: powerlifters, bodybuilders and gym regulars who need plenty of protein and accurate numbers. Our meals are protein-forward, macro-counted and cooked fresh every week.",
  sections: [
    {
      heading: "Protein-forward, with the numbers listed",
      body: "Each meal on our menu lists its protein alongside calories, carbohydrates and fat where available. That makes it easy to plan your day around your protein target without weighing ingredients yourself.",
    },
    {
      heading: "Example: Chicken Pokébowl",
      body: "Our Chicken Pokébowl is listed at 544 kcal with 45 g protein, 63 g carbohydrates and 7 g fat. Check the menu for the current figures for every meal.",
    },
    {
      heading: "For bulking, cutting or maintaining",
      body: "Because the macros are listed, you can fit our meals into whatever phase you're in. If you have specific requirements, mention them in your order request and we'll discuss them with you.",
    },
  ],
  faqs: [
    {
      question: "Are your meals suitable for my diet?",
      answer: "Our meals list their macros so you can decide what fits your plan. For allergies or medical dietary needs, speak to us and to a qualified professional.",
    },
  ],
  ctaLabel: "View the menu",
  ctaHref: "/menu",
});

// ── Legal pages (sanitised HTML; templates require legal review) ────────────

export const legalPageSchema = (title: string, html: string) =>
  z.object({
    title: text(title, 120),
    html: text(html, 60000),
    lastUpdated: optText(40),
    reviewedByOwner: z.boolean().catch(false).default(false),
  });

const REVIEW_BANNER =
  "<p><strong>Template — requires review.</strong> This document is a starting template and must be reviewed by the business owner and a qualified adviser before launch. Replace every item in [square brackets].</p>";

export const privacyPolicySchema = legalPageSchema(
  "Privacy Policy",
  `${REVIEW_BANNER}
<h2>Who we are</h2>
<p>This website is operated by [registered business name], trading as MC PREPS, [registered address], Malta ("we", "us"). You can contact us about privacy at [privacy contact email].</p>
<h2>What we collect</h2>
<ul>
<li><strong>Order request details:</strong> your name, email address, phone number, optional WhatsApp number, chosen plan, preferred start date, collection or delivery choice and delivery address.</li>
<li><strong>Preferences and allergies (optional):</strong> dietary preferences, allergies or intolerances and special instructions you choose to give us. Allergy information can be health data, so we only process it with your explicit consent, given in the order form.</li>
<li><strong>Your account (optional):</strong> if you create an account, your name, email address, phone number, a securely hashed password (we never see the password itself), when you last signed in, and which of your orders are saved to it. A sign-in cookie keeps you signed in for up to 60 days.</li>
<li><strong>Marketing preferences:</strong> only if you tick the separate marketing box.</li>
<li><strong>Technical data:</strong> basic, cookieless usage statistics (pages viewed, buttons clicked) that do not identify you. Optional analytics cookies are only used if you accept them.</li>
</ul>
<h2>Why we use it (and our legal basis)</h2>
<ul>
<li>To respond to and fulfil your order request — taking steps at your request before entering into a contract, and performing that contract.</li>
<li>To run your account, if you create one (sign-in, order history, re-ordering and password resets) — performing our agreement with you. You can delete your account at any time in your account settings.</li>
<li>To prepare your meals safely around allergies — your explicit consent, which you can withdraw at any time.</li>
<li>To send marketing emails — your consent, which you can withdraw at any time.</li>
<li>To keep the website secure and prevent abuse — our legitimate interests.</li>
<li>To keep business and accounting records — legal obligations.</li>
</ul>
<h2>Who we share it with</h2>
<p>We use trusted service providers to run this website: [hosting provider], [database provider], [email delivery provider] and [image storage provider]. They process data on our instructions. We do not sell your data and we do not use your order details for advertising.</p>
<h2>International transfers</h2>
<p>[Describe whether any provider stores data outside the EU/EEA and the safeguards used, e.g. Standard Contractual Clauses.]</p>
<h2>How long we keep it</h2>
<p>[State retention periods, e.g. order records for X years for accounting purposes; allergy notes deleted X months after your last order; cancelled requests deleted after X months.]</p>
<h2>Your rights</h2>
<p>You have the right to access, correct, delete, restrict or object to the processing of your personal data, to data portability, and to withdraw consent at any time. Contact us at [privacy contact email]. You can also lodge a complaint with the Information and Data Protection Commissioner (IDPC) in Malta.</p>
<h2>Changes</h2>
<p>We will update this page if our practices change.</p>`,
);

export const termsSchema = legalPageSchema(
  "Terms & Conditions",
  `${REVIEW_BANNER}
<h2>About these terms</h2>
<p>These terms apply to order requests made through this website, operated by [registered business name], trading as MC PREPS.</p>
<h2>Order requests</h2>
<p>Submitting the order form is a request, not a confirmed purchase. No payment is taken on this website. Your order is only confirmed when our team contacts you and agrees the details, including price, start date, collection or delivery, and payment.</p>
<h2>Prices and offers</h2>
<p>Prices are shown in euro. The price shown when you submit a request is a quote. Promotional offers are valid only until their stated end time and may be limited to eligible customers (for example, first-time customers). Eligibility is verified by our team before a discount is confirmed. Offers cannot be combined unless stated.</p>
<h2>Collection and delivery</h2>
<p>[Describe collection arrangements, delivery localities, delivery days, fees and what happens if nobody is available to receive a delivery.]</p>
<h2>Cancellations and changes</h2>
<p>[Describe your cancellation and change policy, including notice periods and any refunds.]</p>
<h2>Allergens and nutrition</h2>
<p>Our meals are prepared in a kitchen that may handle common allergens. Nutrition values are provided for guidance. Please tell us about any allergies before your order is confirmed. [Add your allergen statement.]</p>
<h2>Liability</h2>
<p>[Add limitation of liability wording approved by your adviser.]</p>
<h2>Contact</h2>
<p>[Business contact details.]</p>`,
);

export const cookiePolicySchema = legalPageSchema(
  "Cookie Policy",
  `${REVIEW_BANNER}
<h2>Strictly necessary</h2>
<p>We use a small number of cookies that the website needs to work, such as remembering your cookie choices, keeping you signed in to your account (if you have one), holding your personal offer deadline, and keeping administrators signed in. These do not require consent.</p>
<h2>Cookieless statistics</h2>
<p>We count page views and button clicks without cookies and without storing anything on your device. These statistics do not identify you.</p>
<h2>Optional analytics and marketing</h2>
<p>If enabled by us and accepted by you, we may use Google Analytics [and other tools] to understand how the website is used. These are only loaded after you accept them in the cookie banner. You can change your choice at any time using the "Cookie settings" link in the footer.</p>`,
);

// ── Registry ────────────────────────────────────────────────────────────────

export const CONTENT_SCHEMAS = {
  "home.hero": homeHeroSchema,
  "home.intro": homeIntroSchema,
  "home.benefits": homeBenefitsSchema,
  "home.featuredMeals": homeFeaturedMealsSchema,
  "home.howItWorks": homeHowItWorksSchema,
  "home.fulfillment": homeFulfillmentSchema,
  "home.plans": homePlansSchema,
  "home.instagram": homeInstagramSchema,
  "home.testimonials": homeTestimonialsSchema,
  "home.faq": homeFaqSchema,
  "home.finalCta": homeFinalCtaSchema,
  "home.sections": homeSectionsSchema,
  "page.about": aboutPageSchema,
  "page.howItWorks": howItWorksPageSchema,
  "page.contact": contactPageSchema,
  "page.faq": faqPageSchema,
  "page.menu": menuPageSchema,
  "page.plans": plansPageSchema,
  "page.gallery": galleryPageSchema,
  "page.offers": offersPageSchema,
  "page.deliveryAreas": deliveryAreasPageSchema,
  "page.blog": blogIndexSchema,
  "page.footer": footerSchema,
  "service.mealPrepMalta": mealPrepMaltaSchema,
  "service.healthyMealDeliveryMalta": healthyMealDeliveryMaltaSchema,
  "service.mealPlansMalta": mealPlansMaltaSchema,
  "service.highProteinMealsMalta": highProteinMealsMaltaSchema,
  "legal.privacy": privacyPolicySchema,
  "legal.terms": termsSchema,
  "legal.cookies": cookiePolicySchema,
} as const;

export type ContentKey = keyof typeof CONTENT_SCHEMAS;
export type ContentOf<K extends ContentKey> = z.infer<(typeof CONTENT_SCHEMAS)[K]>;
export const CONTENT_KEYS = Object.keys(CONTENT_SCHEMAS) as ContentKey[];

export function parseContent<K extends ContentKey>(key: K, value: unknown): ContentOf<K> {
  const raw = value && typeof value === "object" ? value : {};
  return CONTENT_SCHEMAS[key].parse(raw) as ContentOf<K>;
}

export function defaultContent<K extends ContentKey>(key: K): ContentOf<K> {
  return parseContent(key, {});
}

/** Human labels for the admin content editor. */
export const CONTENT_LABELS: Record<ContentKey, string> = {
  "home.hero": "Homepage — Hero",
  "home.intro": "Homepage — Introduction text",
  "home.benefits": "Homepage — Why MC PREPS",
  "home.featuredMeals": "Homepage — Featured meals",
  "home.howItWorks": "Homepage — How it works",
  "home.fulfillment": "Homepage — Collection & delivery",
  "home.plans": "Homepage — Plans section",
  "home.instagram": "Homepage — Instagram section",
  "home.testimonials": "Homepage — Testimonials section",
  "home.faq": "Homepage — FAQ section",
  "home.finalCta": "Homepage — Final call to action",
  "home.sections": "Homepage — Section visibility",
  "page.about": "About page",
  "page.howItWorks": "How It Works page",
  "page.contact": "Contact page",
  "page.faq": "FAQ page",
  "page.menu": "Menu page",
  "page.plans": "Packages & Pricing page",
  "page.gallery": "Gallery page",
  "page.offers": "Offers page",
  "page.deliveryAreas": "Delivery Areas page",
  "page.blog": "Blog index page",
  "page.footer": "Footer",
  "service.mealPrepMalta": "SEO page — Meal Prep Malta",
  "service.healthyMealDeliveryMalta": "SEO page — Healthy Meal Delivery Malta",
  "service.mealPlansMalta": "SEO page — Meal Plans Malta",
  "service.highProteinMealsMalta": "SEO page — High-Protein Meals Malta",
  "legal.privacy": "Privacy Policy",
  "legal.terms": "Terms & Conditions",
  "legal.cookies": "Cookie Policy",
};

/** Split plain text into paragraphs (blank-line separated). */
export function paragraphs(textValue: string | null | undefined): string[] {
  return (textValue ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
