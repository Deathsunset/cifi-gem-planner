import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "CIFI Gem Planner",
    description: "Unofficial, non-commercial CIFI community tool for planning Gem upgrades, nodes and orb spending.",
    openGraph: {
      title: "CIFI Gem Planner",
      description: "Unofficial CIFI community tool. Plan smarter and spend orbs with confidence.",
      type: "website",
      images: [{ url: new URL("/og-community.png", baseUrl).toString(), width: 1736, height: 909, alt: "CIFI Gem Planner — unofficial community tool" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CIFI Gem Planner",
      description: "Unofficial CIFI community tool. Plan smarter and spend orbs with confidence.",
      images: [new URL("/og-community.png", baseUrl).toString()],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080b11",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
