import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RevenueOS Enterprise | iTechSmart",
  description: "The AI Revenue Operating System that Finds, Qualifies, Nurtures, Closes, and Grows Customers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
