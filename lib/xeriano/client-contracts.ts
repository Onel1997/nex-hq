import { z } from "zod";

export const xerianoClientCreditReceiptSchema = z
  .object({
    quotedCredits: z.number().int().positive(),
    pricingVersion: z.string().min(1),
    state: z.enum([
      "RESERVED",
      "PROVIDER_ACCEPTED",
      "UNKNOWN_OUTCOME",
      "SUCCEEDED",
      "FAILED",
      "RELEASED",
    ]),
    availableCredits: z.number().int().nonnegative(),
  })
  .strict();

export type XerianoClientCreditReceipt = z.infer<
  typeof xerianoClientCreditReceiptSchema
>;

export type XerianoCustomerStudioStatus = {
  availableCredits: number;
  activeImageJobs: number;
  activeVideoJobs: number;
  imageConcurrencyLimit: number;
  videoConcurrencyLimit: number;
};
