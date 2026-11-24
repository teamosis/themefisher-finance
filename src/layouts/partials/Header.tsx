import ThemeSwitcher from "@/components/ThemeSwitcher";
import config from "@/config/config.json";
import menu from "@/config/menu.json";
import { Landmark } from "lucide-react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="header sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border py-2.5 px-4 sm:px-8 print:hidden transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
            <Landmark className="size-5" />
          </div>
          <span className="text-base font-bold text-text-strong leading-tight group-hover:text-primary transition-colors">
            {config.site.title}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden md:flex items-center gap-1.5">
            {menu.main.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-default hover:text-text-strong hover:bg-light transition-all duration-150"
              >
                {item.name}
              </Link>
            ))}
          </nav>
          {config.settings.theme_switcher && <ThemeSwitcher />}
        </div>
      </div>
    </header>
  );
}
