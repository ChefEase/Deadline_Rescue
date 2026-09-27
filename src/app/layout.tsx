import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { AppStoreProvider } from "@/store/app-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deadline Rescue",
  description: "A study plan that helps students focus on one task at a time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppStoreProvider><AppShell>{children}</AppShell></AppStoreProvider>
      </body>
    </html>
  );
}
