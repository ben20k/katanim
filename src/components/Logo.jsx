export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1f6f4a" />
      <path d="M32 52V28" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 34c-10 0-16-6-16-16 10 0 16 6 16 16z" fill="#c6e377" />
      <path d="M32 30c0-10 6-16 16-16 0 10-6 16-16 16z" fill="#fff" />
    </svg>
  );
}
