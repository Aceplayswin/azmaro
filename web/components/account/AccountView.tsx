"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Heart, LogOut, MapPin, Package, User } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingState, Notice } from "@/components/ui/States";
import { loginHref, signOut, useSession } from "@/lib/session";
import type { Order, OrderAddress, SessionUser } from "@/types/api";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { useWishlist } from "@/lib/wishlist";

type Tab = "overview" | "orders" | "addresses" | "profile";

/** Distinct delivery addresses from the customer's orders (newest first). */
export function addressesFromOrders(orders: Order[]): OrderAddress[] {
  return [...new Map(orders.map((o) => [`${o.address.addressLine}|${o.address.pin}`.toLowerCase(), o.address])).values()];
}

export function AccountView() {
  const router = useRouter();
  const user = useSession();

  useEffect(() => {
    if (user === null) router.replace(loginHref("/account"));
  }, [user, router]);

  if (!user) return <LoadingState label="Loading your account" />;
  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const { count: wishCount } = useWishlist();

  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { orders?: Order[] }) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  const addresses = orders ? addressesFromOrders(orders) : [];

  const logOut = async () => {
    await signOut();
    router.replace("/");
  };

  const nav: Array<{ id: Tab; label: string; icon: typeof User }> = [
    { id: "overview", label: "Overview", icon: User },
    { id: "orders", label: "My orders", icon: Package },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
      <nav aria-label="Account sections" className="az-panel self-start p-2">
        <div className="hidden border-b border-line-soft px-4 pt-3 pb-4 lg:block">
          <p className="text-sm text-ink">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:mt-2 lg:flex-col">
          {nav.map(({ id, label, icon: Icon }) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors",
                  tab === id ? "bg-elevated text-gold-light" : "text-ink-2 hover:text-gold-light",
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            </li>
          ))}
          <li className="shrink-0">
            <Link href="/wishlist" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-2 hover:text-gold-light">
              <Heart className="size-4" aria-hidden /> Wishlist
            </Link>
          </li>
          <li className="shrink-0">
            <button type="button" onClick={logOut} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-2 hover:text-danger">
              <LogOut className="size-4" aria-hidden /> Log out
            </button>
          </li>
        </ul>
      </nav>

      <div className="min-w-0">
        {tab === "overview" && (
          <>
            <p className="mb-6 text-sm text-ink-2">
              Hello <span className="text-ink">{user.name}</span>. From here you can view your orders, delivery addresses and account details.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              {[
                { label: "Orders", value: orders?.length, onClick: () => setTab("orders") },
                { label: "Wishlist", value: wishCount, href: "/wishlist" },
                { label: "Addresses", value: orders ? addresses.length : undefined, onClick: () => setTab("addresses") },
              ].map((s) => {
                const inner = (
                  <>
                    <p className="text-xs text-ink-2">{s.label}</p>
                    <p className="mt-1 font-sans text-2xl font-semibold tabular-nums sm:text-3xl">{s.value ?? "–"}</p>
                  </>
                );
                return s.href ? (
                  <Link key={s.label} href={s.href} className="az-panel min-w-0 p-3 hover:border-line sm:p-5">
                    {inner}
                  </Link>
                ) : (
                  <button key={s.label} type="button" onClick={s.onClick} className="az-panel min-w-0 p-3 text-left hover:border-line sm:p-5">
                    {inner}
                  </button>
                );
              })}
            </div>
            <div className="mt-10 mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Recent orders</h2>
              {orders && orders.length > 3 && (
                <button type="button" className="az-link text-xs" onClick={() => setTab("orders")}>
                  View all
                </button>
              )}
            </div>
            <OrdersList orders={orders?.slice(0, 3) ?? null} />
          </>
        )}
        {tab === "orders" && (
          <>
            <h2 className="mb-4 text-lg font-semibold">My orders</h2>
            <OrdersList orders={orders} />
          </>
        )}
        {tab === "addresses" && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Addresses</h2>
            <AddressList addresses={orders ? addresses : null} />
          </>
        )}
        {tab === "profile" && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Profile</h2>
            <dl className="az-panel max-w-lg divide-y divide-line-soft">
              <div className="flex justify-between gap-4 p-4 text-sm">
                <dt className="text-ink-2">Name</dt>
                <dd>{user.name}</dd>
              </div>
              <div className="flex justify-between gap-4 p-4 text-sm">
                <dt className="text-ink-2">Email</dt>
                <dd className="truncate">{user.email}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-ink-2">
              Need a new password?{" "}
              <Link href="/forgot-password" className="text-gold underline-offset-4 hover:underline">
                Send a reset link
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<Order["status"], string> = { placed: "Placed", awaiting_payment: "Awaiting payment" };
const PAYMENT_LABEL: Record<Order["paymentStatus"], string> = {
  not_collected: "Not collected (test)",
  pending: "Pending",
  cod_pending: "Cash on delivery",
  paid: "Paid",
  failed: "Failed",
};

function OrdersList({ orders }: { orders: Order[] | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!orders) return <LoadingState label="Loading orders" />;
  if (!orders.length)
    return (
      <EmptyState className="az-panel py-12" title="No orders yet" description="When you place an order it will appear here.">
        <ButtonLink href="/shop" size="sm">
          Start shopping
        </ButtonLink>
      </EmptyState>
    );
  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const expanded = open === o.orderNumber;
        const items = o.lines.reduce((s, l) => s + l.qty, 0);
        return (
          <li key={o.orderNumber} className="az-panel">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : o.orderNumber)}
              aria-expanded={expanded}
              className="grid w-full grid-cols-2 items-center gap-3 p-4 text-left text-sm sm:grid-cols-[1.3fr_1.2fr_1fr_0.8fr_auto]"
            >
              <span>
                <span className="block font-semibold">{o.orderNumber}</span>
                <span className="text-xs text-muted">
                  {items} item{items === 1 ? "" : "s"}
                </span>
              </span>
              <span className="text-right text-xs text-ink-2 sm:text-left">{formatDateTime(o.createdAt)}</span>
              <span>
                <span className="border border-line-soft px-2 py-0.5 text-xs text-ink-2">
                  {STATUS_LABEL[o.status]}
                  {o.demo ? " · test" : ""}
                </span>
              </span>
              <span className="text-right font-semibold tabular-nums sm:text-left">{formatPrice(o.total)}</span>
              <ChevronDown className={cn("col-span-2 size-4 justify-self-end text-muted transition-transform sm:col-span-1", expanded && "rotate-180")} aria-hidden />
            </button>
            {expanded && (
              <div className="border-t border-line-soft p-4 text-sm">
                <ul className="divide-y divide-line-soft">
                  {o.lines.map((l) => (
                    <li key={`${l.slug}-${l.sizeMl}`} className="flex justify-between gap-4 py-2">
                      <span>
                        <Link href={`/product/${l.slug}`} className="text-ink hover:text-gold-light">
                          {l.brandName} {l.name}
                        </Link>
                        <span className="text-muted">
                          {" "}
                          · {l.sizeMl} ml × {l.qty}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatPrice(l.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <address className="text-xs leading-relaxed text-ink-2 not-italic">
                    <span className="mb-1 block font-semibold text-ink">Delivery address</span>
                    {o.address.fullName}
                    <br />
                    {o.address.addressLine}
                    {o.address.landmark ? `, ${o.address.landmark}` : ""}
                    <br />
                    {o.address.city}, {o.address.state} {o.address.pin}
                    <br />
                    {o.phone}
                  </address>
                  <dl className="space-y-1 text-xs text-ink-2">
                    <div className="flex justify-between">
                      <dt>Subtotal</dt>
                      <dd className="tabular-nums">{formatPrice(o.subtotal)}</dd>
                    </div>
                    {o.discount > 0 && (
                      <div className="flex justify-between">
                        <dt>Discount</dt>
                        <dd className="tabular-nums">−{formatPrice(o.discount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt>Delivery</dt>
                      <dd className="tabular-nums">{o.delivery === null ? "To be confirmed" : o.delivery === 0 ? "Free" : formatPrice(o.delivery)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold text-ink">
                      <dt>Total</dt>
                      <dd className="tabular-nums">{formatPrice(o.total)}</dd>
                    </div>
                    <div className="flex justify-between pt-1">
                      <dt>Payment</dt>
                      <dd>
                        {o.paymentMethod.toUpperCase()} · {PAYMENT_LABEL[o.paymentStatus]}
                      </dd>
                    </div>
                  </dl>
                </div>
                <Link href={`/track-order?order=${o.orderNumber}`} className="az-link mt-4 inline-block text-xs">
                  Track this order
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AddressList({ addresses }: { addresses: OrderAddress[] | null }) {
  if (!addresses) return <LoadingState label="Loading addresses" />;
  if (!addresses.length) return <Notice>Addresses you use at checkout are saved here automatically.</Notice>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {addresses.map((a) => (
        <address key={`${a.addressLine}-${a.pin}`} className="az-panel p-5 text-sm leading-relaxed text-ink-2 not-italic">
          <span className="text-ink">{a.fullName}</span>
          <br />
          {a.addressLine}
          {a.landmark ? `, ${a.landmark}` : ""}
          <br />
          {a.city}, {a.state} {a.pin}
        </address>
      ))}
    </div>
  );
}
