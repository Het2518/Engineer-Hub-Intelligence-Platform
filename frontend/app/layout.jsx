import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "../components/layout/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Engineer Hub — Engineering Intelligence Platform",
  description:
    "AI-powered knowledge base for engineering teams. Search docs, runbooks, incident reports, and code repositories using natural language.",
  keywords: ["engineering", "AI", "RAG", "documentation", "knowledge base"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`} suppressHydrationWarning>
        <div className="flex h-[100dvh] w-full overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden flex flex-col relative z-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
