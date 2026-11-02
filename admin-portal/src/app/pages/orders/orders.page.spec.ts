import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Order, PagedOrders } from '../../models';
import { OrdersPage } from './orders.page';

const order: Order = {
  id: 7,
  orderNumber: 'KRC-20261031-ABC123',
  userId: 1,
  username: 'krishna',
  status: 'Placed',
  subtotal: 2597,
  delivery: 0,
  total: 2597,
  createdAt: '2026-10-31T10:00:00Z',
  items: [
    { productId: 1, productName: 'Wireless Mouse', unitPrice: 1599, quantity: 1, lineTotal: 1599 },
    { productId: 4, productName: 'Clean Code', unitPrice: 499, quantity: 2, lineTotal: 998 },
  ],
};

const onePage: PagedOrders = { items: [order], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };

describe('OrdersPage', () => {
  let fixture: ComponentFixture<OrdersPage>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();   // runs ngOnInit -> loads page 1
  });

  afterEach(() => backend.verify());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  // After a fake HTTP answer, the page finishes its "await" a moment later:
  // wait one tick, then until Angular has updated the screen.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  it('shows the orders: number, customer, items count, total in ₹ and status', async () => {
    backend.expectOne('/order-api/admin/orders?page=1&pageSize=20').flush(onePage);
    await settle();

    const row = page().querySelector('tbody tr')!.textContent!;
    expect(row).toContain('KRC-20261031-ABC123');
    expect(row).toContain('krishna');
    expect(row).toContain('3');            // 1 + 2 pieces
    expect(row).toContain('₹2,597.00');
    expect(page().querySelector<HTMLSelectElement>('select')!.value).toBe('Placed');
  });

  it('changing the dropdown saves the new status', async () => {
    backend.expectOne('/order-api/admin/orders?page=1&pageSize=20').flush(onePage);
    await settle();

    const select = page().querySelector<HTMLSelectElement>('select')!;
    select.value = 'Shipped';
    select.dispatchEvent(new Event('change'));

    const request = backend.expectOne('/order-api/admin/orders/7/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'Shipped' });
    request.flush({ ...order, status: 'Shipped' });
    await settle();

    expect(page().textContent).toContain('Order KRC-20261031-ABC123 is now "Shipped".');
  });

  it('403 when saving: shows "not allowed" and puts the old status back', async () => {
    backend.expectOne('/order-api/admin/orders?page=1&pageSize=20').flush(onePage);
    await settle();

    const select = page().querySelector<HTMLSelectElement>('select')!;
    select.value = 'Cancelled';
    select.dispatchEvent(new Event('change'));
    backend.expectOne('/order-api/admin/orders/7/status').flush({}, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(page().textContent).toContain('You are not allowed to do this.');
    expect(select.value).toBe('Placed');
  });

  it('shows a friendly message when order-api is down', async () => {
    backend
      .expectOne('/order-api/admin/orders?page=1&pageSize=20')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    await settle();

    expect(page().textContent).toContain('The service is not available right now.');
  });
});
