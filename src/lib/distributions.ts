/**
 * Distribution ID registry for CMS Open Payments datasets.
 *
 * Open Payments uses DKAN; each dataset + year has a unique distribution UUID.
 * Queries target the distribution ID, not the dataset ID.
 *
 * Distribution IDs change with each data refresh cycle — update here when CMS publishes new data.
 */

export type DatasetType = "general" | "research" | "ownership" | "profiles";

export interface DistributionEntry {
  id: string;
  year: number;
  description: string;
}

const DISTRIBUTIONS: Record<DatasetType, DistributionEntry> = {
  general: {
    id: "9323b84e-cda3-5f6b-a501-b76926c7c035",
    year: 2024,
    description: "General Payments (food, travel, consulting, speaking, gifts)",
  },
  research: {
    id: "514ca9df-631f-546f-9ff8-5f3cb6f8eddb",
    year: 2024,
    description: "Research Payments (clinical studies, grants)",
  },
  ownership: {
    id: "4b1f175a-4a6d-55ab-a395-9a30cb6e3838",
    year: 2024,
    description: "Ownership/Investment Interest",
  },
  profiles: {
    id: "2cb82b3c-d9f8-5fbe-bae0-9cf4c56206cb",
    year: 2024,
    description: "Covered Recipient Profile Supplement",
  },
};

export function getDistributionId(type: DatasetType): string {
  return DISTRIBUTIONS[type].id;
}

export function getDistribution(type: DatasetType): DistributionEntry {
  return DISTRIBUTIONS[type];
}

export function getAllDistributions(): Record<DatasetType, DistributionEntry> {
  return { ...DISTRIBUTIONS };
}
