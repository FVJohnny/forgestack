import { describe, expect, it } from 'vitest';

import { defaultLocale, localeFlags, localeNames, locales } from './config';

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
