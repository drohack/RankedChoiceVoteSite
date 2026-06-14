import { describe, it, expect } from 'vitest';
import { parseVotingInput, ValidationError } from './validation';

describe('parseVotingInput', () => {
  it('accepts a valid payload and trims text', () => {
    const out = parseVotingInput({
      title: '  Best Color  ',
      masterImage: '/uploads/m.webp',
      items: [
        { name: '  Crimson ', image: '/uploads/c.webp' },
        { name: 'Emerald', image: null },
      ],
    });
    expect(out.title).toBe('Best Color');
    expect(out.masterImage).toBe('/uploads/m.webp');
    expect(out.items).toEqual([
      { name: 'Crimson', image: '/uploads/c.webp' },
      { name: 'Emerald', image: null },
    ]);
  });

  it('treats an empty master image as null', () => {
    const out = parseVotingInput({ title: 'X', masterImage: '', items: [{ name: 'A' }] });
    expect(out.masterImage).toBeNull();
  });

  it('rejects a missing or blank title', () => {
    expect(() => parseVotingInput({ title: '', items: [] })).toThrow(ValidationError);
    expect(() => parseVotingInput({ title: '   ', items: [] })).toThrow(ValidationError);
    expect(() => parseVotingInput({ items: [] })).toThrow(ValidationError);
  });

  it('rejects an overly long title', () => {
    expect(() =>
      parseVotingInput({ title: 'x'.repeat(201), items: [] })
    ).toThrow(/too long/i);
  });

  it('rejects a non-array items field', () => {
    expect(() =>
      parseVotingInput({ title: 'X', items: 'nope' })
    ).toThrow(ValidationError);
  });

  it('rejects an item with no name', () => {
    expect(() =>
      parseVotingInput({ title: 'X', items: [{ name: '  ' }] })
    ).toThrow(/needs a name/i);
  });

  it('rejects too many items', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ name: `item ${i}` }));
    expect(() => parseVotingInput({ title: 'X', items })).toThrow(/too many/i);
  });

  it('rejects a non-object body', () => {
    expect(() => parseVotingInput(null)).toThrow(ValidationError);
    expect(() => parseVotingInput('hi')).toThrow(ValidationError);
  });
});
