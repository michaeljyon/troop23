import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import './styles.css';
import App from './App.jsx';
import { applyTheme } from './lib/config.js';

applyTheme();
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
