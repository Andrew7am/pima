// Dev-only entry for the before/after review. See compare.html.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Compare from './Compare';
import '../index.css';

createRoot(document.getElementById('root')!).render(<Compare />);
