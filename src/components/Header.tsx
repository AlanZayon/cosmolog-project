"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PenTool, Search, User, LogOut, Globe, Sun, Moon, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, type Language } from "@/i18n/translations";
import CosmologLogo from "@/components/CosmologLogo";

const LANGUAGES: Language[] = ["pt", "en", "ja", "es"];

export default function Header() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-6 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{t("header.menuTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("header.menuDescription")}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            {user ? (
              <SheetClose asChild>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <User className="h-5 w-5 shrink-0 text-muted-foreground" />
                  {t("header.profile")}
                </Link>
              </SheetClose>
            ) : (
              <>
                <SheetClose asChild>
                  <Link
                    href="/login"
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    <LogIn className="h-5 w-5 shrink-0 text-muted-foreground" />
                    {t("header.login")}
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/signup"
                    className="gradient-warm mx-3 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium text-primary-foreground hover:opacity-95"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden />
                    {t("header.signup")}
                  </Link>
                </SheetClose>
              </>
            )}
          </div>

          <hr className="border-border" />

          <div>
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("header.appearance")}
            </p>
            <Button type="button" variant="outline" className="h-auto w-full justify-start gap-3 px-3 py-3 font-normal" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-5 w-5 shrink-0" /> : <Sun className="h-5 w-5 shrink-0" />}
              {theme === "light" ? t("header.themeDark") : t("header.themeLight")}
            </Button>
          </div>

          <div>
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("header.chooseLanguage")}
            </p>
            <div className="flex flex-col gap-0.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent ${lang === language ? "bg-accent font-medium" : ""}`}
                >
                  <span className="text-lg leading-none">{LANGUAGE_FLAGS[lang]}</span>
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
          </div>

          {user ? (
            <>
              <hr className="border-border mt-auto" />
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  closeMenu();
                  signOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                {t("header.logout")}
              </Button>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-col gap-2 py-2 md:h-16 md:flex-row md:flex-nowrap md:items-center md:gap-4 md:py-0">
          <div className="flex min-w-0 items-center justify-between gap-3 md:contents">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-bold text-xl md:order-1">
              <CosmologLogo size={32} />
              <span className="text-gradient font-serif hidden sm:inline">Cosmolog</span>
            </Link>

            <nav
              aria-label={t("header.mainNav")}
              className="flex shrink-0 items-center gap-0.5 md:order-3 md:gap-1"
            >
              <Button variant="ghost" size="sm" asChild className="px-2 md:px-3">
                <Link href="/universes" title={t("header.universes")}>
                  <Globe className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline">{t("header.universes")}</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="px-2 md:px-3">
                <Link href="/create" title={t("header.write")}>
                  <PenTool className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline">{t("header.write")}</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(true)}
                title={t("header.openMenu")}
                aria-label={t("header.openMenu")}
                aria-expanded={menuOpen}
              >
                <User className="h-4 w-4" />
              </Button>
            </nav>
          </div>

          <form
            onSubmit={handleSearch}
            className="w-full min-w-0 md:order-2 md:mx-auto md:max-w-md md:flex-1"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("header.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-muted/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring md:h-9"
              />
            </div>
          </form>
        </div>
      </header>
    </>
  );
}
