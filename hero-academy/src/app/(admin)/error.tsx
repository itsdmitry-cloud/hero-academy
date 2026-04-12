'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', color: '#fff', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Admin Error</h2>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#f87171', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', overflow: 'auto' }}>
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Digest: {error.digest ?? 'none'}
      </p>
      <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  );
}
