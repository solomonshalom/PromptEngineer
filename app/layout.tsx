import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { PageTransitionProvider } from "@/components/page-transition-provider";

const cursorSans = localFont({
  variable: "--font-cursor-sans",
  display: "swap",
  fallback: ["system-ui", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
  src: [
    {
      path: "../public/fonts/CursorGothic-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/CursorGothic-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/CursorGothic-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/CursorGothic-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://promptengineer.app"),
  title: "promptengineer",
  description: "Learn prompt engineering through typing practice",
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cursorSans.variable}>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <PageTransitionProvider>{children}</PageTransitionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
