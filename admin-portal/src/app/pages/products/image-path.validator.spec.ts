import { FormControl } from '@angular/forms';
import { imagePathValidator } from './products.page';

describe('imagePathValidator (same rule as catalog-api)', () => {
  function check(value: string): boolean {
    return imagePathValidator(new FormControl(value)) === null;
  }

  it('allows an empty value (image is optional)', () => {
    expect(check('')).toBe(true);
  });

  it('allows a relative path', () => {
    expect(check('products/laptop-stand.webp')).toBe(true);
  });

  it('rejects full URLs, a leading "/" and ".."', () => {
    expect(check('https://example.com/x.webp')).toBe(false);
    expect(check('/products/x.webp')).toBe(false);
    expect(check('products/../secret')).toBe(false);
    expect(check('products/my image.webp')).toBe(false);   // spaces not allowed
  });
});
