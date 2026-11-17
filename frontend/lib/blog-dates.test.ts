import { describe, expect, it } from "vitest";
import { formatBlogDate, readingTimeLabel } from "./blog-dates";

describe("blog dates", () => {
  it("formats an ISO timestamp in India and ignores empty values", () => {
    expect(formatBlogDate("2026-11-17T00:30:00Z")).toBe("17 November 2026");
    expect(formatBlogDate(null)).toBe("");
    expect(formatBlogDate("not-a-date")).toBe("");
  });

  it("labels reading time with a minimum of one minute", () => {
    expect(readingTimeLabel(4)).toBe("4 min read");
    expect(readingTimeLabel(0)).toBe("1 min read");
  });
});