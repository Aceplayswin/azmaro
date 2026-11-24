"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { Brand, Category } from "./types";

/** Brands and categories for the product form's pickers. */
export function useCatalogueOptions() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    api<Brand[]>("/admin/brands").then(({ data }) => setBrands(data)).catch(() => undefined);
    api<Category[]>("/admin/categories").then(({ data }) => setCategories(data)).catch(() => undefined);
  }, []);
  return { brands, categories };
}
