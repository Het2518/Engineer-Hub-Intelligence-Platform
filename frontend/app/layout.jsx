import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "../components/layout/Sidebar";
import { ThemeProvider } from "../components/ui/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "Axiom — Engineering Intelligence",
  description:
    "Axiom: Engineering knowledge, available through conversation. Deterministic knowledge retrieval from runbooks, playbooks, and architecture docs.",
  keywords: ["engineering", "AI", "RAG", "knowledge base", "runbooks", "documentation"],
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0C10" },
  ],
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
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex h-[100dvh] w-full overflow-hidden" suppressHydrationWarning>
            <Sidebar />
            <main className="flex-1 overflow-hidden flex flex-col relative z-0">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
