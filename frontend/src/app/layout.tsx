import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

/** Metadata root moLearn (fase 1: landing + skelaton routing). */
export const metadata: Metadata = {
  title: {
    default: "moLearn — Explore Life, One Molecule at a Time",
    template: "%s • moLearn",
  },
  description:
    "moLearn turns gene and protein data into a clear, beginner-friendly " +
    "learning experience — with plain explanations, 3D structure, and " +
    "biological relationship maps.",
  applicationName: "moLearn",
};

export const viewport: Viewport = {
  themeColor: "#244D38",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-surface text-on-surface antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
