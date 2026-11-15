import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container narrow">
      <div className="card empty">
        <div className="empty-icon">🌵</div>
        <h2>Page not found</h2>
        <Link to="/" className="btn btn-primary">Back to shop</Link>
      </div>
    </div>
  );
}
