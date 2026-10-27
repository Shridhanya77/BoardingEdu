export const INDIA_REGIONS = [
  {
    id: "north",
    slug: "north-india",
    label: "North India",
    stateSlugs: [
      "chandigarh",
      "delhi",
      "nct-delhi",
      "nct-of-delhi",
      "national-capital-territory-of-delhi",
      "haryana",
      "himachal-pradesh",
      "jammu-and-kashmir",
      "jammu-kashmir",
      "ladakh",
      "punjab",
      "rajasthan",
      "uttarakhand",
      "uttaranchal",
      "uttar-pradesh",
    ],
  },
  {
    id: "south",
    slug: "south-india",
    label: "South India",
    stateSlugs: [
      "andhra-pradesh",
      "karnataka",
      "kerala",
      "lakshadweep",
      "puducherry",
      "pondicherry",
      "tamil-nadu",
      "telangana",
    ],
  },
  {
    id: "east",
    slug: "east-india",
    label: "East India",
    stateSlugs: [
      "andaman-and-nicobar-islands",
      "bihar",
      "jharkhand",
      "odisha",
      "orissa",
      "west-bengal",
      "arunachal-pradesh",
      "assam",
      "manipur",
      "meghalaya",
      "mizoram",
      "nagaland",
      "sikkim",
      "tripura",
    ],
  },
  {
    id: "west",
    slug: "west-india",
    label: "West India",
    stateSlugs: [
      "dadra-and-nagar-haveli",
      "dadra-and-nagar-haveli-and-daman-and-diu",
      "daman-and-diu",
      "goa",
      "gujarat",
      "maharashtra",
    ],
  },
  {
    id: "central",
    slug: "central-india",
    label: "Central India",
    stateSlugs: ["chhattisgarh", "madhya-pradesh"],
  },
] as const;

export type IndiaRegionId = (typeof INDIA_REGIONS)[number]["id"];

function normalizedStateSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function indiaRegionForState(
  stateName: string,
  stateSlug?: string | null,
): (typeof INDIA_REGIONS)[number] | undefined {
  const keys = new Set(
    [stateName, stateSlug ?? ""].map(normalizedStateSlug).filter(Boolean),
  );
  return INDIA_REGIONS.find((region) =>
    region.stateSlugs.some((slug) => keys.has(slug)),
  );
}

export function indiaRegionById(value: string | null | undefined) {
  return INDIA_REGIONS.find((region) => region.id === value);
}

export function indiaRegionBySlug(value: string | null | undefined) {
  return INDIA_REGIONS.find((region) => region.slug === value);
}
