import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Logo from './Logo.jsx';

export default function Navbar() {
  const { user, profile, isManager, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <Logo size={34} />
          <span>
            Katanim<small>Modern Agriculture</small>
          </span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>Shop</NavLink>
          {user && <NavLink to="/orders">My orders</NavLink>}
          {isManager && <NavLink to="/manager">Manager</NavLink>}
          <NavLink to="/cart" className="cart-link">
            Cart{count > 0 && <span className="cart-count">{count}</span>}
          </NavLink>
          {user ? (
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut} title={profile?.email}>
              Sign out
            </button>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
