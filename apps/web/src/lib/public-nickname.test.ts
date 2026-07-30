import { describe, expect, it } from 'vitest';
import { publicNicknameSchema } from './public-nickname';

describe('publicNicknameSchema', () => {
  it('keeps international nicknames and trims surrounding whitespace', () => {
    expect(publicNicknameSchema.parse({ nickname: '  Никита  ' })).toEqual({
      nickname: 'Никита',
    });
  });

  it('rejects an empty nickname', () => {
    expect(() => publicNicknameSchema.parse({ nickname: '   ' })).toThrow();
  });

  it('rejects nicknames longer than 50 characters', () => {
    expect(() =>
      publicNicknameSchema.parse({ nickname: 'x'.repeat(51) }),
    ).toThrow();
  });
});
