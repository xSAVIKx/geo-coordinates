import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './app/App.svelte';
import { mapState } from './map/mapState.svelte';

mount(App, { target: document.getElementById('app')! });

if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
  (window as unknown as { __mapState: typeof mapState }).__mapState = mapState;
}
