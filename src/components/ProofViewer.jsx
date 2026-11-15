import { useEffect, useState } from 'react';
import { signedProofUrl } from '../lib/storage';

export default function ProofViewer({ path, inline = false }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!path) return;
    let active = true;
    signedProofUrl(path)
      .then((u) => active && setUrl(u))
      .catch((e) => active && setErr(e.message));
    return () => {
      active = false;
    };
  }, [path]);

  if (!path) return null;
  if (err) return <span className="small text-danger">Could not load proof: {err}</span>;
  if (!url) return <span className="muted small">Loading proof…</span>;

  const isPdf = path.toLowerCase().endsWith('.pdf');
  if (inline && !isPdf) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="proof-thumb" title="Open full size">
        <img src={url} alt="Proof of payment" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
      View proof {isPdf ? '(PDF)' : ''}
    </a>
  );
}
