import { Link } from 'react-router-dom';
import Logo, { BrandStripe } from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <BrandStripe />
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo size={56} withText light />
          <p className="tagline-script">So clean, so good.</p>
        </div>
        <div className="footer-col">
          <strong>Shop</strong>
          <Link to="/">All products</Link>
          <Link to="/orders">My orders</Link>
          <Link to="/cart">Cart</Link>
        </div>
        <div className="footer-col">
          <strong>We deliver nationwide</strong>
          <span>via J&amp;T Express</span>
          <span>Pay with GCash, Maya or bank QR</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Katanim Modern Agriculture</span>
        <span className="hashtag">This is how I grow hydroponics #Katanim</span>
      </div>
    </footer>
  );
}
