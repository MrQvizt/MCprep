"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, Flame, Loader2, Lock, Tag, Truck, Store } from "lucide-react";
import { readAttribution, useTrack } from "@/components/analytics/analytics-provider";
import { Countdown } from "@/components/shared/countdown";
import { WhatsAppIcon } from "@/components/shared/icons";
import { formatMoney } from "@/lib/money";
import { orderFormSchema, type OrderFormInput, type OrderFormValues, type OrderRequestInput } from "@/lib/orders/schema";
import { evenSplit, isPackage, mealSelectionProblem, packageLabel, selectionTotal, type MealChoice } from "@/lib/packages";
import { formatCalendarDate, formatWeekdays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { startOfferWindowAction } from "../offer-actions";
import { getQuoteAction, submitOrderAction, type QuoteView } from "./actions";
import { OrderCutoffCard, type OrderCutoffProps } from "@/components/public/order-cutoff-notice";
import { DishPicker, type DishOption } from "./dish-picker";
import { PackageBuilder } from "./package-builder";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; theme?: string }) => string };
  }
}

export interface OrderFormProps {
  brandName: string;
  currency: string;
  serverNow: string;
  plans: {
    slug: string;
    name: string;
    tagline: string | null;
    durationDays: number;
    mealsIncluded: number | null;
    priceCents: number | null;
    isRecommended: boolean;
    savingsLabel: string | null;
    mealsPerDay: number | null;
    daysPerWeek: number | null;
    isSubscription: boolean;
    mealsPerWeek: number | null;
    perMealCents: number | null;
    offerPriceCents: number | null;
    offerFirstOrderOnly: boolean;
  }[];
  defaultPlanSlug: string;
  /** Contact details of the signed-in customer, if any. */
  prefill?: { fullName: string; email: string; phone: string } | null;
  dishes: DishOption[];
  initialSelections: MealChoice[];
  /** Live offer with a personal deadline ("order within 2 hours"). */
  intro: {
    name: string;
    headline: string;
    discountType: string;
    discountValue: number;
    label: string;
    windowMinutes: number;
    endsAt: string;
    startedAt: string | null;
    terms: string | null;
    newCustomersOnly: boolean;
  } | null;
  initialCoupon: string;
  initialQuote: QuoteView | null;
  areas: {
    id: string;
    name: string;
    region: string;
    deliveryFeeCents: number | null;
    minOrderCents: number | null;
    deliveryDays: number[];
    deliveryWindow: string | null;
    notes: string | null;
  }[];
  collectionPoints: {
    id: string;
    name: string;
    address: string | null;
    instructions: string | null;
    availableDays: number[];
    timeWindows: string | null;
  }[];
  fulfillment: {
    deliveryEnabled: boolean;
    collectionEnabled: boolean;
    deliveryInfo: string;
    collectionInfo: string;
    noDeliveryAreasMessage: string;
    gozoNote: string;
  };
  form: {
    askWhatsapp: boolean;
    askStartDate: boolean;
    askDietaryPreferences: boolean;
    askAllergies: boolean;
    askSpecialInstructions: boolean;
    mealPreferenceOptions: string[];
    marketingOptInEnabled: boolean;
    marketingConsentText: string;
    noPaymentNotice: string;
    allergenNotice: string;
  };
  declarationText: string;
  minStartDate: string;
  maxStartDate: string;
  /** Weekly ordering deadline ("order by Wed 4 Nov, 4pm for delivery from Mon 9 Nov"). */
  cutoff: OrderCutoffProps | null;
  whatsappHref: string | null;
  turnstileSiteKey: string | null;
}

const REGION_LABELS: Record<string, string> = { MALTA: "Malta", GOZO: "Gozo", COMINO: "Comino" };

const inputClass =
  "block h-12 w-full border border-white/20 bg-white/[0.04] px-4 text-base text-white placeholder:text-white/35 transition-colors focus:border-white focus:outline-none aria-invalid:border-red-400";
const textareaClass =
  "block min-h-24 w-full border border-white/20 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/35 transition-colors focus:border-white focus:outline-none aria-invalid:border-red-400";

function FieldBlock({
  label,
  error,
  hint,
  optional,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/80">
        <span>{label}</span>
        {optional && <span className="text-[0.65rem] font-normal normal-case tracking-normal text-fog">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1.5 text-sm text-red-300">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : (
        hint && <p className="text-sm text-fog">{hint}</p>
      )}
    </div>
  );
}

function StepHeading({ n, title, description }: { n: number; title: string; description?: string }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center border border-white/30 font-display text-sm font-black">
        {n}
      </span>
      <div>
        <h2 className="display-sm text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-fog">{description}</p>}
      </div>
    </div>
  );
}

export function OrderForm(props: OrderFormProps) {
  const router = useRouter();
  const track = useTrack();
  const uid = useId();
  const money = (c: number) => formatMoney(c, props.currency, { hideZeroDecimals: true });

  const deliveryPossible = props.fulfillment.deliveryEnabled;
  const collectionPossible = props.fulfillment.collectionEnabled;
  const defaultFulfillment = collectionPossible && !(deliveryPossible && props.areas.length > 0) ? "COLLECTION" : deliveryPossible ? "DELIVERY" : "COLLECTION";

  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormInput, unknown, OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    mode: "onTouched",
    defaultValues: {
      planSlug: props.defaultPlanSlug,
      mealSelections: props.initialSelections,
      fullName: props.prefill?.fullName ?? "",
      email: props.prefill?.email ?? "",
      phone: props.prefill?.phone ?? "",
      whatsappNumber: "",
      fulfillmentMethod: defaultFulfillment,
      deliveryAreaId: "",
      addressLine1: "",
      addressLine2: "",
      postalCode: "",
      collectionPointId: props.collectionPoints.length === 1 ? props.collectionPoints[0].id : "",
      preferredStartDate: "",
      mealPreference: "",
      dietaryPreferences: "",
      allergies: "",
      specialInstructions: "",
      notes: "",
      couponCode: "",
      firstOrderDeclared: false,
      allergyConsent: false,
      marketingOptIn: false,
      website: "",
    },
  });

  const [planSlug, fulfillmentMethod, deliveryAreaId, firstOrderDeclared, allergies, phone, watchedSelections] = useWatch({
    control,
    name: ["planSlug", "fulfillmentMethod", "deliveryAreaId", "firstOrderDeclared", "allergies", "phone", "mealSelections"],
  });
  const mealSelections = useMemo(() => (watchedSelections ?? []) as MealChoice[], [watchedSelections]);

  // ── Personal offer window ("order within 2 hours") ────────────────────────
  // Starts the first time the visitor sees the offer; the server keeps the start time.
  const [windowStartedAt, setWindowStartedAt] = useState<string | null>(props.intro?.startedAt ?? null);
  const [windowServerNow, setWindowServerNow] = useState(props.serverNow);
  useEffect(() => {
    if (!props.intro || windowStartedAt) return;
    let cancelled = false;
    void startOfferWindowAction().then((r) => {
      if (cancelled || !r) return;
      setWindowServerNow(r.serverNow);
      setWindowStartedAt(r.startedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [props.intro, windowStartedAt]);
  const introDeadline = useMemo(() => {
    if (!props.intro || !windowStartedAt) return null;
    const personal = new Date(windowStartedAt).getTime() + props.intro.windowMinutes * 60_000;
    return new Date(Math.min(personal, new Date(props.intro.endsAt).getTime())).toISOString();
  }, [props.intro, windowStartedAt]);

  // ── Live server-side quote ────────────────────────────────────────────────
  const [quote, setQuote] = useState<QuoteView | null>(props.initialQuote);
  const [couponInput, setCouponInput] = useState(props.initialCoupon);
  const [appliedCoupon, setAppliedCoupon] = useState(props.initialCoupon);
  const [quotePending, startQuote] = useTransition();
  const lastQuoteKey = useRef(
    JSON.stringify([props.defaultPlanSlug, props.initialCoupon, false, defaultFulfillment, "", props.intro?.startedAt ?? null]),
  );

  useEffect(() => {
    const key = JSON.stringify([planSlug, appliedCoupon, Boolean(firstOrderDeclared), fulfillmentMethod, deliveryAreaId ?? "", windowStartedAt]);
    if (key === lastQuoteKey.current) return;
    lastQuoteKey.current = key;
    startQuote(async () => {
      const q = await getQuoteAction({
        planSlug,
        couponCode: appliedCoupon || undefined,
        firstOrderDeclared: Boolean(firstOrderDeclared),
        fulfillmentMethod,
        deliveryAreaId: deliveryAreaId || undefined,
      });
      setQuote(q);
    });
  }, [planSlug, appliedCoupon, firstOrderDeclared, fulfillmentMethod, deliveryAreaId, windowStartedAt]);

  // ── Analytics: begin_order once, select_plan on change ────────────────────
  const began = useRef(false);
  const onFirstInteraction = () => {
    if (began.current) return;
    began.current = true;
    track("begin_order", { planSlug });
  };
  const lastPlan = useRef(planSlug);
  useEffect(() => {
    if (lastPlan.current !== planSlug) {
      lastPlan.current = planSlug;
      track("select_plan", { planSlug });
    }
  }, [planSlug, track]);

  // ── Spam heuristics, idempotency, Turnstile ───────────────────────────────
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  const idempotencyKey = useRef<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const selectedPlan = props.plans.find((p) => p.slug === planSlug) ?? props.plans[0];
  const packages = useMemo(() => props.plans.filter(isPackage), [props.plans]);
  const otherPlans = useMemo(() => props.plans.filter((p) => !isPackage(p)), [props.plans]);
  const perWeek = selectedPlan?.mealsPerWeek ?? null;

  // Keep dish choices in step with the package: re-mix if untouched, trim if over.
  const customised = useRef(false);
  const setSelections = (next: MealChoice[], byUser = true) => {
    if (byUser) customised.current = true;
    setValue("mealSelections", next, { shouldDirty: true });
    if (errors.mealSelections) clearErrors("mealSelections");
  };
  const lastPerWeek = useRef(perWeek);
  useEffect(() => {
    if (lastPerWeek.current === perWeek) return;
    lastPerWeek.current = perWeek;
    if (!perWeek) return;
    if (!customised.current) {
      setValue("mealSelections", evenSplit(props.dishes.map((d) => d.id), perWeek));
      return;
    }
    let over = selectionTotal(mealSelections) - perWeek;
    if (over <= 0) return;
    const trimmed = [...mealSelections].reverse().map((c) => {
      const cut = Math.min(c.quantity, over);
      over -= cut;
      return { ...c, quantity: c.quantity - cut };
    });
    setValue("mealSelections", trimmed.reverse().filter((c) => c.quantity > 0));
  }, [perWeek, mealSelections, props.dishes, setValue]);
  const selectedArea = props.areas.find((a) => a.id === deliveryAreaId) ?? null;
  const areasByRegion = useMemo(() => {
    const groups = new Map<string, OrderFormProps["areas"]>();
    for (const a of props.areas) groups.set(a.region, [...(groups.get(a.region) ?? []), a]);
    return [...groups.entries()];
  }, [props.areas]);

  const couponValid = quote?.couponStatus === "APPLIED" || quote?.couponStatus === "NOT_BETTER";
  const showDeclaration = Boolean(quote?.firstOrderOffer) || quote?.promotion?.audience === "NEW_CUSTOMERS";

  const applyCoupon = () => setAppliedCoupon(couponInput.trim().toUpperCase());
  const sameAsPhone = () => setValue("whatsappNumber", phone, { shouldValidate: true });

  const submit = async (values: OrderFormValues) => {
      setFormError(null);
      if (perWeek) {
        const problem = mealSelectionProblem(values.mealSelections, perWeek, props.dishes.map((d) => d.id));
        if (problem) {
          setError("mealSelections", { type: "manual", message: problem });
          setFormError(problem);
          document.getElementById(`${uid}-dishes`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
      idempotencyKey.current ??= crypto.randomUUID();
      track("submit_order", { planSlug: values.planSlug });
      const payload: OrderRequestInput = {
        ...values,
        couponCode: couponValid && appliedCoupon ? appliedCoupon : undefined,
        idempotencyKey: idempotencyKey.current,
        elapsedMs: mountedAt.current ? Date.now() - mountedAt.current : undefined,
        turnstileToken,
        attribution: readAttribution(),
      };
      const result = await submitOrderAction(payload);
      if (result.ok && result.data) {
        track("order_request_success", { planSlug: values.planSlug });
        setNavigating(true);
        router.push(result.data.redirectTo);
        return;
      }
      const fieldErrors = result.fieldErrors ?? {};
      let focused = false;
      for (const [name, message] of Object.entries(fieldErrors)) {
        if (name === "couponCode") {
          setFormError(message);
          continue;
        }
        setError(name as FieldPath<OrderFormInput>, { type: "server", message }, { shouldFocus: !focused });
        focused = true;
      }
      setFormError(result.message ?? "Please check the highlighted fields.");
  };
  const onInvalid = () => setFormError("Please check the highlighted fields.");

  const busy = isSubmitting || navigating;
  /** Step numbers shift down by one when there's no dish step. */
  const stepN = (n: number) => (perWeek && props.dishes.length > 0 ? n : n - 1);
  const err = (name: keyof OrderFormInput) => errors[name]?.message as string | undefined;
  const aria = (name: keyof OrderFormInput) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${uid}-${String(name)}-error` : undefined,
  });
  const fid = (name: string) => `${uid}-${name}`;

  // ── Summary values ────────────────────────────────────────────────────────
  const chosenDishes = props.dishes
    .map((d) => ({ ...d, quantity: mealSelections.find((c) => c.mealId === d.id)?.quantity ?? 0 }))
    .filter((d) => d.quantity > 0);
  const base = quote?.basePriceCents ?? selectedPlan?.priceCents ?? null;
  const total = quote?.totalCents ?? base;
  const discount = quote?.discountCents ?? 0;
  const deliveryFee = quote?.deliveryFeeCents ?? 0;

  const summary = (
    <div className="light border border-white bg-paper p-6 text-ink sm:p-7" aria-live="polite" aria-busy={quotePending}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="display-sm">Order summary</h2>
        {quotePending && <Loader2 className="size-4 animate-spin text-smoke" aria-label="Updating price" />}
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-smoke">{perWeek ? "Package" : "Plan"}</dt>
          <dd className="text-right font-semibold">
            {perWeek ? packageLabel(selectedPlan) : selectedPlan?.name}
            {perWeek ? (
              <span className="block text-xs font-normal text-smoke">
                {perWeek} meals a week · {selectedPlan.isSubscription ? "Monthly (4 weeks)" : "1 week"}
                {selectedPlan.perMealCents !== null ? ` · ${money(selectedPlan.perMealCents)}/meal` : ""}
              </span>
            ) : selectedPlan?.mealsIncluded ? (
              <span className="block text-xs font-normal text-smoke">{selectedPlan.mealsIncluded} meals</span>
            ) : null}
          </dd>
        </div>
        {perWeek && chosenDishes.length > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-smoke">Dishes / week</dt>
            <dd className="text-right text-xs leading-relaxed">
              {chosenDishes.map((d) => (
                <span key={d.id} className="block">
                  {d.quantity}× {d.name}
                </span>
              ))}
              {selectionTotal(mealSelections) !== perWeek && (
                <span className="mt-1 block font-semibold text-red-700">
                  {selectionTotal(mealSelections)} of {perWeek} chosen
                </span>
              )}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-smoke">{selectedPlan?.isSubscription ? "First 4 weeks" : perWeek ? "Price" : "Plan price"}</dt>
          <dd className={cn("tabular font-semibold", discount > 0 && "text-smoke line-through")}>
            {base === null ? "Confirmed with you" : money(base)}
          </dd>
        </div>
        {quote?.promotion && discount > 0 && (
          <div className="flex justify-between gap-4">
            <dt>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Tag className="size-3.5" aria-hidden="true" /> {quote.promotion.name}
              </span>
              {quote.requiresVerification && <span className="block text-xs text-smoke">Requested — subject to verification</span>}
            </dt>
            <dd className="tabular font-semibold">−{money(discount)}</dd>
          </div>
        )}
        {fulfillmentMethod === "DELIVERY" && (
          <div className="flex justify-between gap-4">
            <dt className="text-smoke">Delivery{selectedArea ? ` · ${selectedArea.name}` : ""}</dt>
            <dd className="tabular font-semibold">
              {!selectedArea ? "Choose locality" : deliveryFee > 0 ? money(deliveryFee) : selectedArea.deliveryFeeCents === null ? "Confirmed with you" : "Free"}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-ink/15 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">
          {quote?.requiresVerification ? "Estimated total" : "Quoted total"}
          <span className="block text-[0.65rem] font-normal normal-case tracking-normal text-smoke">{props.currency}, incl. any listed fees</span>
        </p>
        <p className="font-display text-4xl font-black tabular leading-none">{total === null ? "—" : money(total)}</p>
      </div>
      {selectedPlan?.isSubscription && base !== null && (
        <p className="mt-3 text-xs text-smoke">
          Then {money(base)} every 4 weeks. Cancel or pause any time — just tell us.
        </p>
      )}
      {quote?.promotion && (
        <div className="mt-5 border-t border-ink/15 pt-4">
          <Countdown
            endsAt={quote.promotion.endsAt}
            serverNow={windowServerNow}
            size="sm"
            label={props.intro && introDeadline === quote.promotion.endsAt ? "Your price is held for" : "Offer ends in"}
            refreshOnEnd={false}
            endedLabel="This offer has ended — the price will update."
          />
        </div>
      )}
      <p className="mt-5 flex gap-2.5 bg-mist p-3 text-sm leading-relaxed">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{props.form.noPaymentNotice}</span>
      </p>
    </div>
  );

  return (
    <form onSubmit={(e) => void handleSubmit(submit, onInvalid)(e)} onFocusCapture={onFirstInteraction} noValidate className="container-site grid gap-10 pb-32 lg:grid-cols-12 lg:gap-14 lg:pb-24">
      {props.turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => {
            if (turnstileRef.current && window.turnstile) {
              window.turnstile.render(turnstileRef.current, { sitekey: props.turnstileSiteKey!, callback: setTurnstileToken, theme: "dark" });
            }
          }}
        />
      )}

      <div className="space-y-14 lg:col-span-7">
        {props.cutoff && <OrderCutoffCard {...props.cutoff} />}

        {props.intro && introDeadline && (
          <IntroOfferCard
            intro={props.intro}
            deadline={introDeadline}
            serverNow={windowServerNow}
            money={money}
            firstWeekCents={quote?.firstWeekCents ?? null}
            perWeek={perWeek}
            declared={Boolean(firstOrderDeclared)}
            applied={Boolean(quote?.promotion && quote.promotion.name === props.intro.name && discount > 0)}
          >
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-white" {...register("firstOrderDeclared")} />
              <span>{props.declarationText}</span>
            </label>
          </IntroOfferCard>
        )}

        {/* 1 — Package */}
        <fieldset>
          <legend className="contents">
            <StepHeading n={1} title={packages.length > 0 ? "Build your package" : "Choose your plan"} />
          </legend>
          <input type="hidden" {...register("planSlug")} />
          {packages.length > 0 ? (
            <PackageBuilder
              packages={packages}
              selectedSlug={isPackage(selectedPlan) ? selectedPlan.slug : packages[0].slug}
              onSelect={(slug) => setValue("planSlug", slug, { shouldDirty: true })}
              money={money}
            />
          ) : null}
          {otherPlans.length > 0 && (
            <div className={cn(packages.length > 0 && "mt-8")}>
              {packages.length > 0 && (
                <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/80">Or choose another plan</p>
              )}
          <div className="grid gap-3 sm:grid-cols-3">
            {otherPlans.map((p) => {
              const checked = p.slug === planSlug;
              return (
                <label
                  key={p.slug}
                  className={cn(
                    "relative flex cursor-pointer flex-col border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white",
                    checked ? "border-white bg-white text-ink" : "border-white/20 hover:border-white/60",
                  )}
                >
                  <input
                    type="radio"
                    name="otherPlan"
                    checked={checked}
                    onChange={() => setValue("planSlug", p.slug, { shouldDirty: true })}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-black uppercase">{p.name}</span>
                    {checked && <Check className="size-4" aria-hidden="true" />}
                  </span>
                  {p.tagline && <span className="mt-0.5 text-[0.65rem] uppercase tracking-[0.18em] opacity-70">{p.tagline}</span>}
                  <span className="mt-3 text-sm tabular">
                    {p.priceCents === null ? (
                      "Price confirmed with you"
                    ) : p.offerPriceCents !== null ? (
                      <>
                        <span className="font-bold">{money(p.offerPriceCents)}</span>{" "}
                        <span className="line-through opacity-60">{money(p.priceCents)}</span>
                        {p.offerFirstOrderOnly && <span className="block text-[0.65rem] opacity-70">first order</span>}
                      </>
                    ) : (
                      <span className="font-bold">{money(p.priceCents)}</span>
                    )}
                  </span>
                  {p.isRecommended && (
                    <span className={cn("absolute -top-2.5 right-3 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em]", checked ? "bg-ink text-white" : "bg-white text-ink")}>
                      Popular
                    </span>
                  )}
                </label>
              );
            })}
          </div>
            </div>
          )}
          {err("planSlug") && <p role="alert" className="mt-3 text-sm text-red-300">{err("planSlug")}</p>}
        </fieldset>

        {/* 2 — Dishes */}
        {perWeek && props.dishes.length > 0 ? (
          <fieldset id={`${uid}-dishes`} className="scroll-mt-28">
            <legend className="contents">
              <StepHeading
                n={2}
                title={`Choose your ${perWeek} meals`}
                description="Pick how many of each dish you'd like each week — or mix them evenly."
              />
            </legend>
            <DishPicker
              dishes={props.dishes}
              perWeek={perWeek}
              value={mealSelections}
              onChange={(next) => setSelections(next)}
              error={errors.mealSelections?.message as string | undefined}
            />
          </fieldset>
        ) : null}

        {/* 2 — Details */}
        <fieldset>
          <legend className="contents">
            <StepHeading n={stepN(3)} title="Your details" description="So our team can contact you to confirm your order." />
          </legend>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldBlock label="Full name" htmlFor={fid("fullName")} error={err("fullName")}>
                <input id={fid("fullName")} autoComplete="name" className={inputClass} {...register("fullName")} {...aria("fullName")} />
              </FieldBlock>
            </div>
            <FieldBlock label="Email" htmlFor={fid("email")} error={err("email")}>
              <input id={fid("email")} type="email" inputMode="email" autoComplete="email" className={inputClass} {...register("email")} {...aria("email")} />
            </FieldBlock>
            <FieldBlock label="Phone" htmlFor={fid("phone")} error={err("phone")} hint="Maltese numbers can be entered without +356.">
              <input id={fid("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="7912 3456" className={inputClass} {...register("phone")} {...aria("phone")} />
            </FieldBlock>
            {props.form.askWhatsapp && (
              <div className="sm:col-span-2">
                <FieldBlock
                  label="WhatsApp number"
                  optional
                  htmlFor={fid("whatsappNumber")}
                  error={err("whatsappNumber")}
                  hint={
                    <button type="button" onClick={sameAsPhone} className="underline underline-offset-4 hover:text-white">
                      Same as my phone number
                    </button>
                  }
                >
                  <input id={fid("whatsappNumber")} type="tel" inputMode="tel" autoComplete="tel" className={inputClass} {...register("whatsappNumber")} {...aria("whatsappNumber")} />
                </FieldBlock>
              </div>
            )}
          </div>
        </fieldset>

        {/* 3 — Fulfilment */}
        <fieldset>
          <legend className="contents">
            <StepHeading n={stepN(4)} title="Collection or delivery" />
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: "COLLECTION", label: "Collection", icon: Store, enabled: collectionPossible, note: "Pick up your meals from us." },
                {
                  value: "DELIVERY",
                  label: "Delivery",
                  icon: Truck,
                  enabled: deliveryPossible,
                  note: props.areas.length > 0 ? "To supported localities in Malta." : "Localities being finalised.",
                },
              ] as const
            ).map((o) => {
              const checked = fulfillmentMethod === o.value;
              return (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-4 border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white",
                    checked ? "border-white bg-white/[0.06]" : "border-white/20 hover:border-white/60",
                    !o.enabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  <input type="radio" value={o.value} disabled={!o.enabled} {...register("fulfillmentMethod")} className="sr-only" />
                  <o.icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block font-display font-black uppercase">{o.label}</span>
                    <span className="mt-1 block text-sm text-fog">{o.enabled ? o.note : "Not available right now."}</span>
                  </span>
                  {checked && <Check className="ml-auto size-4 shrink-0" aria-hidden="true" />}
                </label>
              );
            })}
          </div>
          {err("fulfillmentMethod") && <p role="alert" className="mt-3 text-sm text-red-300">{err("fulfillmentMethod")}</p>}

          {fulfillmentMethod === "COLLECTION" && (
            <div className="mt-6 space-y-4">
              {props.collectionPoints.length > 1 ? (
                <FieldBlock label="Collection point" htmlFor={fid("collectionPointId")} error={err("collectionPointId")}>
                  <select id={fid("collectionPointId")} className={inputClass} {...register("collectionPointId")} {...aria("collectionPointId")}>
                    <option value="">Choose a collection point</option>
                    {props.collectionPoints.map((p) => (
                      <option key={p.id} value={p.id} className="text-ink">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </FieldBlock>
              ) : null}
              {props.collectionPoints.length > 0 ? (
                <ul className="space-y-3">
                  {props.collectionPoints.map((p) => (
                    <li key={p.id} className="border border-white/15 p-4 text-sm">
                      <p className="font-semibold">{p.name}</p>
                      {p.address && <p className="mt-1 text-fog">{p.address}</p>}
                      {(p.availableDays.length > 0 || p.timeWindows) && (
                        <p className="mt-1 text-fog">
                          {p.availableDays.length > 0 && formatWeekdays(p.availableDays)} {p.timeWindows}
                        </p>
                      )}
                      {p.instructions && <p className="mt-1 text-fog">{p.instructions}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border border-white/15 p-4 text-sm text-fog">
                  {props.fulfillment.collectionInfo || "Collection details are confirmed with you when we confirm your order."}
                </p>
              )}
              {props.fulfillment.collectionInfo && props.collectionPoints.length > 0 && (
                <p className="text-sm text-fog">{props.fulfillment.collectionInfo}</p>
              )}
            </div>
          )}

          {fulfillmentMethod === "DELIVERY" && (
            <div className="mt-6 space-y-6">
              {props.areas.length === 0 ? (
                <div className="border border-white/15 p-4 text-sm text-fog">
                  <p>{props.fulfillment.noDeliveryAreasMessage}</p>
                  {props.whatsappHref && (
                    <a href={props.whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-white underline underline-offset-4">
                      <WhatsAppIcon className="size-4" /> Ask about delivery on WhatsApp
                    </a>
                  )}
                  {err("deliveryAreaId") && <p role="alert" className="mt-3 text-red-300">{err("deliveryAreaId")}</p>}
                </div>
              ) : (
                <>
                  <FieldBlock
                    label="Locality"
                    htmlFor={fid("deliveryAreaId")}
                    error={err("deliveryAreaId")}
                    hint="Only localities we currently deliver to are listed."
                  >
                    <select id={fid("deliveryAreaId")} className={inputClass} {...register("deliveryAreaId")} {...aria("deliveryAreaId")}>
                      <option value="">Choose your locality</option>
                      {areasByRegion.map(([region, list]) => (
                        <optgroup key={region} label={REGION_LABELS[region] ?? region} className="text-ink">
                          {list.map((a) => (
                            <option key={a.id} value={a.id} className="text-ink">
                              {a.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </FieldBlock>
                  {selectedArea && (
                    <div className="border border-white/15 p-4 text-sm text-fog">
                      <p className="font-semibold text-white">Delivery to {selectedArea.name}</p>
                      <ul className="mt-2 space-y-1">
                        {selectedArea.deliveryDays.length > 0 && <li>Delivery days: {formatWeekdays(selectedArea.deliveryDays)}</li>}
                        {selectedArea.deliveryWindow && <li>Time: {selectedArea.deliveryWindow}</li>}
                        {selectedArea.deliveryFeeCents !== null && (
                          <li>Delivery fee: {selectedArea.deliveryFeeCents > 0 ? money(selectedArea.deliveryFeeCents) : "Free"}</li>
                        )}
                        {selectedArea.minOrderCents !== null && <li>Minimum order: {money(selectedArea.minOrderCents)}</li>}
                        {selectedArea.notes && <li>{selectedArea.notes}</li>}
                      </ul>
                      {quote?.minOrderShortfallCents ? (
                        <p role="alert" className="mt-3 text-red-300">
                          This plan is {money(quote.minOrderShortfallCents)} below the minimum order for delivery here.
                        </p>
                      ) : null}
                    </div>
                  )}
                  <FieldBlock label="Address" htmlFor={fid("addressLine1")} error={err("addressLine1")}>
                    <input id={fid("addressLine1")} autoComplete="address-line1" placeholder="House name / number, street" className={inputClass} {...register("addressLine1")} {...aria("addressLine1")} />
                  </FieldBlock>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <FieldBlock label="Flat, floor or landmark" optional htmlFor={fid("addressLine2")} error={err("addressLine2")}>
                      <input id={fid("addressLine2")} autoComplete="address-line2" className={inputClass} {...register("addressLine2")} {...aria("addressLine2")} />
                    </FieldBlock>
                    <FieldBlock label="Postcode" optional htmlFor={fid("postalCode")} error={err("postalCode")} hint="e.g. SLM 1234">
                      <input id={fid("postalCode")} autoComplete="postal-code" className={cn(inputClass, "uppercase")} {...register("postalCode")} {...aria("postalCode")} />
                    </FieldBlock>
                  </div>
                </>
              )}
              {props.fulfillment.deliveryInfo && <p className="text-sm text-fog">{props.fulfillment.deliveryInfo}</p>}
              {props.fulfillment.gozoNote && <p className="text-sm text-fog">{props.fulfillment.gozoNote}</p>}
            </div>
          )}
        </fieldset>

        {/* 4 — Start & preferences */}
        <fieldset>
          <legend className="contents">
            <StepHeading n={stepN(5)} title="Start date & preferences" description="All optional — tell us anything that helps." />
          </legend>
          <div className="grid gap-6">
            {props.form.askStartDate && (
              <FieldBlock
                label="Preferred start date"
                optional
                htmlFor={fid("preferredStartDate")}
                error={err("preferredStartDate")}
                hint={`Earliest: ${formatCalendarDate(props.minStartDate)}${props.cutoff ? ` (orders close ${props.cutoff.timeLabel} on the Wednesday before each week)` : ""}. We'll confirm the exact date with you.`}
              >
                <input
                  id={fid("preferredStartDate")}
                  type="date"
                  min={props.minStartDate}
                  max={props.maxStartDate}
                  className={cn(inputClass, "[color-scheme:dark] sm:max-w-xs")}
                  {...register("preferredStartDate")}
                  {...aria("preferredStartDate")}
                />
              </FieldBlock>
            )}
            {props.form.mealPreferenceOptions.length > 0 && (
              <FieldBlock label="Meal preference" optional htmlFor={fid("mealPreference")} error={err("mealPreference")}>
                <select id={fid("mealPreference")} className={inputClass} {...register("mealPreference")} {...aria("mealPreference")}>
                  <option value="">No preference</option>
                  {props.form.mealPreferenceOptions.map((o) => (
                    <option key={o} value={o} className="text-ink">
                      {o}
                    </option>
                  ))}
                </select>
              </FieldBlock>
            )}
            {props.form.askDietaryPreferences && (
              <FieldBlock label="Dietary preferences" optional htmlFor={fid("dietaryPreferences")} error={err("dietaryPreferences")} hint="e.g. no fish, prefer rice over potatoes">
                <textarea id={fid("dietaryPreferences")} rows={2} className={textareaClass} {...register("dietaryPreferences")} {...aria("dietaryPreferences")} />
              </FieldBlock>
            )}
            {props.form.askAllergies && (
              <div className="space-y-4">
                <FieldBlock label="Allergies or intolerances" optional htmlFor={fid("allergies")} error={err("allergies")}>
                  <textarea id={fid("allergies")} rows={2} className={textareaClass} {...register("allergies")} {...aria("allergies")} />
                </FieldBlock>
                <p className="text-sm text-fog">{props.form.allergenNotice}</p>
                {allergies && allergies.trim() !== "" && (
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-1 size-5 shrink-0 accent-white" {...register("allergyConsent")} {...aria("allergyConsent")} />
                    <span>I agree that {props.brandName} may use my allergy information to prepare my order safely. It is kept private.</span>
                  </label>
                )}
                {err("allergyConsent") && <p role="alert" className="text-sm text-red-300">{err("allergyConsent")}</p>}
              </div>
            )}
            {props.form.askSpecialInstructions && (
              <FieldBlock label="Special instructions" optional htmlFor={fid("specialInstructions")} error={err("specialInstructions")}>
                <textarea id={fid("specialInstructions")} rows={2} className={textareaClass} {...register("specialInstructions")} {...aria("specialInstructions")} />
              </FieldBlock>
            )}
            <FieldBlock label="Anything else?" optional htmlFor={fid("notes")} error={err("notes")}>
              <textarea id={fid("notes")} rows={2} className={textareaClass} {...register("notes")} {...aria("notes")} />
            </FieldBlock>
          </div>
        </fieldset>

        {/* 5 — Offers */}
        <fieldset>
          <legend className="contents">
            <StepHeading n={stepN(6)} title="Offers" />
          </legend>
          <div className="space-y-6">
            {showDeclaration && !(props.intro && introDeadline) && (
              <div className="border border-white p-5">
                {quote?.firstOrderOffer && !firstOrderDeclared && (
                  <p className="mb-3 text-sm">
                    <span className="font-semibold">New customer?</span> Request the {quote.firstOrderOffer.name} and save{" "}
                    {money(quote.firstOrderOffer.discountCents)} on this plan.
                  </p>
                )}
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-white" {...register("firstOrderDeclared")} />
                  <span>{props.declarationText}</span>
                </label>
              </div>
            )}
            <div>
              <label htmlFor={fid("coupon")} className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/80">
                Offer code <span className="ml-2 text-[0.65rem] font-normal normal-case tracking-normal text-fog">Optional</span>
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id={fid("coupon")}
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCoupon();
                    }
                  }}
                  autoComplete="off"
                  className={cn(inputClass, "uppercase sm:max-w-xs")}
                />
                <button type="button" onClick={applyCoupon} className="h-12 shrink-0 border border-white/40 px-5 text-xs font-semibold uppercase tracking-[0.14em] hover:border-white">
                  Apply
                </button>
              </div>
              {appliedCoupon && quote?.couponMessage && (
                <p role="status" className={cn("mt-2 text-sm", couponValid ? "text-emerald-300" : "text-red-300")}>
                  {quote.couponMessage}
                </p>
              )}
            </div>
          </div>
        </fieldset>
      </div>

      {/* Mobile: the total and a way to the summary stay in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-fog">
              {perWeek ? packageLabel(selectedPlan) : selectedPlan?.name}
            </p>
            <p className="font-display text-2xl font-black tabular leading-none">
              {total === null ? "—" : money(total)}
              {discount > 0 && base !== null && <span className="ml-2 text-sm font-normal text-fog line-through">{money(base)}</span>}
            </p>
          </div>
          <a
            href="#order-summary"
            className="grid h-11 shrink-0 place-items-center bg-white px-4 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink"
          >
            Review &amp; send
          </a>
        </div>
      </div>

      {/* Summary + consent + submit */}
      <aside id="order-summary" className="scroll-mt-24 lg:col-span-5">
        <div className="space-y-6 lg:sticky lg:top-28">
          {summary}
          <div className="space-y-4 text-sm">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-white" {...register("privacyAccepted")} {...aria("privacyAccepted")} />
              <span>
                I&apos;ve read the{" "}
                <a href="/privacy-policy" target="_blank" className="underline underline-offset-4">
                  privacy notice
                </a>{" "}
                and agree to {props.brandName} using my details to handle this order request.
              </span>
            </label>
            {err("privacyAccepted") && <p role="alert" className="text-red-300">{err("privacyAccepted")}</p>}
            {props.form.marketingOptInEnabled && (
              <label className="flex items-start gap-3 text-fog">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-white" {...register("marketingOptIn")} />
                <span>{props.form.marketingConsentText}</span>
              </label>
            )}
          </div>

          {/* Honeypot: hidden from people, tempting for bots */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={fid("website")}>Website</label>
            <input id={fid("website")} tabIndex={-1} autoComplete="off" {...register("website")} />
          </div>

          {props.turnstileSiteKey && <div ref={turnstileRef} />}

          {formError && (
            <p role="alert" className="flex gap-2 border border-red-400/50 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex h-14 w-full items-center justify-center gap-3 bg-white text-sm font-semibold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-mist disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Sending request…
              </>
            ) : (
              "Send order request"
            )}
          </button>
          <p className="text-center text-xs text-fog">Nothing is charged online. You&apos;ll get a confirmation by email.</p>
          {props.whatsappHref && (
            <p className="text-center text-sm">
              <a href={props.whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-fog underline-offset-4 hover:text-white hover:underline">
                <WhatsAppIcon className="size-4" /> Prefer to chat? Message us on WhatsApp
              </a>
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}

/** "Your first week: €6 a meal — order within 2 hours" with the visitor's own countdown. */
function IntroOfferCard({
  intro,
  deadline,
  serverNow,
  money,
  firstWeekCents,
  perWeek,
  declared,
  applied,
  children,
}: {
  intro: NonNullable<OrderFormProps["intro"]>;
  deadline: string;
  serverNow: string;
  money: (cents: number) => string;
  firstWeekCents: number | null;
  perWeek: number | null;
  declared: boolean;
  applied: boolean;
  children?: React.ReactNode;
}) {
  const mealPrice = intro.discountType === "FIRST_WEEK_MEAL_PRICE" ? intro.discountValue : null;
  const offerWeek = mealPrice !== null && perWeek ? mealPrice * perWeek : null;
  return (
    <section aria-label={intro.name} className="relative overflow-hidden border border-white bg-white/[0.04] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-md">
          <p className="eyebrow inline-flex items-center gap-2 text-white">
            <Flame className="size-4" aria-hidden="true" /> {intro.newCustomersOnly ? "New customer offer" : "Limited offer"}
          </p>
          <h2 className="mt-2 font-display text-2xl font-black uppercase leading-none sm:text-3xl">{intro.headline}</h2>
          {offerWeek !== null && firstWeekCents !== null && firstWeekCents > offerWeek ? (
            <p className="mt-2 text-sm text-fog">
              Your first week: <span className="font-semibold text-white">{money(offerWeek)}</span>{" "}
              <span className="line-through">{money(firstWeekCents)}</span> — save {money(firstWeekCents - offerWeek)}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-fog">{intro.label} on your first week.</p>
          )}
        </div>
        <Countdown
          endsAt={deadline}
          serverNow={serverNow}
          size="sm"
          label="Order within"
          refreshOnEnd={false}
          endedLabel="Your 2-hour window has ended"
        />
      </div>
      {children}
      {declared && applied && (
        <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
          <Check className="size-4" aria-hidden="true" /> Applied to your summary — confirmed by our team before payment.
        </p>
      )}
      {intro.terms && (
        <details className="mt-3 text-xs text-fog">
          <summary className="cursor-pointer select-none hover:text-white">Offer terms</summary>
          <p className="mt-2 leading-relaxed">{intro.terms}</p>
        </details>
      )}
    </section>
  );
}
