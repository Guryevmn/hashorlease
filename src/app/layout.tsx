import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import "./globals.css";
import { DataProvider } from "@/components/DataProvider";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Hash or Lease",
  description: "Hourly call per mining place: Mine, Lease to AI, or Switch off. Demo data on testnet.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <DataProvider>
            <Shell>{children}</Shell>
          </DataProvider>
        </Suspense>
      </body>
    </html>
  );
}
