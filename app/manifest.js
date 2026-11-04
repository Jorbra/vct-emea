// What a phone needs to install the site like an application.
export default function manifest() {
  return {
    name: "VCT EMEA",
    short_name: "VCT EMEA",
    description: "Résultats, tableaux, programme et équipes du VCT EMEA et des Game Changers EMEA.",
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
