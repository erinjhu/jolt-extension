/**
 * The one place a Google Doc id becomes an editor URL, so every "open the doc"
 * affordance (banner link, "Open your doc" button) derives it identically.
 */
export function docEditUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/edit`;
}
