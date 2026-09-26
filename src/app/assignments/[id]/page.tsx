import Link from "next/link";

export default function AssignmentDetailsPage() {
  return (
    <section className="page-card">
      <Link className="back-link" href="/assignments">← Back to assignments</Link>
      <h1>Assignment details</h1>
      <p>Confirmed deadline, remaining work, source, and scheduled sessions will appear here.</p>
    </section>
  );
}
