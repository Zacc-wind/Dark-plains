export default function LoadingScreen({ label = 'Gathering the warband' }: { label?: string }) {
  return (
    <div className="dp-loading fantasy-ui" role="status" aria-live="polite">
      <span className="dp-loading-sigil" aria-hidden="true" />
      <span className="fantasy-heading dp-loading-title">Dark Plains</span>
      <span className="arcane-label">{label}</span>
    </div>
  );
}
