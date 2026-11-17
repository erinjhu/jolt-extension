import privacyMarkdown from '../../content/privacy.md?raw';
import LegalPage from './LegalPage';

/** Public /privacy route. Content lives in src/content/privacy.md. */
export default function PrivacyPage() {
  return <LegalPage markdown={privacyMarkdown} />;
}
