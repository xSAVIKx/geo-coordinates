import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './app/App.svelte';

mount(App, { target: document.getElementById('app')! });
