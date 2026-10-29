# MC PREPS — Owner manual

This guide explains how to run the website day to day. You never need to touch code.

Sign in at **yourdomain/admin** with the email and password you were given. If you forget your password, ask
the person who set up the site to run `npm run admin:create` again with your email (this resets the password).

> **Tip:** Everything you change is saved straight away and appears on the website within seconds.
> Every important change is recorded in **Activity log**, so you can always see who changed what.

---

## 1. The dashboard

**Dashboard** shows new order requests, requests waiting for you to contact the customer, confirmed orders,
the promotion currently running (with its countdown), your active plans and prices, and any problems — for example
an email that couldn't be sent. Numbers are always real; if there's no data yet you'll see an empty state.

---

## 2. Orders — following up with customers

Every order is a **request**: nobody has paid. Your job is to contact the customer and confirm the details.

1. Open **Orders**. New requests have the **New** badge. You also receive an email for each request.
2. Click a request to see everything: plan, collection or delivery, start date, preferences, allergies (private),
   and the quoted price.
3. Press **WhatsApp** to open a chat with the customer with a ready-made message including their name and order
   reference (or use the email link).
4. After contacting them, press **Mark contacted**. When everything is agreed, enter the **agreed final price**
   if it differs and press **Mark confirmed**. Later use **In preparation** and **Completed** — or **Cancel**.
5. Add **internal notes** (only visible to admins), e.g. "Customer prefers Sunday delivery".

Each change is kept in the order's **status history**. The price the customer was quoted never changes, even if you
later change your plan prices.

**Payment** is tracked separately ("Payment not collected" by default). When you receive payment (cash, bank
transfer, Revolut…) update the payment status on the order.

**Export:** use **Export CSV** on the Orders page (respects your filters) for your records or accountant.

### First-order offers — checking eligibility

If a customer requested a **new-customer** offer, the order shows an **eligibility** panel:

- **New customer (preliminary)** — no previous orders were found for their email or phone.
- **Eligibility pending review** — something needs a human look (e.g. an open request already exists).
- **Returning customer — likely not eligible** — the email or phone matches a customer who has ordered before or
  already used a first-order offer.

The website never tells the customer about these checks. You decide: press **Approve promotion** or
**Reject promotion** (add a short note). When rejecting, tell the customer politely and confirm the normal price.
Returning customers can always order at the normal price.

---

## 3. Customers

**Customers** lists everyone who has sent a request, with their order history. You can:

- mark someone as an **existing customer** (e.g. they ordered via Instagram before the website existed) so they
  don't get first-order offers, or as a **first-time customer** to override the automatic check;
- **export** a customer's data if they ask for a copy, or **anonymise** them if they ask to be deleted
  (prices are kept for your accounts; names, contact details, addresses and allergies are removed).

---

## 4. Meals — uploading meals and photos

1. **Meals → New meal**.
2. Enter the name and a short description. Add the photo (upload or choose from the Media library) and write a
   short description of the photo (alt text) — e.g. "Chicken Pokébowl with rice, edamame and greens".
3. Enter calories, protein, carbs and fat **only if you know them**. Leave blank otherwise. Tick **verified** once
   checked against the current recipe.
4. Tick the allergens the meal contains (only if you've confirmed them) and add dietary tags if relevant.
5. **Featured** meals appear on the homepage. **Published** controls whether the meal is visible at all.
6. Use the arrows on the Meals list to change the order.

The Chicken Pokébowl macros (544 kcal · 45 g protein · 63 g carbs · 7 g fat) were copied from your Instagram —
please check them against the current recipe and tick *verified*.

---

## 5. Plans & prices — editing prices

1. **Plans & prices** → click a plan (1 Week, 2 Weeks, 1 Month).
2. Change the **price** (leave it empty to show "Price confirmed with you"), the number of meals, the description
   and the list of what's included (one item per line).
3. **Recommended** highlights one plan (e.g. 2 Weeks) on the website.
4. Save. Existing orders keep the price they were quoted.

You can add new plans or switch a plan off (**Active**). Plans that already have orders are archived instead of deleted.

---

## 6. Promotions — running a Halloween sale

1. **Promotions** → open **MC PREPS Halloween Special** (it starts as a draft).
2. Check the wording. `{discount}` is replaced automatically with your discount (e.g. "20%"), so the text always
   matches the real offer.
3. Set the **discount** (e.g. 20%, or a fixed amount like €10) and, if you like, a **maximum discount**.
4. Choose **who can use it**: *New customers only* for a first-order offer.
5. Choose the **plans** it applies to (or all plans).
6. Set the **start** and **end** time (Malta time). For a 72-hour flash sale, use the **"72 hours from now"** button.
7. Keep **Show countdown** and **Show on homepage** ticked.
8. Tick **Enabled** and save. Use the **preview** on the page to see exactly what customers will see.

The countdown counts down to the real end time — it never resets. When it ends, the discount stops automatically,
the banner disappears (or shows an "offer ended" message if you chose that), and new orders are priced normally.

Optional: **Offer pages** lets you publish a dedicated page such as `yourdomain/offers/halloween` for Instagram
stories or ads. These pages are hidden from Google by default (they are temporary).

### Preparing Black Friday or Christmas

1. Open last campaign → **Reuse for another occasion**. A disabled copy is created.
2. Rename it (e.g. "Black Friday 2026"), pick the theme, update the headline, discount and dates.
3. Enable it when you're ready — or set it now with a future start date; it switches on by itself at the start time.

Coupon codes: tick **Code required** and set a code (e.g. FUEL10) to make an offer that only works with the code.
"Selected customers" offers always need a code.

---

## 7. Homepage & page text

**Homepage & pages** lists every editable block: the hero ("FUEL YOUR LIFT."), Why MC PREPS, How it works,
Collection & delivery, the final call to action, the About page, the four Malta SEO pages, the footer and the legal
pages. Click one, edit the fields, save. **Section visibility** lets you hide homepage sections.

Legal pages (privacy, terms, cookies) are templates — have them reviewed, edit everything in [square brackets],
then tick **Reviewed by owner**.

---

## 8. Photos — Media library & Instagram gallery

- **Media library** holds every image. Upload several at once, add alt text, replace a photo, or delete photos that
  aren't used anywhere (the site tells you where an image is used).
- **Instagram gallery** controls the photo grid on the homepage and gallery page. Add a photo, paste the link to the
  matching Instagram post (or leave blank to link to your profile), and tick **Featured** to show it on the homepage.
  Remove the six placeholder tiles once you've added real photos.

---

## 9. FAQs and testimonials

- **FAQs**: add, edit, reorder, hide. "Show on homepage" adds a question to the homepage FAQ.
- **Testimonials**: only add genuine quotes from customers who gave permission — record when and how they agreed.
  A testimonial can't be published without that consent record.

---

## 10. Blog — publishing an article

1. **Blog** → open one of the drafts (six SEO-focused drafts are prepared) or **New article**.
2. Write or edit the article. Use headings, short paragraphs and links to your plans/menu (suggestions are shown).
3. Add a cover image with alt text, choose a category, check the SEO title and description.
4. Check the facts, untick **Needs fact-check**, then **Publish now** — or **Schedule** for a future date.
5. Use **Preview** to see a draft before publishing.

If you change the address (slug) of a published article, a redirect is created so old links keep working.

---

## 11. SEO & Google

- **SEO & Google visibility** lists every page with its Google title and description. Click a page to edit them and
  see a preview of how it may look in Google (Google sometimes rewrites titles — that's normal). Fix anything the
  **quality assistant** flags; each issue explains what to do in plain words.
- **Redirects**: if you remove or rename a page, send its old address to a new one (301 redirect).
- **Google & listings**:
  - *Search Console*: paste the verification code, verify, then submit your sitemap (`yourdomain/sitemap.xml`).
    The site doesn't pull Search Console numbers automatically — open Search Console to see clicks and searches.
  - *Google Business Profile*: work through the checklist (claim, verify, category, service areas, hours, real
    photos, website link) and paste your profile link and review link. Ask happy *and* unhappy customers alike for
    honest reviews — never only the happy ones.
  - *Listings tracker*: record where your business is listed (Google, Apple Business Connect, Bing Places, Maltese
    directories) and when you last checked the details. Keep name, phone and address identical everywhere.

---

## 12. Tracking Google performance

- **Growth & performance** shows order requests, which plans and campaigns bring requests, WhatsApp clicks, popular
  pages and meals, and where visitors come from — using only real data from your website.
- For Google Search data (searches, clicks, positions), use Google Search Console.
- Optional: add a Google Analytics 4 ID in **Business settings → Tracking**. It only loads for visitors who accept
  cookies.

---

## 13. Delivery areas & collection

**Delivery & collection**:

- Switch on only the localities you really deliver to — customers can only choose those. The example localities
  (Sliema, Gżira, Msida …) start **switched off**.
- For each locality you can set delivery days, a time window, a delivery fee and a minimum order (leave blank if none).
- Add your **collection point(s)** with days/times; choose whether the address is shown publicly.
- A locality can get its own page on the website only if you write genuinely useful, specific information for it.

---

## 14. Business information

**Business settings** holds your name, registered name, VAT number, address (and whether to show it), opening hours,
contact email, the inbox that receives orders, phone, WhatsApp number and messages, Instagram, logos and favicon,
order form options, the preview notice, tracking codes and SEO defaults. Use **Send test email** after changing the
order inbox.

---

## 15. Admin users

Only the **Owner** can add staff. Give each person their own account and the lowest role they need:

- **Owner** — everything, including staff accounts.
- **Administrator** — everything except staff accounts.
- **Content editor** — meals, photos, pages, blog and SEO; no orders, customers or settings.

Deactivating a user signs them out immediately. Change your own password in **My account**.

---

## 16. Before launch — and every month

**Launch checklist** shows what's still missing (real logo, prices, delivery areas, emails, legal review, Google
setup…). Work through it until everything is green, then switch off the preview notice.

Every month, tick through the **monthly checklist** on the same page: review performance and searches, add useful
content or photos, check listing details, reply to reviews, plan promotions, verify delivery areas and check that
order emails arrive. **Site health** runs automatic checks every day and lists anything that needs attention.
