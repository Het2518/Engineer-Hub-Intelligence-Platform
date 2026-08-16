import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileNav } from "../components/layout/MobileNav";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // MutationObserver to strip browser-extension-injected attributes
                // (Bitdefender bis_skin_checked, Grammarly, etc.) BEFORE React hydration
                var extAttrs = ['bis_skin_checked','data-gr-ext-installed','data-new-gr-c-s-check-loaded','data-gr-ext-disabled'];
                var obs = new MutationObserver(function(mutations) {
                  for (var i = 0; i < mutations.length; i++) {
                    var m = mutations[i];
                    if (m.type === 'attributes' && extAttrs.indexOf(m.attributeName) !== -1) {
                      m.target.removeAttribute(m.attributeName);
                    }
                    if (m.type === 'childList') {
                      for (var j = 0; j < m.addedNodes.length; j++) {
                        var node = m.addedNodes[j];
                        if (node.nodeType === 1) {
                          extAttrs.forEach(function(a) { node.removeAttribute(a); });
                          node.querySelectorAll('[bis_skin_checked],[data-gr-ext-installed]').forEach(function(el) {
                            extAttrs.forEach(function(a) { el.removeAttribute(a); });
                          });
                        }
                      }
                    }
                  }
                });
                obs.observe(document.documentElement, { attributes: true, attributeFilter: extAttrs, childList: true, subtree: true });
                // Auto-disconnect after hydration window (5s)
                setTimeout(function() { obs.disconnect(); }, 5000);
              })();
            `,
          }}
        />
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
          <div className="flex h-[100dvh] w-full overflow-hidden bg-background" suppressHydrationWarning>
            <div className="hidden md:flex h-full">
              <Sidebar />
            </div>
            <main className="flex-1 overflow-hidden flex flex-col relative z-0 pb-16 md:pb-0">
              {children}
            </main>
            <MobileNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
