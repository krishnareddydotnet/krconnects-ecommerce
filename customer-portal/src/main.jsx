import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/app.css'; // storefront styles (from the HTML prototype)

// BrowserRouter lets App use real URLs like /product/3.
// nginx "try_files ... /index.html" sends those URLs to React (see nginx.conf).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
