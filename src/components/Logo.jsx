// Katanim brand mark: the round emblem, optionally with the wordmark beside it.
export default function Logo({ size = 40, withText = false, light = false }) {
  const emblem = (
    <img
      src="/brand/katanim-emblem.webp"
      width={size}
      height={size}
      alt={withText ? '' : 'Katanim Modern Agriculture'}
      className="logo-emblem"
    />
  );
  if (!withText) return emblem;
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      {emblem}
      <span className="wordmark">
        <span className="wordmark-name">KATANIM</span>
        <span className="wordmark-sub">MODERN AGRICULTURE</span>
      </span>
    </span>
  );
}

// The colored band taken from the emblem (leaf · water · sun · soil · sky).
export function BrandStripe() {
  return <div className="brand-stripe" aria-hidden="true" />;
}
