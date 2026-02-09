import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Dashboard",
  description: "AI Assistant Management Console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-900 text-dark-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
