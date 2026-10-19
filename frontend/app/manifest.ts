import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Find the right school for your child`,
    short_name: SITE_NAME,
    description: SITE_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f3d2e",
    categories: ["education", "reference"],
    lang: "en",
    icons: [
      {
        src: "/BoardingEdu_LOGO.jpeg",
        sizes: "any",
        type: "image/jpeg",
      },
    ],
  };
}
