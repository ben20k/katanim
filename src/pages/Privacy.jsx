import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

// Privacy policy. Required by Facebook (Meta) before a "Login with Facebook" app can go live.
// Review with your own adviser — this describes what the app actually stores.
export default function Privacy() {
  return (
    <div className="container prose">
      <h1>Privacy Policy</h1>
      <p className="muted small">Last updated: {SITE.policyUpdated}</p>

      <p>
        {SITE.name} (“Katanim”, “we”) runs {SITE.domain}. This policy explains what personal information we collect
        when you use our online store, why we collect it, and how you can ask us to delete it. We handle personal
        data in line with the Philippine Data Privacy Act of 2012 (RA 10173).
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and mobile number. If you sign in with Facebook, we receive only your name, email address and profile picture from Facebook (the <em>public_profile</em> and <em>email</em> permissions). We never receive your Facebook password and never post on your behalf.</li>
        <li><strong>Order details:</strong> items ordered, delivery name, address and phone number, and order history.</li>
        <li><strong>Payment proofs:</strong> screenshots or receipts you upload and the reference numbers you enter. We do not collect or store card numbers or e-wallet passwords.</li>
        <li><strong>Messages:</strong> comments you exchange with our team on your orders.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To create and secure your account and let you sign in.</li>
        <li>To process, verify payment for, ship and support your orders.</li>
        <li>To email you order updates (order placed, payment verified, shipped and similar).</li>
      </ul>
      <p>We do not sell your personal information or use it for advertising.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Couriers</strong> (e.g. J&amp;T Express): your delivery name, address and phone number, to deliver your order.</li>
        <li><strong>Service providers</strong> who host and run the store for us: Supabase (database, login and file storage), Resend (order emails) and Cloudflare (website hosting). They process data only on our instructions.</li>
        <li><strong>Authorities</strong>, when the law requires it.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep account and order records while your account is active and for as long as needed for accounting, tax
        and legal requirements. Payment proofs are kept with the order record.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal information, or withdraw consent, by contacting us. See{' '}
        <Link to="/data-deletion">how to delete your data</Link>.
      </p>

      <h2>Security</h2>
      <p>
        Data is sent over HTTPS. Each customer can only access their own orders, and payment proofs are stored privately
        and shown only to you and our store managers.
      </p>

      <h2>Contact us</h2>
      <p>
        Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        {SITE.contactPhone && <> or call {SITE.contactPhone}</>}. {SITE.name}, {SITE.address}.
      </p>
    </div>
  );
}
