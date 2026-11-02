// -----------------------------------------------------------------------
// A fake backend for tests: answers fetch() calls like nginx + catalog-api
// + auth-api + order-api would, using a small product list. Paging, search, category
// and sort work like the real Data API.
// -----------------------------------------------------------------------

export const KEY = '11111111-2222-3333-4444-555555555555';

// 30 products: 25 Electronics + Wireless Mouse etc., enough for 2 pages of 24
export const sampleProducts = [
  { id: 1, name: 'Wireless Mouse', category: 'Electronics', price: 1599, imageUrl: null },
  { id: 2, name: 'Standing Desk', category: 'Furniture', price: 5199, imageUrl: null },
  { id: 3, name: 'Noise Cancelling Headphones', category: 'Electronics', price: 1799, imageUrl: null },
  { id: 4, name: 'Clean Code', category: 'Books', price: 499, imageUrl: null },
  ...Array.from({ length: 26 }, (_, i) => ({
    id: 5 + i, name: `Gadget ${i + 1}`, category: 'Electronics', price: 1000 + i, imageUrl: null
  }))
];

function reply(status, body) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

export function fakeFetch(url, options = {}) {
  const u = new URL(url, 'http://localhost');
  const body = options.body ? JSON.parse(options.body) : {};

  // ----- catalog-api -----
  if (u.pathname === '/catalog-api/products/categories') {
    return reply(200, [...new Set(sampleProducts.map((p) => p.category))].sort());
  }

  if (u.pathname === '/catalog-api/products/paged') {
    const page = Number(u.searchParams.get('page') || 1);
    const pageSize = Number(u.searchParams.get('pageSize') || 24);
    const search = (u.searchParams.get('search') || '').toLowerCase();
    const category = u.searchParams.get('category');
    const sort = u.searchParams.get('sort');

    let list = sampleProducts.filter((p) =>
      (!category || p.category === category) &&
      (!search || p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search)));
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return reply(200, {
      items: list.slice((page - 1) * pageSize, page * pageSize),
      page, pageSize,
      totalCount: list.length,
      totalPages: Math.ceil(list.length / pageSize)
    });
  }

  const productMatch = u.pathname.match(/^\/catalog-api\/products\/(\d+)$/);
  if (productMatch) {
    const product = sampleProducts.find((p) => p.id === Number(productMatch[1]));
    return product ? reply(200, product) : reply(404, { message: 'Product not found.' });
  }

  // ----- auth-api -----
  if (u.pathname === '/api/auth/signup') {
    return body.username === 'taken'
      ? reply(409, { message: 'That username is already taken.' })
      : reply(201, { username: body.username, userKey: KEY });
  }
  if (u.pathname === '/api/auth/login') {
    return body.userKey === KEY
      ? reply(200, { token: 'test-token', username: body.username })
      : reply(401, { message: 'Invalid username or user key.' });
  }
  if (u.pathname === '/api/auth/me') {
    return options.headers?.Authorization === 'Bearer test-token'
      ? reply(200, { id: 1, username: 'krishna' })
      : reply(401, {});
  }

  // ----- order-api -----
  // Like the real Order API: prices come from the product list (NOT from the
  // request), and the order number is made on the "server".
  if (u.pathname === '/order-api/orders' && options.method === 'POST') {
    if (options.headers?.Authorization !== 'Bearer test-token') {
      return reply(401, { message: 'Please log in to continue.' });
    }

    const items = [];
    for (const { productId, quantity } of body.items) {
      const product = sampleProducts.find((p) => p.id === productId);
      if (!product) return reply(400, { message: `Product ${productId} does not exist.` });
      items.push({ productId, productName: product.name, unitPrice: product.price, quantity, lineTotal: product.price * quantity });
    }

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const delivery = subtotal > 999 ? 0 : 49;
    return reply(201, {
      id: 1, orderNumber: 'KRC-20261031-TEST01', userId: 1, username: 'krishna', status: 'Placed',
      subtotal, delivery, total: subtotal + delivery, createdAt: '2026-10-31T10:00:00Z', items
    });
  }

  return reply(404, {});
}
