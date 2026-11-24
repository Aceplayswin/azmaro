"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Pagination } from "@/lib/api";

/** "Showing 1–25 of 94" + rows per page + First / Prev / Next / Last. */
export function Pager({
  pagination,
  onPage,
  pageSize,
  onPageSize,
}: {
  pagination: Pagination | null;
  onPage: (page: number) => void;
  pageSize?: number;
  onPageSize?: (size: number) => void;
}) {
  if (!pagination) return null;
  const { page, totalPages, total } = pagination;
  const from = total ? (page - 1) * pagination.pageSize + 1 : 0;
  const to = Math.min(page * pagination.pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-3 py-2 text-ink-2">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <label className="flex items-center gap-2">
            Rows
            <select className="input w-auto py-0" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
              {[25, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(1)}>First</button>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <span className="px-1">
          {page} / {totalPages}
        </span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>Last</button>
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function TableMessage({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

/** KPI tile used on the dashboard, reports, carts and customer pages. */
export function StatCard({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 hover:border-line">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** "← Orders" link above detail pages. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1.5 text-muted hover:text-ink">
      <ArrowLeft size={14} /> {children}
    </Link>
  );
}
