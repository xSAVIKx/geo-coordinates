import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './app/App.svelte';
import { expose } from './app/testMode';
import { mapState } from './map/mapState.svelte';

mount(App, { target: document.getElementById('app')! });

expose('__mapState', mapState);
