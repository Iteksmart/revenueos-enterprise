import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://revenueos.itechsmart.dev"),
  title: "RevenueOS Enterprise | iTechSmart",
  description: "The AI Revenue Operating System that Finds, Qualifies, Nurtures, Closes, and Grows Customers.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "RevenueOS Enterprise | iTechSmart",
    description: "The AI Revenue Operating System that Finds, Qualifies, Nurtures, Closes, and Grows Customers.",
    url: "https://revenueos.itechsmart.dev",
    siteName: "iTechSmart RevenueOS Enterprise",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
