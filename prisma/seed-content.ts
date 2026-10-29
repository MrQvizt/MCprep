/**
 * Seed content for MC PREPS. Brand-safe by default: no invented prices,
 * delivery areas, fees, addresses, testimonials or certifications.
 * Everything here is editable in the admin portal.
 */

export const BLOG_CATEGORIES = [
  { name: "Meal Prep", slug: "meal-prep", description: "Planning, prepping and getting the most from weekly meal prep." },
  { name: "Healthy Eating", slug: "healthy-eating", description: "Practical, realistic healthy eating." },
  { name: "Fitness Nutrition", slug: "fitness-nutrition", description: "Fuelling training and recovery." },
  { name: "Meal Planning", slug: "meal-planning", description: "Planning your week around your goals." },
  { name: "Nutrition Tips", slug: "nutrition-tips", description: "Understanding labels, calories and macros." },
  { name: "Life in Malta", slug: "life-in-malta", description: "Eating well around life, work and training in Malta." },
  { name: "Company News", slug: "company-news", description: "News from MC PREPS." },
];

export const FAQS = [
  {
    question: "How does ordering work?",
    answer:
      "Choose a plan, fill in the order request form and submit it. Our team then contacts you to confirm availability, your start date, collection or delivery details and payment. Your order is confirmed once we've agreed the details with you.",
    category: "Ordering",
  },
  {
    question: "Do I pay online?",
    answer:
      "No. Nothing is charged on the website. Payment is arranged directly with our team when we confirm your order.",
    category: "Ordering",
  },
  {
    question: "Do you offer collection and delivery?",
    answer:
      "Yes, both. Choose collection or delivery in the order form. For delivery, select your locality from the list — it only shows the localities we currently deliver to, with delivery days and any fees.",
    category: "Delivery",
  },
  {
    question: "Can you cater for allergies or intolerances?",
    answer:
      "Tell us about any allergies or intolerances in the order form. We'll go through them with you and confirm what's suitable before your order is confirmed. If you have a severe allergy, please speak to us before ordering.",
    category: "Allergies",
  },
  {
    question: "Are calories and macros listed?",
    answer:
      "Yes. Our meals list calories, protein, carbohydrates and fat so tracking is simple. Values are provided for guidance and can vary slightly between batches.",
    category: "Meals",
  },
  {
    question: "How do first-order offers work?",
    answer:
      "When a new-customer offer is running, you can request it in the order form by confirming it's your first order with us. Our team verifies eligibility before your final price is confirmed. Offers can't be combined.",
    category: "Offers",
  },
];

/** Example localities — seeded as UNCONFIRMED. The owner must enable the ones actually served. */
export const EXAMPLE_LOCALITIES = [
  ["Sliema", "sliema"],
  ["St Julian's", "st-julians"],
  ["Gżira", "gzira"],
  ["Msida", "msida"],
  ["Birkirkara", "birkirkara"],
  ["Mosta", "mosta"],
  ["Naxxar", "naxxar"],
  ["Valletta", "valletta"],
  ["Swieqi", "swieqi"],
  ["Attard", "attard"],
  ["Qormi", "qormi"],
  ["Marsaskala", "marsaskala"],
] as const;

export const LISTINGS = [
  { platform: "Google Business Profile", sortOrder: 0 },
  { platform: "Apple Business Connect", sortOrder: 1 },
  { platform: "Bing Places for Business", sortOrder: 2 },
];

export const GALLERY_WORDS = ["Fuel", "Lift", "Prep", "Macros", "Malta", "Repeat"];

export const HALLOWEEN_PROMOTION = {
  slug: "halloween-special",
  name: "MC PREPS Halloween Special",
  theme: "HALLOWEEN" as const,
  headline: "Halloween fuel deal",
  subheadline: "Your first plan. Your special price.",
  description: "Get {discount} off your first meal plan when you order before the countdown ends.",
  badgeText: "Halloween special",
  ctaText: "Claim your first-order offer",
  discountType: "PERCENTAGE" as const,
  discountValue: 2000, // 20% — EXAMPLE ONLY, confirm before enabling
  audience: "NEW_CUSTOMERS" as const,
  terms:
    "New customers only — one discounted plan per customer. Eligibility is verified by our team before your price is confirmed. Cannot be combined with other offers. The offer ends at the time shown on the countdown.",
  perCustomerLimit: 1,
};

const p = (s: string) => `<p>${s}</p>`;
const h2 = (s: string) => `<h2>${s}</h2>`;

export const BLOG_DRAFTS: { slug: string; title: string; excerpt: string; category: string; primaryTopic: string; html: string }[] = [
  {
    slug: "meal-prep-malta-choosing-a-weekly-plan",
    title: "Meal Prep in Malta: How to Choose the Right Weekly Plan",
    excerpt: "1 week, 2 weeks or a month? A practical guide to picking a meal prep plan that fits your training, work and budget.",
    category: "meal-prep",
    primaryTopic: "meal prep Malta",
    html: [
      p("Choosing a meal prep plan is less about finding the “best” plan and more about finding the one you'll actually stick to. Here's a simple way to decide."),
      h2("Start with your week, not your goal"),
      p("Look at a normal week: when you train, when you work late, and which meals you usually skip or grab on the go. Prepared meals help most in the gaps — the lunches and dinners where you'd otherwise improvise."),
      h2("Try a shorter plan first"),
      p("If you're new to meal prep, a 1-week plan lets you check portion sizes, taste and how the meals fit around your schedule before committing to longer."),
      h2("Go longer once it works"),
      p("Two weeks or a month reduces the number of decisions you make and makes consistency easier. Consistency, more than any single meal, is what moves you towards your goals."),
      h2("Check the practical details"),
      p("Before ordering, check whether collection or delivery suits you better, which <a href=\"/delivery-areas\">localities are covered</a>, and how payment is arranged. Our <a href=\"/plans\">plans page</a> lists what each plan includes."),
    ].join("\n"),
  },
  {
    slug: "healthy-eating-in-malta-for-busy-professionals",
    title: "Healthy Eating in Malta for Busy Professionals",
    excerpt: "Long days, late meetings and a packed social calendar — practical ways to keep eating well without spending hours in the kitchen.",
    category: "life-in-malta",
    primaryTopic: "healthy eating Malta",
    html: [
      p("When the working day runs long, food is often the first thing to slide. These habits help keep things on track without needing perfect willpower."),
      h2("Decide before you're hungry"),
      p("Most poor food choices happen when you're already hungry and short on time. Having meals ready in the fridge removes the decision entirely."),
      h2("Plan around your real schedule"),
      p("If you know Wednesday is your late day, make sure there's something ready for Wednesday. Planning for your busiest days matters more than planning for your easy ones."),
      h2("Keep protein in every meal"),
      p("Building meals around a protein source is a simple, practical habit — it makes meals more filling and easier to plan."),
      h2("Make it easy to track, if you track"),
      p("If you count calories or macros, meals with the numbers already listed save time. Our <a href=\"/menu\">menu</a> lists calories and macros for our meals."),
    ].join("\n"),
  },
  {
    slug: "high-protein-meal-prep-tips",
    title: "High-Protein Meal Prep: Practical Tips for Active Lifestyles",
    excerpt: "Practical ways to keep protein consistent across your week — whether you cook yourself or use prepared meals.",
    category: "fitness-nutrition",
    primaryTopic: "high protein meal prep Malta",
    html: [
      p("If you train regularly, keeping your protein intake consistent across the week is one of the most practical habits you can build. Here are some simple ways to do it."),
      h2("Know your target — and get it set properly"),
      p("Protein needs vary with body size, training and goals. A registered dietitian or qualified nutritionist can help you set a target that suits you."),
      h2("Spread it across the day"),
      p("Rather than relying on one large meal, many people find it easier to include a solid protein source in each meal."),
      h2("Batch the hard part"),
      p("Cooking proteins in bulk is the most time-consuming part of meal prep. Prepared meals take this off your plate entirely — see our <a href=\"/high-protein-meals-malta\">high-protein meals</a>."),
      h2("Track for a couple of weeks"),
      p("Even a short period of tracking shows you where the gaps are. Meals with the macros already listed make this much quicker."),
    ].join("\n"),
  },
  {
    slug: "prepared-meal-plans-simplify-your-week",
    title: "How Prepared Meal Plans Can Simplify Your Working Week",
    excerpt: "Fewer decisions, less shopping and more consistency — what a prepared meal plan really changes day to day.",
    category: "meal-planning",
    primaryTopic: "meal plans Malta",
    html: [
      p("A prepared meal plan isn't just about food — it changes how your week runs. Here's what it takes off your list."),
      h2("Less planning and shopping"),
      p("No weekly menu to plan and fewer supermarket runs. The time adds up quickly over a month."),
      h2("Fewer daily decisions"),
      p("When a meal is already in the fridge, you don't have to decide what to eat after a long day — which makes it easier to stay consistent."),
      h2("Predictable portions"),
      p("Consistent portions with listed macros make it easier to see how your eating lines up with your goals."),
      h2("How ordering works with MC PREPS"),
      p("Choose a plan, send an order request and we confirm the details with you personally. See <a href=\"/how-it-works\">how it works</a>."),
    ].join("\n"),
  },
  {
    slug: "choosing-healthy-meal-delivery-in-malta",
    title: "What to Consider When Choosing Healthy Meal Delivery in Malta",
    excerpt: "Delivery areas, macros, allergens and how ordering works — the questions worth asking before you sign up.",
    category: "meal-prep",
    primaryTopic: "healthy meal delivery Malta",
    html: [
      p("Healthy meal delivery can save a lot of time — but services differ. These are the questions worth asking first."),
      h2("Do they deliver to your area?"),
      p("Check the delivery localities, delivery days and any fees before ordering. Collection can be a good option if your area isn't covered. Here are <a href=\"/delivery-areas\">our delivery areas</a>."),
      h2("Are the nutrition values listed?"),
      p("If you track your intake, listed calories and macros make a big difference."),
      h2("How are allergies handled?"),
      p("Look for a clear way to tell the business about allergies and intolerances, and confirmation before your order goes ahead."),
      h2("How does payment work?"),
      p("Understand when and how you pay, and what happens if you need to change or cancel."),
    ].join("\n"),
  },
  {
    slug: "how-to-read-calories-and-macros-on-prepared-meals",
    title: "How to Read Calories and Macros on Prepared Meals",
    excerpt: "What calories, protein, carbs and fat on a meal label actually tell you — and how to use them.",
    category: "nutrition-tips",
    primaryTopic: "macro tracked meals Malta",
    html: [
      p("Most prepared meals list four numbers: calories, protein, carbohydrates and fat. Here's how to read them."),
      h2("Calories"),
      p("Calories (kcal) measure the energy in a meal. Your needs depend on your body, activity level and goals."),
      h2("The three macronutrients"),
      p("Protein and carbohydrates provide roughly 4 kcal per gram and fat roughly 9 kcal per gram. That's why a small amount of fat can add noticeably to a meal's calories."),
      h2("Why the numbers don't always add up exactly"),
      p("The calorie figure on a label may not exactly match the sum of the macros. Rounding, fibre and the way values are calculated all play a part — small differences are normal."),
      h2("Using the numbers"),
      p("If you track, log the meal as listed. If you don't, the numbers still help you compare meals. You'll find calories and macros on our <a href=\"/menu\">menu</a>."),
    ].join("\n"),
  },
];
