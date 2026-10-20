import type { Domain } from "../types";

// Replace these equal placeholders with the official domain weightings.
export const DOMAIN_WEIGHTS: Record<Domain, number> = {
  "Cloud concepts": 1,
  "Azure architecture and services": 1,
  "Azure management and governance": 1
};

export const LEITNER_INTERVAL_DAYS = [1, 2, 4, 7, 14] as const;
