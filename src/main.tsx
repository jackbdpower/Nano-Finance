import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept relative fetch calls inside Capacitor to point to the live hosted API
const isCapacitor = 
  typeof window !== 'undefined' && 
  (!!(window as any).Capacitor ||
   window.location.origin.startsWith('capacitor://') || 
   (window.location.origin.startsWith('http://localhost') && !window.location.origin.includes(':3000')) ||
   (window.location.origin.startsWith('https://localhost') && !window.location.origin.includes(':3000')));

if (isCapacitor) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const savedUrl = localStorage.getItem('custom_api_url');
      const API_BASE_URL = savedUrl ? savedUrl.trim() : 'https://nano-finance-5bml.onrender.com';
      return originalFetch(`${API_BASE_URL}${input}`, init);
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
