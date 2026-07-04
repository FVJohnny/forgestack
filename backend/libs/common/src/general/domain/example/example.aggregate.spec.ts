import { EntityExample } from './example.aggregate';

describe('EntityExample', () => {
  it('preserves identity and timestamps across a fromValue/toValue round-trip', () => {
    const original = EntityExample.create({ value: 'hello' });
    const dto = original.toValue();

    const rehydrated = EntityExample.fromValue(dto);

    // Regression: the constructor must pass id/timestamps to super(),
    // otherwise fromValue() would mint a new random id and timestamps and a
    // repository round-trip would return a different entity.
    expect(rehydrated.id.toValue()).toBe(original.id.toValue());
    expect(rehydrated.toValue()).toEqual(dto);
  });

  it('assigns a fresh id to a newly created entity', () => {
    const a = EntityExample.create({ value: 'a' });
    const b = EntityExample.create({ value: 'b' });
    expect(a.id.toValue()).not.toBe(b.id.toValue());
  });
});
