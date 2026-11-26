import './Skeleton.css';

// Grey shimmering shapes that stand in for content while it loads, so the page keeps its shape
// instead of flashing blank or showing "Loading…". All decorative; LoadingRegion names the whole area.

export function Skeleton({ width, height, radius, circle = false, className = '', style }) {
  const size = {};
  if (width !== undefined) size.width = width;
  if (height !== undefined) size.height = height;
  if (circle) size.borderRadius = '50%';
  else if (radius !== undefined) size.borderRadius = radius;
  return <span className={`sk ${className}`.trim()} style={{ ...size, ...style }} aria-hidden="true" />;
}

// Wraps skeletons so screen readers hear one "Loading …" message and the area is marked busy.
export function LoadingRegion({ label = 'Loading', className = '', children }) {
  return (
    <div className={`sk-region ${className}`.trim()} role="status" aria-busy="true" aria-live="polite">
      <span className="sk-sr">{label}…</span>
      {children}
    </div>
  );
}

const LINE_WIDTHS = ['92%', '78%', '64%', '86%', '58%'];

export function SkeletonLines({ lines = 3, className = '' }) {
  return (
    <div className={`sk-lines ${className}`.trim()}>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} height="0.85rem" width={LINE_WIDTHS[i % LINE_WIDTHS.length]} />)}
    </div>
  );
}

// A stack of rows: optional round avatar, a title and a shorter line. For lists, inboxes, tables.
export function SkeletonList({ label = 'Loading', rows = 3, avatar = false, className = '' }) {
  return (
    <LoadingRegion label={label} className={`sk-list ${className}`.trim()}>
      {Array.from({ length: rows }, (_, i) => (
        <div className="sk-row" key={i}>
          {avatar && <Skeleton circle width={44} height={44} className="sk-avatar" />}
          <div className="sk-row-text">
            <Skeleton height="0.95rem" width={i % 2 ? '48%' : '62%'} />
            <Skeleton height="0.75rem" width={i % 2 ? '70%' : '82%'} />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

// A responsive grid of card-shaped blocks, for resources, activities and similar galleries.
export function SkeletonCards({ label = 'Loading', count = 6, height = 220, className = '' }) {
  return (
    <LoadingRegion label={label} className={`sk-cards ${className}`.trim()}>
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card" key={i}>
          <Skeleton height={height} radius="16px" />
          <Skeleton height="0.95rem" width="70%" />
          <Skeleton height="0.75rem" width="50%" />
        </div>
      ))}
    </LoadingRegion>
  );
}

// Chat bubbles alternating left and right.
export function SkeletonBubbles({ label = 'Loading conversation' }) {
  const widths = ['58%', '40%', '66%', '34%'];
  return (
    <LoadingRegion label={label} className="sk-bubbles">
      {widths.map((width, i) => (
        <Skeleton key={i} height={i % 2 ? 44 : 58} width={width} radius="18px" className={i % 2 ? 'sk-mine' : ''} />
      ))}
    </LoadingRegion>
  );
}

// The whole app while the account loads: sidebar (or top bar on a phone), a heading and cards.
export function PageSkeleton({ label = 'Loading your account' }) {
  return (
    <div className="app-shell sk-page" role="status" aria-busy="true" aria-live="polite">
      <span className="sk-sr">{label}…</span>
      <aside className="sk-sidebar" aria-hidden="true">
        <Skeleton height={34} width="70%" radius="10px" />
        <div className="sk-sidebar-links">
          {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} height={38} radius="12px" />)}
        </div>
      </aside>
      <main className="sk-main" aria-hidden="true">
        <div className="sk-topbar">
          <Skeleton height={26} width={96} radius="8px" />
          <span className="sk-topbar-icons"><Skeleton circle width={34} height={34} /><Skeleton circle width={34} height={34} /></span>
        </div>
        <Skeleton height={30} width="46%" radius="10px" />
        <Skeleton height="0.9rem" width="62%" />
        <Skeleton height={170} radius="22px" className="sk-hero" />
        <div className="sk-grid">
          <Skeleton height={110} radius="18px" />
          <Skeleton height={110} radius="18px" />
          <Skeleton height={110} radius="18px" />
        </div>
      </main>
    </div>
  );
}
