"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageTitle, Pager, TableMessage } from "@/components/Pager";
import { formatInr } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/useApiList";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  orders: number;
  addresses: number;
  location: string | null;
  totalSpent: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ q: "", role: "", page: 1, pageSize: 25 });
  const { rows, pagination, error } = useApiList<Customer>("/admin/customers", filters);

  // Debounced search term → filters (and back to page 1), applied during render so only one request fires.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  if (filters.q !== debouncedSearch) setFilters((f) => ({ ...f, q: debouncedSearch, page: 1 }));

  return (
    <div className="page">
      <PageTitle title="Customers" subtitle="Registered accounts with their contact details and saved addresses. Guest buyers appear on their orders only." />
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input className="input pl-8" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search customers" />
          </div>
          <select className="input w-auto" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value, page: 1 }))} aria-label="Role">
            <option value="">All roles</option>
            <option value="CUSTOMER">Customers</option>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admins</option>
          </select>
          {error && <span className="text-danger">{error}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[1100px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Role</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Total spent</th>
                <th>Last sign-in</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <TableMessage cols={10}>Loading…</TableMessage>}
              {rows?.length === 0 && <TableMessage cols={10}>No customers found.</TableMessage>}
              {rows?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    {c.email} {!c.emailVerified && <span className="text-xs text-muted">(unverified)</span>}
                  </td>
                  <td className="text-ink-2">{c.phone ?? "—"}</td>
                  <td className="text-ink-2">{c.location ?? "—"}</td>
                  <td>
                    <span className={`badge ${c.role === "CUSTOMER" ? "" : "badge-info"}`}>{c.role.toLowerCase()}</span>
                  </td>
                  <td className="text-right tabular-nums">{c.orders}</td>
                  <td className="text-right tabular-nums">{formatInr(c.totalSpent)}</td>
                  <td className="text-ink-2">{formatDateTime(c.lastLoginAt)}</td>
                  <td className="text-ink-2">{formatDate(c.createdAt)}</td>
                  <td>
                    <span className={`badge ${c.isActive ? "badge-ok" : "badge-bad"}`}>{c.isActive ? "Active" : "Disabled"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pagination={pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))} pageSize={filters.pageSize} onPageSize={(pageSize) => setFilters((f) => ({ ...f, pageSize, page: 1 }))} />
      </div>
    </div>
  );
}
