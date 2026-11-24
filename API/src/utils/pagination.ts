import { z } from "zod";
import type { PaginationMeta } from "./response";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type PaginationInput = z.infer<typeof paginationQuery>;

export const toSkipTake = ({ page, pageSize }: PaginationInput) => ({ skip: (page - 1) * pageSize, take: pageSize });

export const buildMeta = ({ page, pageSize }: PaginationInput, total: number): PaginationMeta => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
