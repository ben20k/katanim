export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>Katanim Modern Agriculture</strong>
          <div className="muted small">Seeds, inputs and smart-farming tools delivered nationwide via J&amp;T Express.</div>
        </div>
        <div className="muted small">© {new Date().getFullYear()} Katanim. All rights reserved.</div>
      </div>
    </footer>
  );
}
