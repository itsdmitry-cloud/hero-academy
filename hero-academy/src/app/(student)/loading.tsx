export default function StudentLoading() {
  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
      <div style={{ height: 80, borderRadius: 16, background: 'var(--bg-glass)' }} />
      <div style={{ height: 120, borderRadius: 16, background: 'var(--bg-glass)' }} />
      <div style={{ height: 200, borderRadius: 16, background: 'var(--bg-glass)' }} />
    </div>
  );
}
