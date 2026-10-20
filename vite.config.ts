import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        id: "/",
        start_url: "/",
        scope: "/",
        name: "Cloudwise — AZ-900 Study Buddy",
        short_name: "Cloudwise",
        description: "A friendly, unofficial study companion for the AZ-900 exam.",
        theme_color: "#f8f7f2",
        background_color: "#f8f7f2",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        categories: ["education", "productivity"],
        prefer_related_applications: false,
        icons: [
          { src: "/cloud.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ]
});
