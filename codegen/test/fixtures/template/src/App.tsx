import { content } from "./content";
import { Hero } from "./components/Hero";

export default function App() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: 24,
        background: content.colors[1],
      }}
    >
      <Hero />

      <section>
        <h2>What we offer</h2>
        <ul>
          {content.products.map((p) => (
            <li key={p.name}>
              {p.name} — ${(p.price / 100).toFixed(2)}
            </li>
          ))}
        </ul>
      </section>

      <footer style={{ marginTop: 32, color: "#888" }}>
        {content.contact.address} · {content.contact.phone} · {content.contact.hours}
      </footer>
    </main>
  );
}
