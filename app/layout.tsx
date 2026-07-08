import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Form Pemesanan Pakan",
  description: "Aplikasi pemesanan pakan dengan Google Sheets dan PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
