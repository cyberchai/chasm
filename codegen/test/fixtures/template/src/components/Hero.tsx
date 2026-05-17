import { content } from "../content";

export function Hero() {
  return (
    <header style={{ padding: "48px 0", textAlign: "center" }}>
      <h1 style={{ color: content.colors[0], margin: 0 }}>{content.name}</h1>
      <p style={{ fontSize: 18, color: "#555" }}>{content.tagline}</p>
    </header>
  );
}
