import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Obsidian Study Command Center",
    short_name: "Obsidian Study",
    description: "Your personal study dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#171819",
    theme_color: "#171819",
    icons: []
  };
}