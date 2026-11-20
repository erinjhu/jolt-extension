// Bundle the repo-root docs/*.md at build time via Vite's ?raw import, so the
// in-app Docs viewer is fully static (zero backend). Slugs mirror the file
// names (minus .md); README is the default "overview" page.
import overview from '../../../docs/README.md?raw';
import authRouting from '../../../docs/auth-and-routing.md?raw';
import scanEditor from '../../../docs/scan-and-editor-flows.md?raw';
import moduleMap from '../../../docs/module-map.md?raw';
import designConventions from '../../../docs/design-conventions.md?raw';

export interface DocPage {
  /** URL slug under /docs/ (empty string = the default /docs page). */
  slug: string;
  /** Short label for the nav bar. */
  title: string;
  /** Raw Markdown source. */
  markdown: string;
}

/** Ordered doc pages — drives the nav bar and Prev/Next links. */
export const DOC_PAGES: DocPage[] = [
  { slug: '', title: 'Overview', markdown: overview },
  { slug: 'auth-and-routing', title: 'Auth & Routing', markdown: authRouting },
  { slug: 'scan-and-editor-flows', title: 'Scan & Editor Flows', markdown: scanEditor },
  { slug: 'module-map', title: 'Module Map', markdown: moduleMap },
  { slug: 'design-conventions', title: 'Design Conventions', markdown: designConventions },
];

/** Resolve a /docs route path to the matching page (defaults to Overview). */
export function resolveDocPage(route: string): DocPage {
  // route is like "/docs" or "/docs/module-map".
  const rest = route.replace(/^\/docs\/?/, '').replace(/\.md$/, '');
  const found = DOC_PAGES.find((p) => p.slug === rest);
  return found ?? DOC_PAGES[0];
}
