import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Obsidian — Study Command Center",
  description: "A focused, gold-accented study dashboard for your daily learning.",
  applicationName: "Obsidian Study",
  manifest: "/manifest.json",
};
export const viewport: Viewport = {
  themeColor: "#171819",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}