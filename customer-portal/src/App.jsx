import { useEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { fetchCategories } from './services/catalogApiService.js';
import { signup, login, fetchMe, getSavedToken, saveToken, clearToken } from './services/authApiService.js';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import LoginDialog from './components/LoginDialog.jsx';
import SignupDialog from './components/SignupDialog.jsx';
import Toast from './components/Toast.jsx';
import HomePage from './pages/HomePage.jsx';
import ProductDetailsPage from './pages/ProductDetailsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import CartPage from './pages/CartPage.jsx';
import OrderConfirmationPage from './pages/OrderConfirmationPage.jsx';
import { MAX_QUANTITY, loadCart, saveCart, toCartProduct } from './utils/cartUtils.js';

// -----------------------------------------------------------------------
// App = the whole site.
// - Header, Footer, dialogs and Toast are shown on every page.
// - <Routes> picks the page from the URL:
//     /             -> HomePage (product grid)
//     /product/:id  -> ProductDetailsPage (one product)
//     /cart         -> CartPage
//     /order-confirmation -> OrderConfirmationPage
//     anything else -> NotFoundPage
// - Shared state (filters, page number, cart, user) lives here, so it is
//   kept when the user moves between pages.
// - Products are NOT all loaded here any more: each page asks the API
//   for only what it shows (one page of products, or one product).
// -----------------------------------------------------------------------
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // ----- Category chips (loaded once from the Catalog API) -----
  const [categories, setCategories] = useState(['All']);

  // ----- What the user has chosen on the home page -----
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [page, setPage] = useState(1);

  // ----- Cart: { productId: { product, quantity } } -----
  // Starts from the cart saved in the browser, so a refresh keeps it.
  const [cartItems, setCartItems] = useState(() => loadCart());

  // ----- Last placed order (shown on the confirmation page) -----
  const [lastOrder, setLastOrder] = useState(null);

  // ----- Logged-in user: { id, username } or null -----
  // Sign up / log in go to the Auth API, which uses the Data API (database).
  const [currentUser, setCurrentUser] = useState(null);
  const [openDialog, setOpenDialog] = useState(null); // null | 'login' | 'signup'

  // ----- Toast message -----
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef(null);

  // Load the category list ONCE when the site opens.
  // Browser calls /catalog-api/products/categories -> nginx -> catalog-api -> data-api -> Azure SQL
  useEffect(() => {
    fetchCategories()
      .then((list) => setCategories(['All', ...list]))
      .catch(() => setCategories(['All']));   // chips are optional; the product grid shows any error
  }, []);

  // Save the cart in the browser every time it changes
  useEffect(() => {
    saveCart(cartItems);
  }, [cartItems]);

  // Keep the user logged in after a page refresh:
  // if a token was saved earlier, ask the Auth API who it belongs to.
  useEffect(() => {
    const token = getSavedToken();
    if (!token) return;

    fetchMe(token)
      .then((user) => setCurrentUser(user))
      .catch(() => clearToken());   // expired or invalid token -> forget it
  }, []);

  // Show a toast for 2 seconds
  function showToast(text) {
    setToastMessage(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(''), 2000);
  }

  // Typing in the header search always shows results on the home page, from page 1
  function handleSearchChange(text) {
    setSearchText(text);
    setPage(1);
    if (location.pathname !== '/') navigate('/');
  }

  // A new category or sort order also starts again from page 1
  function handleCategoryChange(category) {
    setSelectedCategory(category);
    setPage(1);
  }

  function handleSortChange(sort) {
    setSortBy(sort);
    setPage(1);
  }

  // Add a quantity of a product to the cart (adds to what is already there, max 10)
  function handleAddToCart(product, quantity) {
    const current = cartItems[product.id] ? cartItems[product.id].quantity : 0;
    setCartItems({
      ...cartItems,
      [product.id]: { product: toCartProduct(product), quantity: Math.min(MAX_QUANTITY, current + quantity) }
    });
    showToast(quantity > 1
      ? `${quantity} × ${product.name} added to cart`
      : `${product.name} added to cart`);
  }

  // Cart page +/- buttons. Quantity 0 removes the product.
  function handleQuantityChange(productId, quantity) {
    if (quantity <= 0) {
      const updated = { ...cartItems };   // copy the cart
      delete updated[productId];          // take this product out
      setCartItems(updated);
      return;
    }
    const line = cartItems[productId];
    setCartItems({ ...cartItems, [productId]: { ...line, quantity: Math.min(MAX_QUANTITY, quantity) } });
  }

  function handleRemoveFromCart(product) {
    handleQuantityChange(product.id, 0);
    showToast(product.name + ' removed from cart');
  }

  // DEMO: no order-api yet, so we only make an order number, empty the cart
  // and show the confirmation page. Later: POST /order-api/orders.
  function handlePlaceOrder(lines, summary) {
    const orderNumber = 'KR' + Date.now().toString().slice(-8);
    setLastOrder({ orderNumber, username: currentUser.username, lines, summary });
    setCartItems({});
    navigate('/order-confirmation');
  }

  // Sign up: the user is saved in the database (only if the username is new).
  // Returns { userKey } on success or { error } on failure.
  async function handleSignup(username) {
    try {
      const result = await signup(username);
      return { userKey: result.userKey };
    } catch (err) {
      return { error: err.message };   // e.g. "That username is already taken."
    }
  }

  // Log in: get a token, save it, and show the user as logged in.
  // Returns an error message, or null when login worked.
  async function handleLogin(username, userKey) {
    try {
      const result = await login(username, userKey);
      saveToken(result.token);
      setCurrentUser({ username: result.username });
      setOpenDialog(null);
      showToast('Welcome back, ' + result.username);
      return null;
    } catch (err) {
      return err.message;              // e.g. "Invalid username or user key."
    }
  }

  function handleLogout() {
    clearToken();
    setCurrentUser(null);
    showToast('You are logged out');
  }

  function handleCopyKey(key) {
    navigator.clipboard.writeText(key).then(
      () => showToast('User key copied'),
      () => showToast('Copy failed — select the key and copy it')
    );
  }

  // Total items in the cart = sum of all quantities
  const cartCount = Object.values(cartItems).reduce((sum, line) => sum + line.quantity, 0);

  // The page for the current URL (each page loads its own data)
  const content = (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            searchText={searchText}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            page={page}
            onPageChange={setPage}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
          />
        }
      />
      <Route
        path="/product/:id"
        element={
          <ProductDetailsPage
            onAddToCart={handleAddToCart}
            onCategoryChange={handleCategoryChange}
          />
        }
      />
      <Route
        path="/cart"
        element={
          <CartPage
            cartItems={cartItems}
            currentUser={currentUser}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemoveFromCart}
            onLoginClick={() => setOpenDialog('login')}
            onPlaceOrder={handlePlaceOrder}
          />
        }
      />
      <Route path="/order-confirmation" element={<OrderConfirmationPage order={lastOrder} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );

  return (
    <>
      <Header
        searchText={searchText}
        onSearchChange={handleSearchChange}
        currentUser={currentUser}
        cartCount={cartCount}
        onLoginClick={() => setOpenDialog('login')}
        onSignupClick={() => setOpenDialog('signup')}
        onLogout={handleLogout}
      />

      <main className="container">{content}</main>

      <Footer />

      {openDialog === 'login' && (
        <LoginDialog onLogin={handleLogin} onClose={() => setOpenDialog(null)} />
      )}
      {openDialog === 'signup' && (
        <SignupDialog onSignup={handleSignup} onCopyKey={handleCopyKey} onClose={() => setOpenDialog(null)} />
      )}

      <Toast message={toastMessage} />
    </>
  );
}

export default App;
