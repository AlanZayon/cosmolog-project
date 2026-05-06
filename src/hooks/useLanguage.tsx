import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { type Language, type TranslationKey, getTranslation } from "@/i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function isLanguage(value: string | null): value is Language {
  return value === "pt" || value === "en" || value === "ja" || value === "es";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt");

  useEffect(() => {
    const saved = localStorage.getItem("cosmolog-lang");
    if (isLanguage(saved)) setLanguageState(saved);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("cosmolog-lang", lang);
  }, []);

  const t = useCallback((key: TranslationKey) => getTranslation(key, language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
