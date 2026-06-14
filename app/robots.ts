import type { MetadataRoute } from "next";

const BASE_URL = "https://tablo.click";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/board"
    },
    sitemap: `${BASE_URL}/sitemap.xml`
  };
}
