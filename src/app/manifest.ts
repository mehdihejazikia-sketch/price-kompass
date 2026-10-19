import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "قیمت‌یاب",
    short_name: "قیمت‌یاب",
    description: "استعلام لحظه‌ای قیمت کالا در ترب، دیجی‌کالا و ایمالز",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "جستجوی کالا", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "تاریخچه قیمت", url: "/history", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
