import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "fam.link — your family, remembered",
    template: "%s · fam.link",
  },
  description:
    "Build your family tree as deep as you know, then hang the photos, voices, and stories on every branch. Free, private, no lock-in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
