import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

// User data deletion instructions. Facebook (Meta) requires this URL for "Login with Facebook".
export default function DataDeletion() {
  const subject = encodeURIComponent('Delete my Katanim account');
  return (
    <div className="container prose">
      <h1>Delete your data</h1>
      <p>
        You can ask {SITE.name} to delete your account and the personal information linked to it at any time,
        whether you signed up with email or with Facebook.
      </p>

      <h2>How to request deletion</h2>
      <ol>
        <li>
          Email <a href={`mailto:${SITE.contactEmail}?subject=${subject}`}>{SITE.contactEmail}</a> with the subject
          “Delete my Katanim account”.
        </li>
        <li>Send it from the email address on your account, or tell us the name and email you signed up with.</li>
        <li>We will confirm your request and delete your data within 30 days, then email you once it is done.</li>
      </ol>

      <h2>What gets deleted</h2>
      <p>
        Your account, profile (name, email, mobile number, Facebook profile details), saved delivery details,
        comments and uploaded payment proofs. We may keep basic order and payment records that we are required by law
        to keep for tax and accounting, with your contact details removed where possible.
      </p>

      <h2>Remove Katanim from Facebook</h2>
      <p>
        If you signed in with Facebook, you can also remove our access: on Facebook go to <strong>Settings &amp; privacy →
        Settings → Apps and websites</strong>, find Katanim and click <strong>Remove</strong>. This stops Facebook from
        sharing your information with us. To delete what we already have, send the request above.
      </p>

      <p className="muted small">
        See also our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
