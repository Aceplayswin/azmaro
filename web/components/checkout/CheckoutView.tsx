"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Building2, CreditCard, Lock, Minus, Plus, Smartphone } from "lucide-react";
import { MAX_QTY } from "@/lib/cart";
import { useEffect, useRef, useState } from "react";
import { addressesFromOrders } from "@/components/account/AccountView";
import { OrderSummaryRows } from "@/components/cart/OrderSummary";
import { mrpSavings } from "@/lib/cart/pricing";
import { useOrderQuote } from "@/components/cart/useOrderQuote";
import { Field, SelectField } from "@/components/forms/Field";
import { ProductArtwork } from "@/components/ui/Artwork";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingState, Notice } from "@/components/ui/States";
import type { ProductSummary } from "@/lib/catalogue/summary";
import type { Order, OrderAddress, PaymentMethod } from "@/types/api";
import { loginHref, signOut, useSession } from "@/lib/session";
import { useHydrated } from "@/lib/store/persistent-store";
import { cn, formatPrice } from "@/lib/utils";
import {
  INDIAN_STATES,
  validateEmail,
  validatePhone,
  validatePin,
  validateRequired,
} from "@/lib/validation";

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; icon: typeof Smartphone; note: string }> = [
  { id: "upi", label: "UPI", icon: Smartphone, note: "Pay with any UPI app on our payment partner's secure page." },
  { id: "card", label: "Cards", icon: CreditCard, note: "Credit and debit cards, entered only on our payment partner's secure page." },
  { id: "netbanking", label: "Net banking", icon: Building2, note: "Choose your bank on our payment partner's secure page." },
  { id: "cod", label: "Cash on delivery", icon: Banknote, note: "Pay in cash when your order arrives, subject to eligibility." },
];

type FormState = {
  email: string;
  phone: string;
  fullName: string;
  pin: string;
  addressLine: string;
  landmark: string;
  city: string;
  state: string;
};

type Errors = Partial<Record<keyof FormState, string | null>>;

export const LAST_ORDER_KEY = "azmaro.last-order";

export function CheckoutView({
  products,
  testMode,
  availableMethods,
}: {
  products: ProductSummary[];
  testMode: boolean;
  availableMethods: PaymentMethod[];
}) {
  const methods = PAYMENT_METHODS.filter((m) => availableMethods.includes(m.id));
  const hydrated = useHydrated();
  const router = useRouter();
  const user = useSession();
  const quote = useOrderQuote(products);
  const [saved, setSaved] = useState<Array<{ address: OrderAddress; phone: string }>>([]);
  const [touched, setTouched] = useState(false);
  const [rawForm, setForm] = useState<FormState>({
    email: "",
    phone: "",
    fullName: "",
    pin: "",
    addressLine: "",
    landmark: "",
    city: "",
    state: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [payment, setPayment] = useState<PaymentMethod>(methods[0]?.id ?? "cod");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [placed, setPlaced] = useState(false);

  const [pinTouched, setPinTouched] = useState(false);

  // Checkout needs an account: signed-out shoppers sign in first and come back here.
  useEffect(() => {
    if (user === null) router.replace(loginHref("/checkout"));
  }, [user, router]);

  // Addresses used on earlier orders; the most recent one is filled in automatically.
  useEffect(() => {
    if (!user) return;
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { orders?: Order[] }) => {
        const orders = d.orders ?? [];
        const list = addressesFromOrders(orders).map((address) => ({
          address,
          phone: orders.find((o) => o.address.addressLine === address.addressLine && o.address.pin === address.pin)?.phone ?? "",
        }));
        setSaved(list);
        if (list[0]) setForm((f) => (f.addressLine ? f : fromSaved(list[0]!)));
      })
      .catch(() => undefined);
  }, [user]);

  const fromSaved = (s: { address: OrderAddress; phone: string }): FormState => ({
    email: "",
    phone: s.phone,
    fullName: s.address.fullName,
    pin: s.address.pin,
    addressLine: s.address.addressLine,
    landmark: s.address.landmark ?? "",
    city: s.address.city,
    state: s.address.state,
  });

  const applySaved = (s: { address: OrderAddress; phone: string }) => {
    setForm(fromSaved(s));
    setPinTouched(true);
    setTouched(true);
    setErrors({});
    quote.prefs.setPin(s.address.pin);
  };

  // Email comes from the account; name defaults to the account name; the bag's PIN carries over until edited.
  const form: FormState = {
    ...rawForm,
    email: user?.email ?? "",
    fullName: rawForm.fullName || (touched ? "" : (user?.name ?? "")),
    pin: pinTouched ? rawForm.pin : rawForm.pin || quote.prefs.pin || "",
  };

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = key === "pin" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value;
    if (key === "pin") setPinTouched(true);
    if (key === "fullName") setTouched(true);
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: null }));
    if (key === "pin" && !validatePin(value)) quote.prefs.setPin(value);
  };

  const validate = (): Errors => ({
    email: validateEmail(form.email),
    phone: validatePhone(form.phone),
    fullName: validateRequired(form.fullName, "full name"),
    pin: validatePin(form.pin),
    addressLine: validateRequired(form.addressLine, "address", 5),
    city: validateRequired(form.city, "city"),
    state: form.state ? null : "Please choose your state.",
  });

  const contactDone = !validateEmail(form.email) && !validatePhone(form.phone);
  const deliveryDone =
    contactDone &&
    !validateRequired(form.fullName, "n") &&
    !validatePin(form.pin) &&
    !validateRequired(form.addressLine, "a", 5) &&
    !validateRequired(form.city, "c") &&
    Boolean(form.state);

  if (!hydrated || !user) return <LoadingState label="Preparing checkout" />;

  const buyable = quote.lines.filter((l) => l.available);
  if (!buyable.length && !placed) {
    return (
      <EmptyState title="Nothing to check out yet" description="Your bag is empty, or its items can't be ordered just yet.">
        <ButtonLink href="/shop">Shop all fragrances</ButtonLink>
        <ButtonLink href="/bag" variant="secondary">
          View bag
        </ButtonLink>
      </EmptyState>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = validate();
    setErrors(errs);
    const firstInvalid = (Object.keys(errs) as Array<keyof FormState>).find((k) => errs[k]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          phone: form.phone,
          paymentMethod: payment,
          discountCode: quote.prefs.discountCode,
          address: {
            fullName: form.fullName,
            pin: form.pin,
            addressLine: form.addressLine,
            landmark: form.landmark,
            city: form.city,
            state: form.state,
          },
          lines: buyable.map(({ slug, sizeMl, qty }) => ({ slug, sizeMl, qty })),
        }),
      });
      const data = (await res.json()) as { ok: boolean; order?: Order; message?: string };
      if (!res.ok || !data.ok || !data.order) {
        setSubmitError(data.message ?? "We couldn't place your order. Please try again.");
        return;
      }
      // Only after the backend confirms the order do we show confirmation.
      setPlaced(true);
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(data.order));
      if (data.order.paymentRedirectUrl) {
        window.location.assign(data.order.paymentRedirectUrl);
        return;
      }
      quote.clear();
      quote.prefs.setDiscountCode(null);
      router.push(`/checkout/confirmation?order=${encodeURIComponent(data.order.orderNumber)}`);
    } catch {
      setSubmitError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const steps = [
    { n: "01", label: "Contact", done: contactDone },
    { n: "02", label: "Delivery", done: deliveryDone },
    { n: "03", label: "Payment", done: false },
  ];
  const activeStep = !contactDone ? 0 : !deliveryDone ? 1 : 2;
  const d = quote.delivery;

  return (
    <>
      <ol className="mb-10 grid max-w-xl grid-cols-3 gap-3" aria-label="Checkout steps">
        {steps.map((s, i) => (
          <li key={s.n} className="flex flex-col items-start gap-2 min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-3" aria-current={i === activeStep ? "step" : undefined}>
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center border text-[0.65rem] font-bold",
                i === activeStep ? "border-gold bg-gold/10 text-gold-light" : s.done ? "border-gold/60 text-gold" : "border-line-soft text-muted",
              )}
            >
              {s.n}
            </span>
            <span className={cn("text-[0.62rem] font-bold tracking-[0.2em] uppercase", i === activeStep ? "text-ink" : "text-muted")}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {testMode && (
        <Notice tone="demo" title="Test mode" className="mb-8">
          Payment and courier integrations are not connected yet. Orders placed here are test orders: no payment is collected and
          nothing is shipped.
        </Notice>
      )}

      <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <div className="space-y-10">
          <fieldset>
            <legend className="mb-5 font-serif text-2xl">Contact</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="az-field-label">Signed in as</p>
                <div className="az-panel flex min-h-12 items-center justify-between gap-3 px-4 text-sm">
                  <span className="truncate text-ink">{user.email}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-ink-2 underline-offset-4 hover:text-gold-light hover:underline"
                    onClick={async () => {
                      await signOut();
                      router.replace(loginHref("/checkout"));
                    }}
                  >
                    Not you?
                  </button>
                </div>
                {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
              </div>
              <Field label="Phone number" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" prefix="+91" placeholder="10-digit mobile" value={form.phone} onChange={set("phone")} error={errors.phone} required />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-5 font-serif text-2xl">Delivery address</legend>
            {saved.length > 0 && (
              <div className="mb-6">
                <p className="az-field-label">Saved addresses</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {saved.map((s) => {
                    const active = form.addressLine === s.address.addressLine && form.pin === s.address.pin;
                    return (
                      <button
                        type="button"
                        key={`${s.address.addressLine}-${s.address.pin}`}
                        onClick={() => applySaved(s)}
                        aria-pressed={active}
                        className={cn(
                          "border p-4 text-left text-xs leading-relaxed text-ink-2 transition-colors",
                          active ? "border-gold bg-gold/[0.06]" : "border-line-soft hover:border-line",
                        )}
                      >
                        <span className="block text-sm text-ink">{s.address.fullName}</span>
                        {s.address.addressLine}
                        <br />
                        {s.address.city}, {s.address.state} {s.address.pin}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">Or edit the fields below to use a different address.</p>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" name="fullName" autoComplete="name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} required />
              <Field label="PIN code" name="pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pin} onChange={set("pin")} error={errors.pin} required />
              <Field label="Address line" name="addressLine" autoComplete="street-address" placeholder="House / street / locality" value={form.addressLine} onChange={set("addressLine")} error={errors.addressLine} required wrapperClassName="sm:col-span-2" />
              <Field label="Landmark (optional)" name="landmark" placeholder="Nearby landmark" value={form.landmark} onChange={set("landmark")} wrapperClassName="sm:col-span-2" />
              <Field label="City" name="city" autoComplete="address-level2" value={form.city} onChange={set("city")} error={errors.city} required />
              <SelectField label="State" name="state" autoComplete="address-level1" value={form.state} onChange={set("state")} error={errors.state} options={INDIAN_STATES} placeholder="Select state" required />
            </div>

            <div className="mt-6">
              <p className="az-field-label">Delivery method</p>
              <div className="az-panel px-5 py-4 text-[0.8125rem] text-ink-2" aria-live="polite">
                {!form.pin || validatePin(form.pin) ? (
                  "Enter your PIN code to check delivery options."
                ) : d ? (
                  <>
                    {d.courier && <span className="text-ink">{d.courier}</span>}
                    {d.estimate && <span> · {d.estimate}</span>}
                    {!d.courier && !d.estimate && (
                      <>
                        {d.demo && <span className="mr-1 font-bold text-gold">[Test mode]</span>}
                        {d.message}
                      </>
                    )}
                  </>
                ) : (
                  "Checking delivery…"
                )}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-5 font-serif text-2xl">Payment method</legend>
            {methods.length === 0 && (
              <Notice tone="error" className="mb-4">
                Online ordering is temporarily unavailable. Please contact us to place your order.
              </Notice>
            )}
            <div
              role="radiogroup"
              aria-label="Payment method"
              className={cn(
                "grid gap-3",
                methods.length === 1 ? "max-w-xs grid-cols-1" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4",
              )}
            >
              {methods.map((m) => {
                const Icon = m.icon;
                const selected = payment === m.id;
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border px-3 py-4 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold",
                      selected ? "border-gold bg-gold/[0.07] text-gold-light" : "border-line-soft text-ink-2 hover:border-line",
                    )}
                  >
                    <input type="radio" name="payment" value={m.id} checked={selected} onChange={() => setPayment(m.id)} className="sr-only" />
                    <Icon className="size-5" strokeWidth={1.4} aria-hidden />
                    <span className="text-[0.62rem] font-bold tracking-[0.18em] uppercase">{m.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
              {methods.find((m) => m.id === payment)?.note} AZMARO never stores card or bank details.
            </p>
          </fieldset>
        </div>

        <aside aria-labelledby="checkout-summary" className="lg:sticky lg:top-[calc(var(--az-header-h)+1.5rem)] lg:self-start">
          <div className="az-panel p-6 sm:p-7">
            <h2 id="checkout-summary" className="font-serif text-2xl">
              Order summary
            </h2>
            <ul className="mt-6 space-y-4">
              {buyable.map((l) => (
                <li key={`${l.slug}-${l.sizeMl}`} className="flex items-center gap-4">
                  <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden border border-line-soft">
                    {l.product.image ? (
                      <Image src={l.product.image.src} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <ProductArtwork brandName={l.product.brandName} name={l.product.name} size="thumb" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{l.product.name}</p>
                    <p className="text-[0.7rem] tracking-[0.08em] text-muted uppercase">{l.sizeMl} ml</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="inline-flex items-center border border-line-soft" role="group" aria-label={`Quantity for ${l.product.name}`}>
                        <button
                          type="button"
                          className="grid size-7 place-items-center text-ink-2 hover:text-gold-light disabled:opacity-40"
                          aria-label={l.qty === 1 ? `Remove ${l.product.name}` : `Decrease quantity of ${l.product.name}`}
                          title={l.qty === 1 ? "Remove" : "Decrease"}
                          disabled={pending}
                          onClick={() => (l.qty === 1 ? quote.remove(l) : quote.setQty(l, l.qty - 1))}
                        >
                          <Minus className="size-3" aria-hidden />
                        </button>
                        <span className="min-w-6 text-center text-xs tabular-nums" aria-live="polite">
                          {l.qty}
                        </span>
                        <button
                          type="button"
                          className="grid size-7 place-items-center text-ink-2 hover:text-gold-light disabled:opacity-40"
                          aria-label={`Increase quantity of ${l.product.name}`}
                          title="Increase"
                          disabled={pending || l.qty >= MAX_QTY}
                          onClick={() => quote.setQty(l, l.qty + 1)}
                        >
                          <Plus className="size-3" aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-[0.7rem] text-muted underline-offset-2 hover:text-danger hover:underline"
                        disabled={pending}
                        onClick={() => quote.remove(l)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="self-start text-sm font-semibold tabular-nums">{formatPrice(l.lineTotal ?? 0)}</p>
                </li>
              ))}
            </ul>
            <div className="az-rule my-6" />
            <OrderSummaryRows totals={quote.totals} mrpSavings={mrpSavings(buyable)} />
            {quote.prefs.discountCode && quote.discount?.valid && (
              <p className="mt-3 text-xs text-success">Code {quote.prefs.discountCode} applied.</p>
            )}
          </div>

          {submitError && (
            <Notice tone="error" className="mt-4">
              {submitError}
            </Notice>
          )}
          <button type="submit" className="az-btn az-btn-primary mt-4 w-full" disabled={pending || methods.length === 0}>
            {pending ? "Placing order…" : testMode ? "Place test order" : "Place order"}
          </button>
          <p className="mt-3 text-center text-[0.7rem] text-muted">
            By placing your order you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-gold-light">
              terms
            </Link>
            .
          </p>
        </aside>
      </form>
    </>
  );
}
