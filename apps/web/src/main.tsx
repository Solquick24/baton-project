import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App.js';
import './styles/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('웹 진입점을 찾을 수 없어요.');
createRoot(root).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
