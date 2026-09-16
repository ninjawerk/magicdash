/**
 * Translations. Plugins ship dictionaries in `definePlugin({ translations: { en: {...}, de: {...} } })`
 * and read strings with `const t = useT(manifest.id)` → `t('greeting.morning', { name })`.
 * The host picks the locale from the layout setting (`layout.locale`), falling back to the browser's.
 * Missing keys fall back to English, then to the key itself, so partial translations are fine.
 */
import { useEffect, useState } from 'react';

export type Dictionary = Record<string, string>;
export type Translations = Record<string, Dictionary>; // locale → key → string

const registry = new Map<string, Translations>(); // namespace (plugin id or 'host') → translations
let locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
const listeners = new Set<() => void>();

export function registerTranslations(namespace: string, translations: Translations) {
  registry.set(namespace, translations);
}

export function setLocale(next: string | undefined) {
  const l = next?.trim() || (typeof navigator !== 'undefined' ? navigator.language : 'en');
  if (l === locale) return;
  locale = l;
  listeners.forEach((fn) => fn());
}
export function getLocale() {
  return locale;
}

function lookup(namespace: string, key: string): string | undefined {
  const dict = registry.get(namespace);
  if (!dict) return undefined;
  const lang = locale.toLowerCase();
  const short = lang.split('-')[0];
  return dict[lang]?.[key] ?? dict[short]?.[key] ?? dict.en?.[key];
}

/** Translate `key` in a namespace, interpolating `{name}` style variables. */
export function translate(namespace: string, key: string, vars?: Record<string, string | number>): string {
  let s = lookup(namespace, key) ?? lookup('host', key) ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** React hook: the selected locale (BCP-47), re-rendering when it changes. Use for Intl formatting. */
export function useLocale(): string {
  const [l, setL] = useState(locale);
  useEffect(() => {
    const fn = () => setL(locale);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return l;
}

/** React hook: returns a `t()` bound to a namespace that re-renders on locale change. */
export function useT(namespace: string) {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return (key: string, vars?: Record<string, string | number>) => translate(namespace, key, vars);
}

/** Host UI strings (kiosk-visible). Add locales here; keys are used by the host components. */
registerTranslations('host', {
  en: {
    'toolbar.edit': 'Edit',
    'toolbar.admin': 'Admin',
    'toolbar.done': 'Done',
    'toolbar.add': 'Add',
    'toolbar.theme': 'Theme',
    'toolbar.plugins': 'Plugins',
    'toolbar.remote': 'Remote',
    'toolbar.backup': 'Backup',
    'toolbar.screens': 'Screens',
    'login.title': 'Sign in to edit',
    'login.subtitle': 'Enter the admin password.',
    'login.button': 'Sign in',
    'login.cancel': 'Cancel',
    'display.off': 'Display is asleep — tap to wake',
    'common.loading': 'Loading…',
  },
  de: {
    'toolbar.edit': 'Bearbeiten',
    'toolbar.admin': 'Admin',
    'toolbar.done': 'Fertig',
    'toolbar.add': 'Hinzufügen',
    'toolbar.theme': 'Design',
    'toolbar.plugins': 'Plugins',
    'toolbar.remote': 'Fernzugriff',
    'toolbar.backup': 'Backup',
    'toolbar.screens': 'Bildschirme',
    'login.title': 'Anmelden zum Bearbeiten',
    'login.subtitle': 'Admin-Passwort eingeben.',
    'login.button': 'Anmelden',
    'login.cancel': 'Abbrechen',
    'display.off': 'Bildschirm schläft — tippen zum Aufwecken',
    'common.loading': 'Lädt…',
  },
  fr: {
    'toolbar.edit': 'Modifier',
    'toolbar.admin': 'Admin',
    'toolbar.done': 'Terminé',
    'toolbar.add': 'Ajouter',
    'toolbar.theme': 'Thème',
    'toolbar.plugins': 'Plugins',
    'toolbar.remote': 'À distance',
    'toolbar.backup': 'Sauvegarde',
    'toolbar.screens': 'Écrans',
    'login.title': 'Connexion pour modifier',
    'login.subtitle': 'Entrez le mot de passe administrateur.',
    'login.button': 'Se connecter',
    'login.cancel': 'Annuler',
    'display.off': 'Écran en veille — touchez pour réveiller',
    'common.loading': 'Chargement…',
  },
  es: {
    'toolbar.edit': 'Editar',
    'toolbar.admin': 'Admin',
    'toolbar.done': 'Listo',
    'toolbar.add': 'Añadir',
    'toolbar.theme': 'Tema',
    'toolbar.plugins': 'Plugins',
    'toolbar.remote': 'Remoto',
    'toolbar.backup': 'Copia',
    'toolbar.screens': 'Pantallas',
    'login.title': 'Inicia sesión para editar',
    'login.subtitle': 'Introduce la contraseña de administrador.',
    'login.button': 'Entrar',
    'login.cancel': 'Cancelar',
    'display.off': 'Pantalla en reposo — toca para activar',
    'common.loading': 'Cargando…',
  },
  nl: {
    'toolbar.edit': 'Bewerken',
    'toolbar.admin': 'Beheer',
    'toolbar.done': 'Klaar',
    'toolbar.add': 'Toevoegen',
    'toolbar.theme': 'Thema',
    'toolbar.plugins': 'Plugins',
    'toolbar.remote': 'Op afstand',
    'toolbar.backup': 'Back-up',
    'toolbar.screens': 'Schermen',
    'login.title': 'Inloggen om te bewerken',
    'login.subtitle': 'Voer het beheerderswachtwoord in.',
    'login.button': 'Inloggen',
    'login.cancel': 'Annuleren',
    'display.off': 'Scherm slaapt — tik om te wekken',
    'common.loading': 'Laden…',
  },
});
