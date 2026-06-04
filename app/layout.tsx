import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pirate Game",
  description: "A real-time tile-based browser RPG prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
