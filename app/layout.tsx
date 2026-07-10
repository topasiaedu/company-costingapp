import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Costing",
  description: "Tech department spend tracker",
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
