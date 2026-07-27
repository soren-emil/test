import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Article50Check from './Article50Check.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Article50Check />
  </StrictMode>,
);
