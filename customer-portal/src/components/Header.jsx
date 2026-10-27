import { Link } from 'react-router-dom';

// Header: logo, search box, login/sign up (or welcome + log out), cart button.
function Header({ searchText, onSearchChange, currentUser, cartCount, onLoginClick, onSignupClick, onLogout }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" aria-label="KRConnects e-commerce home">
          <span>KR<span className="brand-accent">Connects</span></span>
          <span className="tagline">e-commerce</span>
        </Link>

        {/* Search: every key press updates searchText in App */}
        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-3.5-3.5"></path>
          </svg>
          <label htmlFor="search-input" className="visually-hidden">Search products</label>
          <input
            id="search-input"
            type="search"
            placeholder="Search by name or category"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </form>

        <div className="header-actions">
          {/* Show different buttons for logged-in and logged-out users */}
          {currentUser ? (
            <>
              <span className="welcome">Hi, {currentUser.username}</span>
              <button className="btn btn-outline" type="button" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" type="button" onClick={onLoginClick}>Log in</button>
              <button className="btn btn-primary" type="button" onClick={onSignupClick}>Sign up</button>
            </>
          )}

          {/* Cart icon opens the cart page */}
          <Link to="/cart" className="icon-btn" aria-label={`Cart, ${cartCount} items`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"></path>
              <circle cx="10" cy="20" r="1.2"></circle>
              <circle cx="17" cy="20" r="1.2"></circle>
            </svg>
            {/* Badge only when the cart has something in it */}
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
