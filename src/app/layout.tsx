import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMS Module - Laravel Worksuite",
  description: "Professional SMS management system for Laravel Worksuite with multi-provider support, template management, and comprehensive analytics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}