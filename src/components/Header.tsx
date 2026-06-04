"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { PenTool, Search, User, LogOut, Globe, Sun, Moon, LogIn, UserPlus, Home, Library } from "lucide-react";
import NotificationLampIcon from "@/components/NotificationLampIcon";
import { useState } from "react";
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, type Language } from "@/i18n/translations";
import CosmologLogo from "@/components/CosmologLogo";
import HeaderNotificationCenter from "@/components/HeaderNotificationCenter";
import { COMMUNITY_FEED_ELEMENT_ID, HOME_FEED_PATH } from "@/lib/homeFeedNav";

const LANGUAGES: Language[] = ["pt", "en", "ja", "es"];

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  const closeMenu = () => setMenuOpen(false);

  const scrollToFeedOnHome = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/") return;
    e.preventDefault();
    closeMenu();
    const el = document.getElementById(COMMUNITY_FEED_ELEMENT_ID);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", HOME_FEED_PATH);
    } else {
      router.push(HOME_FEED_PATH);
    }
  };

  const accountMenuLabel =
    profile?.username?.trim() || user?.email?.split("@")[0] || t("header.profile");

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="flex h-full max-h-dvh w-full flex-col gap-0 overflow-hidden p-6 sm:max-w-sm"
        >
          <SheetHeader className="shrink-0 space-y-1 pr-10 text-left">
            <SheetTitle>{t("header.menuTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("header.menuDescription")}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-0.5 pb-4 scrollbar-none">
          <div className="flex flex-col gap-1">
            {user ? (
              <SheetClose asChild>
                <Link
                  href="/profile"
                  className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-accent"
                  title={t("header.profile")}
                  aria-label={`${t("header.profile")}: ${accountMenuLabel}`}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <User className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 truncate">{accountMenuLabel}</span>
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
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("header.quickLinks")}
            </p>
            <div className="flex flex-col gap-0.5">
              <SheetClose asChild>
                <Link
                  href={HOME_FEED_PATH}
                  onClick={scrollToFeedOnHome}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <Home className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t("header.home")}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/create"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <PenTool className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t("header.write")}
                </Link>
              </SheetClose>
              {user ? (
                <>
                  <SheetClose asChild>
                    <Link
                      href="/library"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                    >
                      <Library className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      {t("header.library")}
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/notifications"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                    >
                      <NotificationLampIcon active size="sm" className="shrink-0 text-muted-foreground" />
                      {t("notifications.alertsPageTitle")}
                    </Link>
                  </SheetClose>
                </>
              ) : null}
              <SheetClose asChild>
                <Link
                  href="/universes"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t("header.universes")}
                </Link>
              </SheetClose>
            </div>
          </div>

          <hr className="border-border" />

          <div>
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("header.appearance")}
            </p>
            <Button type="button" variant="outline" className="h-auto w-full justify-start gap-3 px-3 py-2.5 font-normal" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-5 w-5 shrink-0" /> : <Sun className="h-5 w-5 shrink-0" />}
              {theme === "light" ? t("header.themeDark") : t("header.themeLight")}
            </Button>
          </div>

          <div>
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("header.chooseLanguage")}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm hover:bg-accent ${lang === language ? "border-border bg-accent font-medium" : ""}`}
                >
                  <span className="text-base leading-none">{LANGUAGE_FLAGS[lang]}</span>
                  <span className="truncate text-xs">{LANGUAGE_LABELS[lang]}</span>
                </button>
              ))}
            </div>
          </div>

          {user ? (
            <>
              <hr className="border-border" />
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
          </div>
        </SheetContent>
      </Sheet>

      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-col gap-2 py-2 md:h-16 md:flex-row md:flex-nowrap md:items-center md:gap-4 md:py-0">
          <div className="flex min-w-0 items-center justify-between gap-3 md:contents">
            <Link
              href={HOME_FEED_PATH}
              onClick={scrollToFeedOnHome}
              className="flex shrink-0 items-center gap-2 font-bold text-xl md:order-1"
              title={t("header.home")}
            >
              <CosmologLogo size={32} />
              <span className="text-gradient font-serif hidden sm:inline">Cosmolog</span>
            </Link>

            <nav
              aria-label={t("header.mainNav")}
              className="flex shrink-0 items-center gap-1 md:order-3 md:gap-1.5"
            >
              <Button variant="outline" size="sm" asChild className="h-10 gap-1.5 px-2 font-medium sm:h-9 sm:px-2.5 md:px-3">
                <Link href="/universes" title={t("header.universes")}>
                  <Globe className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden min-[400px]:inline">{t("header.universes")}</span>
                </Link>
              </Button>
              <Button
                size="sm"
                asChild
                className="h-10 gap-1.5 px-2.5 text-sm font-semibold shadow-sm hover:opacity-95 sm:h-9 sm:px-3 gradient-warm text-primary-foreground border-0"
              >
                <Link href="/create" title={t("header.write")}>
                  <PenTool className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden min-[400px]:inline">{t("header.write")}</span>
                </Link>
              </Button>
              {user ? (
                <Button variant="outline" size="sm" asChild className="h-10 gap-1.5 px-2 font-medium sm:h-9 sm:px-2.5 md:px-3">
                  <Link href="/library" title={t("header.library")}>
                    <Library className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden min-[400px]:inline">{t("header.library")}</span>
                  </Link>
                </Button>
              ) : null}
              {!user ? (
                <>
                  <Button variant="outline" size="sm" asChild className="h-10 shrink-0 gap-1 px-2 font-medium sm:h-9 sm:px-2.5">
                    <Link href="/login" title={t("header.login")} aria-label={t("header.login")}>
                      <LogIn className="h-4 w-4 shrink-0 sm:mr-0.5" aria-hidden />
                      <span className="hidden min-[480px]:inline">{t("header.login")}</span>
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="hidden h-10 shrink-0 gap-1 border-2 border-primary/35 bg-background px-2.5 text-sm font-semibold text-primary shadow-sm hover:bg-primary/10 min-[520px]:inline-flex sm:h-9"
                  >
                    <Link href="/signup" title={t("header.signup")}>
                      <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{t("header.signup")}</span>
                    </Link>
                  </Button>
                </>
              ) : null}
              {user ? <HeaderNotificationCenter /> : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(true)}
                title={t("header.openMenu")}
                aria-label={t("header.openMenu")}
                aria-expanded={menuOpen}
                className="shrink-0 overflow-hidden"
              >
                {profile?.avatar_url ? (
                  <img
                    key={profile.avatar_url}
                    src={profile.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
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
