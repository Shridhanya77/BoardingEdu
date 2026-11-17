import { describe, expect, it } from "vitest";

import {
  canonicalSchoolSlug,
  homeSchoolCategories,
  homeSchoolCategoryFromValue,
  schoolProfilePathFromSlugs,
  schoolTypeCategory,
  schoolTypeLabel,
  toSeoSlug,
  withTrailingSlash,
} from "@/lib/seo-slugs";

describe("toSeoSlug", () => {
  it("lowercases and hyphenates labels", () => {
    expect(toSeoSlug("St. Mary's School")).toBe("st-mary-s-school");
  });

  it("strips diacritics", () => {
    expect(toSeoSlug("Déjà Vu")).toBe("deja-vu");
  });

  it("expands ampersands to 'and'", () => {
    expect(toSeoSlug("CBSE & ICSE")).toBe("cbse-and-icse");
  });

  it("expands a lone ampersand instead of dropping it", () => {
    expect(toSeoSlug("&")).toBe("and");
  });

  it("returns an empty string when only punctuation remains", () => {
    expect(toSeoSlug("???")).toBe("");
  });

  it("trims leading and trailing separators", () => {
    expect(toSeoSlug("  --Panchgani--  ")).toBe("panchgani");
  });
});

describe("withTrailingSlash", () => {
  it("appends a trailing slash", () => {
    expect(withTrailingSlash("/about")).toBe("/about/");
  });

  it("leaves an existing trailing slash untouched", () => {
    expect(withTrailingSlash("/schools/")).toBe("/schools/");
  });

  it("keeps file-like paths unchanged", () => {
    expect(withTrailingSlash("/img/logo.svg")).toBe("/img/logo.svg");
  });

  it("preserves query strings and hashes", () => {
    expect(withTrailingSlash("/about?x=1#h")).toBe("/about/?x=1#h");
  });

  it("keeps the root path", () => {
    expect(withTrailingSlash("/")).toBe("/");
  });
});

describe("canonicalSchoolSlug", () => {
  it("prefers the school name when the slug is a UUID", () => {
    expect(
      canonicalSchoolSlug("12345678-1234-1234-1234-123456789abc", "Green Valley"),
    ).toBe("green-valley");
  });

  it("falls back to the name when the slug is empty", () => {
    expect(canonicalSchoolSlug("", "Green Valley")).toBe("green-valley");
  });

  it("normalizes a normal slug", () => {
    expect(canonicalSchoolSlug("Green-Valley-School")).toBe("green-valley-school");
  });
});

describe("schoolProfilePathFromSlugs", () => {
  it("builds a hierarchical country/state/city/school path with a trailing slash", () => {
    expect(
      schoolProfilePathFromSlugs({
        countrySlug: "India",
        stateSlug: "Maharashtra",
        citySlug: "Pune",
        schoolSlug: "Green Valley School",
      }),
    ).toBe("/india/maharashtra/pune/green-valley-school/");
  });
});

describe("schoolTypeCategory", () => {
  it("maps canonical boarding codes to the boarding family", () => {
    expect(schoolTypeCategory("BOARDING")).toBe("boarding-school");
    expect(schoolTypeCategory("RESIDENTIAL")).toBe("boarding-school");
    expect(schoolTypeCategory("FULL BOARDING")).toBe("boarding-school");
  });

  it("maps day-boarding codes to the day-boarding family", () => {
    expect(schoolTypeCategory("DAY-BOARDING")).toBe("day-boarding-school");
    expect(schoolTypeCategory("DAY_BOARDING")).toBe("day-boarding-school");
    expect(schoolTypeCategory("DAY", "day-boarding", "Day Cum Boarding")).toBe(
      "day-boarding-school",
    );
  });

  it("maps day-school codes to the day family", () => {
    expect(schoolTypeCategory("DAY")).toBe("day-school");
    expect(schoolTypeCategory("DAY", "day-school", "Day School")).toBe("day-school");
  });

  it("returns null for unknown codes", () => {
    expect(schoolTypeCategory("UNKNOWN")).toBeNull();
  });

  it("labels the categories", () => {
    expect(schoolTypeLabel("DAY")).toBe("Day School");
    expect(schoolTypeLabel("BOARDING")).toBe("Boarding School");
    expect(schoolTypeLabel("DAY-BOARDING")).toBe("Day Boarding School");
  });
});

describe("homeSchoolCategories", () => {
  it("puts day-boarding in both families", () => {
    expect(homeSchoolCategories("DAY-BOARDING")).toEqual([
      "day-school",
      "residential-school",
    ]);
  });

  it("keeps day schools in the day family", () => {
    expect(homeSchoolCategories("DAY")).toEqual(["day-school"]);
  });

  it("keeps boarding schools in the residential family", () => {
    expect(homeSchoolCategories("BOARDING")).toEqual(["residential-school"]);
  });
});

describe("homeSchoolCategoryFromValue", () => {
  it("normalizes day-school values", () => {
    expect(homeSchoolCategoryFromValue("day-school")).toBe("day-school");
  });

  it("normalizes boarding and residential values", () => {
    expect(homeSchoolCategoryFromValue("boarding-schools")).toBe("residential-school");
    expect(homeSchoolCategoryFromValue("residential_school")).toBe("residential-school");
  });

  it("returns null for unsupported values", () => {
    expect(homeSchoolCategoryFromValue("day-boarding")).toBeNull();
    expect(homeSchoolCategoryFromValue(null)).toBeNull();
  });
});
