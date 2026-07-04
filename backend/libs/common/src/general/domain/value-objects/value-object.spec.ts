import { DomainValidationException } from '../../../errors';

import { DateVO } from './date.vo';
import { Id } from './id.vo';
import { StringValueObject } from './string.vo';

class Name extends StringValueObject {}
class Nickname extends StringValueObject {}

describe('ValueObject.equals (item 57)', () => {
  it('is true for the same VO type and value', () => {
    expect(new Name('alice').equals(new Name('alice'))).toBe(true);
  });

  it('is false for a different value', () => {
    expect(new Name('alice').equals(new Name('bob'))).toBe(false);
  });

  it('is false across VO types even with the same value (prototype, not name)', () => {
    // Both are StringValueObjects wrapping 'alice'; they must NOT be equal.
    // The old constructor.name check would also reject these, but it breaks
    // under minification; the prototype check is stable.
    expect(new Name('alice').equals(new Nickname('alice') as unknown as Name)).toBe(false);
  });

  it('compares Dates by value, not reference', () => {
    const a = new DateVO(new Date('2020-01-01T00:00:00.000Z'));
    const b = new DateVO(new Date('2020-01-01T00:00:00.000Z'));
    expect(a.equals(b)).toBe(true);
  });
});

describe('DateVO validation (item 57)', () => {
  it('rejects an invalid date string', () => {
    expect(() => new DateVO('not-a-date')).toThrow(DomainValidationException);
  });

  it('accepts the epoch sentinel (none)', () => {
    expect(() => DateVO.none()).not.toThrow();
    expect(DateVO.none().isNone()).toBe(true);
  });

  it('accepts a valid ISO string', () => {
    expect(() => new DateVO('2020-01-01T00:00:00.000Z')).not.toThrow();
  });
});

describe('Id validation (item 57)', () => {
  it('accepts a valid uuid and rejects a non-uuid', () => {
    expect(() => Id.random()).not.toThrow();
    expect(() => new Id('not-a-uuid')).toThrow(DomainValidationException);
  });

  it('validates exactly once (validate is called through the base ctor only)', () => {
    const spy = jest.spyOn(Id.prototype, 'validate');
    new Id('123e4567-e89b-12d3-a456-426614174000');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
