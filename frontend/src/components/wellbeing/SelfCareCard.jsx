// Shared frame for the four self-care tools so every card has the same
// header, description and a tool area pinned to the bottom.
export default function SelfCareCard({ icon: Icon, title, text, children }) {
  return (
    <article className="selfcare-card">
      <div className="selfcare-card-head">
        <span className="selfcare-icon" aria-hidden="true"><Icon size={20} /></span>
        <h3>{title}</h3>
      </div>
      <p>{text}</p>
      {children}
    </article>
  );
}
