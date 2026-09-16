import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './app/App.svelte';
import { linkManifest } from './app/siteManifest';
import { expose } from './app/testMode';
import { mapState } from './map/mapState.svelte';
import { textureTestHooks } from './map/texture/testHooks';
import { SCHOOLS } from './map/schools';

mount(App, { target: document.getElementById('app')! });
linkManifest();

expose('__mapState', mapState);
expose('__mapTextures', textureTestHooks);
expose('__schoolIds', SCHOOLS.map((s) => s.id));
