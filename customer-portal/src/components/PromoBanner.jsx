// PromoBanner: a thin offer strip shown at the top of every page, just above the header.
// The text lives in one place (PROMO_TEXT), so marketing changes are a one-line edit.
const PROMO_TEXT = 'Free delivery on orders above ₹999 · New here? Sign up and get 10% off your first order';

function PromoBanner() {
  return (
    // role="region" + aria-label lets screen-reader users find and skip the banner
    <div className="promo-banner" role="region" aria-label="Current offer">
      <div className="container">{PROMO_TEXT}</div>
    </div>
  );
}

export default PromoBanner;
