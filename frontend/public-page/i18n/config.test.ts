import { describe, expect, it } from 'vitest';

import { defaultLocale, localeFlags, localeNames, locales, negotiateLocale } from './config';

// Guards the locale registry: every supported locale must have a display name
// and a flag, and the default must be one of them. A locale added to `locales`
// without a name/flag would ship a broken language switcher; this catches it.
describe('i18n config', () => {
  it('has a name for every locale', () => {
    for (const locale of locales) {
      expect(localeNames[locale], `missing name for ${locale}`).toBeTruthy();
    }
    expect(Object.keys(localeNames).sort()).toEqual([...locales].sort());
  });

  it('has a flag for every locale', () => {
    for (const locale of locales) {
      expect(localeFlags[locale], `missing flag for ${locale}`).toBeTruthy();
    }
    expect(Object.keys(localeFlags).sort()).toEqual([...locales].sort());
  });

  it('has a default locale that is in the list', () => {
    expect(locales).toContain(defaultLocale);
  });

  it('has no duplicate locales', () => {
    expect(new Set(locales).size).toBe(locales.length);
  });
});

// Item 156: negotiation must walk the whole q-sorted list, not just the
// first tag, so a supported locale listed second still wins.
describe('negotiateLocale', () => {
  it('matches the first tag when supported', () => {
    expect(negotiateLocale('es-ES,es;q=0.9,en;q=0.8')).toBe('es');
  });

  it('falls through an unsupported first tag to a supported later one', () => {
    expect(negotiateLocale('ca,es;q=0.9')).toBe('es');
  });

  it('respects q-values over list order', () => {
    expect(negotiateLocale('de;q=0.5,fr;q=0.9')).toBe('fr');
  });

  it('ignores tags with q=0', () => {
    expect(negotiateLocale('es;q=0,fr;q=0.5')).toBe('fr');
  });

  it('returns null when nothing matches or the header is missing', () => {
    expect(negotiateLocale('ca,eu;q=0.9')).toBeNull();
    expect(negotiateLocale(null)).toBeNull();
    expect(negotiateLocale('')).toBeNull();
  });
});
