// Development-only entry for the design-system showcase.
//
// NOT an application entry point. `vite build` has a single input
// (index.html), so nothing here reaches the production bundle — verified by
// checking dist/ after a build.
//
// To delete once the visual direction is approved:
//     rm -rf src/showcase showcase.html

import React from 'react';
import { createRoot } from 'react-dom/client';
import Showcase from './Showcase';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Showcase />
  </React.StrictMode>,
);
