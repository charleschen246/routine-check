import React from 'react';
import { createRoot } from 'react-dom/client';
import { Options } from './Options';
import '../popup/popup.css';

const container = document.getElementById('root');
if (!container) throw new Error('Options root container not found');
createRoot(container).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
