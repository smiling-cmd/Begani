import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="page-content">
      <header className="page-heading">
        <div className="eyebrow">404</div>
        <h1>This page does not exist</h1>
        <p>The link may be old or mistyped.</p>
      </header>
      <Link className="button" to="/home">Back to home</Link>
    </main>
  );
}
