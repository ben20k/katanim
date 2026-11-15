import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/manager', label: 'Dashboard', end: true },
  { to: '/manager/orders', label: 'Orders & payments' },
  { to: '/manager/products', label: 'Products & promos' },
  { to: '/manager/payment-methods', label: 'Payment methods & GCash limits' },
  { to: '/manager/shipping', label: 'Shipping rates' },
];

export default function ManagerLayout() {
  return (
    <div className="container manager-layout">
      <nav className="side-nav">
        <div className="side-nav-brand">
          <img src="/brand/katanim-emblem.webp" alt="" width="28" height="28" />
          <span className="eyebrow">Manager</span>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <section className="manager-content">
        <Outlet />
      </section>
    </div>
  );
}
