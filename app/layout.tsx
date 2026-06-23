import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dark Plains",
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
