import termsMarkdown from '../../content/terms.md?raw';
import LegalPage from './LegalPage';

/** Public /terms route. Content lives in src/content/terms.md. */
export default function TermsPage() {
  return <LegalPage markdown={termsMarkdown} />;
}
