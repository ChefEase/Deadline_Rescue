import Link from "next/link";

export default function WelcomePage() {
  return (
    <section className="welcome-card">
      <p className="eyebrow">Deadline Rescue</p>
      <h1>One task at a time. A plan that fits.</h1>
      <p>Add your assignments and available time. Get a study plan that adjusts when life changes.</p>
      <Link className="button" href="/assignments">Create my plan</Link>
      <p className="supporting-text">Saved in this browser. No account needed.</p>
    </section>
  );
}
