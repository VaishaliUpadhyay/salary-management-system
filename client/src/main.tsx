import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="p-8"><h1 className="text-2xl font-semibold">Salary Management System</h1></main>
  </StrictMode>,
);
