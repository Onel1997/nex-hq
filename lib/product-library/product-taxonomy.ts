import { z } from "zod";

/** Flexible owner knowledge. Suggestions are UI defaults, never inferred truth. */
export const PRODUCT_TYPE_SUGGESTIONS = [
  "Oversized T-Shirt",
  "T-Shirt",
  "Hoodie",
  "Zip Hoodie",
  "Jogger",
  "Pants",
  "Jacket",
  "Headwear",
] as const;

export const productStatusSchema = z.enum([
  "ACTIVE",
  "SAMPLE",
  "UPCOMING",
  "DRAFT",
  "ARCHIVED",
]);

export const productFabricWeightClassSchema = z.enum([
  "LIGHTWEIGHT",
  "MIDWEIGHT",
  "HEAVYWEIGHT",
  "UNKNOWN",
]);

export const productPrintMethodSchema = z.enum([
  "SCREEN_PRINT",
  "DTG",
  "EMBROIDERY",
  "DTF",
  "TRANSFER",
  "UNKNOWN",
  "CUSTOM",
]);

export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductPrintMethod = z.infer<typeof productPrintMethodSchema>;
