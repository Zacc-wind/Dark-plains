import type { Metadata, Viewport } from "next";
import { Alegreya, Cinzel, Grenze_Gotisch } from "next/font/google";
import "./globals.css";
import "./theme-v2.css";

const displayFont = Grenze_Gotisch({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const labelFont = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-label",
  display: "swap",
});

const bodyFont = Alegreya({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dark Plains",
  description: "A dark fantasy strategy RPG: lead a warband across the shared world map or carve a solo roguelike road.",
};

export const viewport: Viewport = {
  themeColor: "#0b0a0c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${labelFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
