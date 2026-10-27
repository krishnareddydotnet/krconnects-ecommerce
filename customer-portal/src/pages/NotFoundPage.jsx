import { Link } from 'react-router-dom';

// NotFoundPage — any URL we don't know, e.g. /abc
function NotFoundPage() {
  return (
    <div className="empty">
      <h2>Page not found</h2>
      <p><Link to="/">Go to the home page</Link></p>
    </div>
  );
}

export default NotFoundPage;
