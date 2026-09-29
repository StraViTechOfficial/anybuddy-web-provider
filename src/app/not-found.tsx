import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 32 }}>
      <h1>This page doesn't exist</h1>
      <p className="sub" style={{ margin: "8px 0 16px" }}>The link may be old.</p>
      <Link className="btn p" href="/">Go to Today</Link>
    </main>
  );
}
