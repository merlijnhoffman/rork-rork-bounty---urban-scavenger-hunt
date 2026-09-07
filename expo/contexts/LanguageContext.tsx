import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  translations,
  type LanguageCode,
  type TranslationKey,
} from '@/lib/i18n';

const STORAGE_KEY = 'app-language';

/** Best-effort device locale detection without a native dependency. */
function detectDeviceLanguage(): LanguageCode {
  try {
    let locale: string | undefined;
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      locale = settings?.AppleLocale || settings?.AppleLanguages?.[0];
    } else {
      locale = NativeModules.I18nManager?.localeIdentifier;
    }
    if (locale) {
      const code = locale.split(/[-_]/)[0].toLowerCase() as LanguageCode;
      if (code in translations) return code;
    }
  } catch {
    // fall through to English
  }
  return 'en';
}

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  // Load the saved choice on first launch; fall back to the device language.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored && stored in translations) {
          setLanguageState(stored as LanguageCode);
        } else {
          setLanguageState(detectDeviceLanguage());
        }
      })
      .catch(() => {
        if (!cancelled) setLanguageState(detectDeviceLanguage());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  /** Translate a key in the current language, with optional {param} interpolation. */
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text: string = translations[language]?.[key] ?? translations.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [language],
  );

  return useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );
});

export type { LanguageCode, TranslationKey };
