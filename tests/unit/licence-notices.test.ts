import { join, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { DATA_NOTICES, injectNotices, noticeComment, packageDir, readNotice } from '../../scripts/licence-notices';

describe('third-party licence notices', () => {
  test('a bundled module maps to its package folder; the project\'s own code and virtual modules to none', () => {
    const nm = `${sep}p${sep}node_modules${sep}`;
    expect(packageDir(`${nm}d3-geo${sep}src${sep}path${sep}index.js`)).toBe(join(`${nm}d3-geo`));
    expect(packageDir(`${nm}@scope${sep}pkg${sep}dist${sep}a.js?x=1`)).toBe(join(`${nm}@scope`, 'pkg'));
    expect(packageDir(`${nm}d3-geo${sep}node_modules${sep}d3-array${sep}src${sep}fsum.js`)).toBe(join(`${nm}d3-geo${sep}node_modules${sep}d3-array`));
    expect(packageDir(`${sep}p${sep}src${sep}main.ts`)).toBeNull();
    expect(packageDir('\0virtual:maple-bear-schools')).toBeNull();
  });

  test('reads name, version, licence and the licence text of the bundled packages', () => {
    const svelte = readNotice(join('node_modules', 'svelte'));
    expect(svelte.name).toBe('svelte');
    expect(svelte.license).toBe('MIT');
    expect(svelte.text).toContain('Permission is hereby granted, free of charge');
    for (const name of ['d3-geo', 'd3-array', 'topojson-client', 'world-atlas']) {
      const n = readNotice(join('node_modules', name));
      expect(n.license, name).toBe('ISC');
      expect(n.text, name).toMatch(/^Copyright /);
    }
  });

  test('the comment names each package with its version and licence text, stays a valid comment, and sits after the doctype', () => {
    const comment = noticeComment([
      { name: 'svelte', version: '5.0.0', license: 'MIT', text: 'Copyright (c) Svelte\n\nPermission is hereby granted -- free.' },
      { name: 'd3-geo', version: '3.1.1', license: 'ISC', text: 'Copyright 2010-2024 Mike Bostock\n\nPermission to use --> copy' },
      ...DATA_NOTICES,
    ]);
    expect(comment.startsWith('<!--\nThird-party licences')).toBe(true);
    expect(comment).toContain('svelte 5.0.0 (MIT)');
    expect(comment).toContain('d3-geo 3.1.1 (ISC)');
    expect(comment).toContain('Natural Earth map data (Public domain)');
    // Only the closing `-->` has two dashes in a row.
    expect(comment.slice(4, -3)).not.toMatch(/--/);
    expect(injectNotices('<!doctype html>\n<html></html>', comment)).toBe(`<!doctype html>\n${comment}\n<html></html>`);
    expect(injectNotices('<html></html>', comment)).toBe(`${comment}\n<html></html>`);
  });
});
