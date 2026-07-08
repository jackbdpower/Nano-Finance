import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept relative fetch calls inside Capacitor to point to the live hosted API
const isCapacitor = 
  typeof window !== 'undefined' && 
  (window.location.origin.startsWith('capacitor://') || 
   (window.location.origin.startsWith('http://localhost') && !window.location.origin.includes(':3000')));

if (isCapacitor) {
  const originalFetch = window.fetch;
  const API_BASE_URL = 'https://ais-pre-hq7bwrbsqfopadiy563m4v-579837712170.asia-southeast1.run.app';
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
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
