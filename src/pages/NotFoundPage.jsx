import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', textAlign: 'center' }}>
      <h1 className="gradient-text" style={{ fontSize: 'var(--text-6xl)', marginBottom: 'var(--space-md)' }}>404</h1>
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>Page Not Found</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-xl)', maxWidth: '400px' }}>
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary btn-lg">
        Back to Home
      </Link>
    </div>
  );
}
