import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Localisation scaffolding (F-9.2).
 *
 * The product's first market is multilingual, and Urdu is right-to-left, so the shell is built for
 * RTL from the start rather than retrofitted. This dictionary covers navigation and the tree
 * controls; screen bodies are still English. Marked as partial in PROGRESS.md, not pretended.
 */

export type Locale = 'en' | 'ur';

export interface Dictionary {
  readonly [key: string]: string;
}

const en: Dictionary = {
  'app.name': 'Fam Link',
  'app.private': 'private',
  'nav.tree': 'Tree',
  'nav.people': 'People',
  'nav.calculator': 'Relationship',
  'nav.invitations': 'Invitations',
  'nav.activity': 'Activity',
  'nav.privacy': 'Privacy',
  'shell.newFamily': 'New family',
  'shell.signOut': 'Sign out',
  'shell.notices': 'Notices',
  'shell.admin': 'Family administrator',
  'shell.contributor': 'Contributor',
  'shell.privateNotice': 'Everything here is private to this family. Nothing is discoverable from outside.',
  'tree.addRelative': 'Add a relative',
  'tree.showOutline': 'Show outline',
  'tree.showChart': 'Show chart',
  'tree.compact': 'Compact',
  'tree.detailed': 'Detailed',
  'tree.moreAncestors': '+ ancestors',
  'tree.fewerAncestors': '− ancestors',
  'tree.moreDescendants': '+ descendants',
  'tree.find': 'Find in this branch…',
  'tree.addingTo': 'Adding a relative',
  'person.howRelated': 'How you are related',
  'person.details': 'Details',
  'person.closeFamily': 'Close family',
  'person.history': 'History',
  'person.focus': 'Focus the tree here',
  'privacy.title': 'Privacy',
  'privacy.audience': 'Who sees what on your profile',
};

const ur: Dictionary = {
  'app.name': 'فیم لنک',
  'app.private': 'نجی',
  'nav.tree': 'شجرہ',
  'nav.people': 'افراد',
  'nav.calculator': 'رشتہ',
  'nav.invitations': 'دعوتیں',
  'nav.activity': 'سرگرمی',
  'nav.privacy': 'نجی معلومات',
  'shell.newFamily': 'نیا خاندان',
  'shell.signOut': 'باہر نکلیں',
  'shell.notices': 'اطلاعات',
  'shell.admin': 'خاندانی منتظم',
  'shell.contributor': 'معاون',
  'shell.privateNotice': 'یہاں سب کچھ اس خاندان کے لیے نجی ہے۔ باہر سے کچھ بھی تلاش نہیں کیا جا سکتا۔',
  'tree.addRelative': 'رشتہ دار شامل کریں',
  'tree.showOutline': 'فہرست دکھائیں',
  'tree.showChart': 'شجرہ دکھائیں',
  'tree.compact': 'مختصر',
  'tree.detailed': 'تفصیلی',
  'tree.moreAncestors': '+ اوپر کی نسلیں',
  'tree.fewerAncestors': '− اوپر کی نسلیں',
  'tree.moreDescendants': '+ نیچے کی نسلیں',
  'tree.find': 'اس شاخ میں تلاش کریں…',
  'tree.addingTo': 'رشتہ دار شامل کرنا',
  'person.howRelated': 'آپ کا رشتہ کیا ہے',
  'person.details': 'تفصیلات',
  'person.closeFamily': 'قریبی خاندان',
  'person.history': 'تاریخ',
  'person.focus': 'شجرہ یہاں مرکوز کریں',
  'privacy.title': 'نجی معلومات',
  'privacy.audience': 'آپ کا پروفائل کس کو نظر آتا ہے',
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, ur };

interface LocaleContextValue {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  direction: 'ltr',
  setLocale: () => undefined,
  t: (key, fallback) => fallback ?? key,
});

const STORAGE_KEY = 'famlink.locale';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'ur' ? 'ur' : 'en';
  });

  const direction: 'ltr' | 'rtl' = locale === 'ur' ? 'rtl' : 'ltr';

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  const t = useCallback(
    (key: string, fallback?: string) => DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? fallback ?? key,
    [locale],
  );

  const value = useMemo(() => ({ locale, direction, setLocale, t }), [locale, direction, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
