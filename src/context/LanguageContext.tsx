import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'ta' | 'en';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isTamil: boolean;
  isEnglish: boolean;
  t: (taText: string, enText: string) => string;
}

const STORAGE_KEY_LANGUAGE = 'windowbuilder_app_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LANGUAGE);
      if (stored === 'en' || stored === 'ta') return stored;
    } catch (_) {}
    return 'ta'; // Default to Tamil
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
    } catch (_) {}
  };

  const toggleLanguage = () => {
    const nextLang: Language = language === 'ta' ? 'en' : 'ta';
    setLanguage(nextLang);
  };

  const t = (taText: string, enText: string): string => {
    return language === 'ta' ? taText : enText;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        isTamil: language === 'ta',
        isEnglish: language === 'en',
        t
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'ta',
      setLanguage: () => {},
      toggleLanguage: () => {},
      isTamil: true,
      isEnglish: false,
      t: (ta: string, en: string) => ta
    };
  }
  return context;
};
