import { rm } from "node:fs/promises";
import { resolve } from "node:path";

try {
  await rm(resolve(process.cwd(), ".next"), { force: true, recursive: true });
} catch (error) {
  const locked = error && typeof error === "object" && "code" in error && ["EPERM", "EBUSY"].includes(error.code);
  // Dev can recover an existing cache; production builds must start from a clean one.
  if (!locked || process.env.npm_lifecycle_event !== "predev") throw error;
  console.warn("Next cache is locked by Windows/OneDrive; continuing with the existing dev cache.");
}
