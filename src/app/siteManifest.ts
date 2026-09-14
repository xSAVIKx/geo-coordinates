// The web app manifest lives next to the published page, not inside the single file. Linking it from the file itself
// would make every offline copy (and any other host) ask for a file that isn't there, so the link is added only when
// the page is being viewed at its canonical address.

/** The manifest URL when `pageHref` is the canonical page (hash and query ignored), otherwise null. */
export function manifestHref(canonical: string | null | undefined, pageHref: string): string | null {
  if (!canonical || !/^https?:/.test(pageHref)) return null;
  const page = pageHref.split(/[?#]/)[0]!.replace(/index\.html$/, '');
  return page === canonical ? new URL('site.webmanifest', canonical).href : null;
}

export function linkManifest(doc: Document = document): void {
  const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href');
  const href = manifestHref(canonical, doc.location.href);
  if (!href || doc.querySelector('link[rel="manifest"]')) return;
  const link = doc.createElement('link');
  link.rel = 'manifest';
  link.href = href;
  doc.head.append(link);
}
