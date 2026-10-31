// -----------------------------------------------------------------------
// Products page ( URL: /products )
// Table with search and paging, plus Add / Edit (one form) and Delete
// (with a confirm step). Reads with catalog-api's public endpoints and
// changes with its admin endpoints.
// -----------------------------------------------------------------------

import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { formatPrice, friendlyError } from '../../format';
import { PagedProducts, Product, ProductInput } from '../../models';
import { ProductService } from '../../services/product.service';

const PAGE_SIZE = 20;

/**
 * The image path must be relative, like "products/laptop-stand.webp".
 * Same rule as catalog-api: no full URLs, no leading "/", no "..".
 */
export function imagePathValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (value === '') {
    return null;   // optional
  }
  const allowedCharacters = /^[A-Za-z0-9/_.-]+$/;
  if (value.startsWith('/') || value.includes('..') || !allowedCharacters.test(value)) {
    return { imagePath: true };
  }
  return null;
}

@Component({
  selector: 'app-products-page',
  imports: [ReactiveFormsModule],
  templateUrl: './products.page.html',
})
export class ProductsPage implements OnInit {
  private readonly products = inject(ProductService);
  readonly formatPrice = formatPrice;

  // ----- List state -----
  readonly data = signal<PagedProducts | null>(null);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');          // e.g. "Product saved."
  // A FormGroup (not just a box) so Angular handles the form's submit;
  // otherwise the browser would reload the page.
  readonly searchForm = new FormGroup({
    text: new FormControl('', { nonNullable: true }),
  });
  private search = '';                   // the search that is currently shown

  // ----- Form state: closed, adding a new product, or editing one -----
  readonly formMode = signal<'closed' | 'add' | 'edit'>('closed');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  // ----- Delete: the product waiting for "Yes, delete" -----
  readonly confirmDelete = signal<Product | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    category: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    }),
    // null = empty box. More than 0 and less than 1,000,000 (same as catalog-api)
    price: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01), Validators.max(999999.99)],
    }),
    imageUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200), imagePathValidator] }),
  });

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.products.getPage(this.page(), PAGE_SIZE, this.search));
      this.data.set(result);
    } catch (err) {
      this.error.set(friendlyError(err));
    } finally {
      this.loading.set(false);
    }
  }

  // A new search always starts again at page 1
  applySearch(): void {
    this.search = this.searchForm.controls.text.value;
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  // ----- Add / Edit -----

  openAdd(): void {
    this.form.reset({ name: '', category: '', price: null, imageUrl: '' });
    this.editingId.set(null);
    this.formError.set('');
    this.formMode.set('add');
  }

  async openEdit(product: Product): Promise<void> {
    this.formError.set('');
    this.notice.set('');
    try {
      // Load from the admin endpoint: it has the image PATH, not the full URL
      const fresh = await firstValueFrom(this.products.getForEdit(product.id));
      this.form.reset({
        name: fresh.name,
        category: fresh.category,
        price: fresh.price,
        imageUrl: fresh.imageUrl ?? '',
      });
      this.editingId.set(product.id);
      this.formMode.set('edit');
    } catch (err) {
      this.error.set(friendlyError(err));
    }
  }

  closeForm(): void {
    this.formMode.set('closed');
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();   // show every problem at once
      return;
    }

    const value = this.form.getRawValue();
    const input: ProductInput = {
      name: value.name.trim(),
      category: value.category.trim(),
      price: Number(value.price),
      imageUrl: value.imageUrl.trim() === '' ? null : value.imageUrl.trim(),
    };

    this.saving.set(true);
    this.formError.set('');
    try {
      const id = this.editingId();
      if (id === null) {
        await firstValueFrom(this.products.create(input));
        this.notice.set(`Product "${input.name}" added.`);
      } else {
        await firstValueFrom(this.products.update(id, input));
        this.notice.set(`Product "${input.name}" saved.`);
      }
      this.formMode.set('closed');
      this.load();
    } catch (err) {
      // e.g. 400 "price must be more than 0", or 403 "not allowed"
      this.formError.set(friendlyError(err));
    } finally {
      this.saving.set(false);
    }
  }

  // ----- Delete (two steps, so a mis-click can't delete a product) -----

  askDelete(product: Product): void {
    this.notice.set('');
    this.confirmDelete.set(product);
  }

  cancelDelete(): void {
    this.confirmDelete.set(null);
  }

  async deleteConfirmed(): Promise<void> {
    const product = this.confirmDelete();
    if (!product) {
      return;
    }
    try {
      await firstValueFrom(this.products.delete(product.id));
      this.notice.set(`Product "${product.name}" deleted.`);
      this.confirmDelete.set(null);
      this.load();
    } catch (err) {
      this.confirmDelete.set(null);
      this.error.set(friendlyError(err));
    }
  }

  // Show a field's problem only after the user touched it (or pressed Save)
  showError(field: 'name' | 'category' | 'price' | 'imageUrl'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }
}
