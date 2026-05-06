"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { PenTool, Search, User, LogOut, Globe, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, type Language } from "@/i18n/translations";
import CosmologLogo from "@/components/CosmologLogo";

const LANGUAGES: Language[] = ["pt", "en", "ja", "es"];

export default function Header() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [langOpen, setLangOpen] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl shrink-0">
          <CosmologLogo size={32} />
          <span className="text-gradient font-serif hidden sm:inline">Cosmolog</span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("header.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-10 pr-4 rounded-lg border border-input bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </form>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === "light" ? "Dark mode" : "Light mode"}>
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setLangOpen(!langOpen)} className="text-sm gap-1">
              {LANGUAGE_FLAGS[language]} <span className="hidden sm:inline">{LANGUAGE_LABELS[language]}</span>
            </Button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setLanguage(lang);
                      setLangOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 ${lang === language ? "bg-accent font-medium" : ""}`}
                  >
                    {LANGUAGE_FLAGS[lang]} {LANGUAGE_LABELS[lang]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/universes">
                  <Globe className="h-4 w-4 mr-1" /> {t("header.universes")}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/create">
                  <PenTool className="h-4 w-4 mr-1" /> {t("header.write")}
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/profile">
                  <User className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">{t("header.login")}</Link>
              </Button>
              <Button size="sm" className="gradient-warm text-primary-foreground" asChild>
                <Link href="/signup">{t("header.signup")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
