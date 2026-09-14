/**
 * Page-wide layout flags that a screen sets and the shell (App.svelte, Header.svelte) reads — so a screen
 * never styles the shell's elements itself. `wide`: the class quiz run uses the whole window width.
 */
export const layout = $state({ wide: false });
