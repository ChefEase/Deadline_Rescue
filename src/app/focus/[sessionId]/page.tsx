import Link from "next/link";

export default function FocusPage() {
  return (
    <section className="focus-card">
      <Link className="back-link" href="/plan">← Back to Plan</Link>
      <p className="eyebrow">Focus</p>
      <h1>One task at a time.</h1>
      <p>The session timer and progress review will appear here when Focus is implemented.</p>
    </section>
  );
}
