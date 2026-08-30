import "server-only";

import { getCreativeProviderPublicConfig } from "@/lib/creative-studio/nano-banana-config";
import { getKlingMotionCostCap } from "@/lib/ugc-video-studio/kling-motion-config";
import { getCustomerPublishedPricingDto } from "@/lib/xeriano/pricing";

export type XerianoCreativeCustomerConfig = {
  modelId: "nano-banana-pro";
  displayName: "Nano Banana Pro";
  ready: boolean;
  customerAvailable: true;
};

export type XerianoUgcCustomerConfig = {
  models: {
    "seedance-2.5": {
      displayName: "Seedance 2.5";
      ready: false;
      customerAvailable: false;
    };
    "kling-v3-pro-motion-control": {
      displayName: "Kling V3 Pro Motion Control";
      ready: boolean;
      customerAvailable: true;
    };
  };
};

/** Customer-safe capability view: no USD, cost caps, env names or endpoints. */
export function getXerianoCreativeCustomerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): XerianoCreativeCustomerConfig {
  const internal = getCreativeProviderPublicConfig(environment);
  return {
    modelId: "nano-banana-pro",
    displayName: "Nano Banana Pro",
    ready: internal.ready,
    customerAvailable: true,
  };
}

/** Only explicitly priced models are executable in CUSTOMER mode. */
export function getXerianoUgcCustomerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): XerianoUgcCustomerConfig {
  const klingReady = Boolean(
    environment.FAL_KEY?.trim() &&
      getKlingMotionCostCap(environment) !== null &&
      environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  return {
    models: {
      "seedance-2.5": {
        displayName: "Seedance 2.5",
        ready: false,
        customerAvailable: false,
      },
      "kling-v3-pro-motion-control": {
        displayName: "Kling V3 Pro Motion Control",
        ready: klingReady,
        customerAvailable: true,
      },
    },
  };
}

/** Canonical customer-safe pricing publication. Contains no cost or margin data. */
export function getXerianoCustomerPricingConfig() {
  return getCustomerPublishedPricingDto();
}
