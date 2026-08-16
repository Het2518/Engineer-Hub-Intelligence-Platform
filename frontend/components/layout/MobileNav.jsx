"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, BookOpen, Upload, Zap } from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/map", label: "Map", icon: Zap },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/upload", label: "Upload", icon: Upload },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[0.65rem] font-medium tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
