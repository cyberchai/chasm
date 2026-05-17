// server.ts — Tiny Express server for Stripe Checkout (test mode)
// Runs on :4173, Vite proxies /api/checkout to here.
// Keys from .env via Stripe Projects (stripe projects env --pull).

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';

const PORT = 4173;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_KEY) {
  console.warn(
    '\x1b[33m⚠ STRIPE_SECRET_KEY not set. Checkout will return a helpful error.\x1b[0m'
  );
  console.warn(
    '  Run: stripe projects env --pull   (or add STRIPE_SECRET_KEY to .env)\n'
  );
}

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// POST /api/checkout — create a Stripe Checkout Session
app.post('/api/checkout', async (req, res) => {
  if (!STRIPE_KEY) {
    res.status(503).json({
      error: 'Stripe not configured. Run: stripe projects env --pull',
    });
    return;
  }

  const stripe = new Stripe(STRIPE_KEY);

  try {
    const { items } = req.body as {
      items: Array<{ name: string; price: number; quantity: number }>;
    };

    if (!items || items.length === 0) {
      res.status(400).json({ error: 'No items provided' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.name },
          unit_amount: item.price, // already in cents
        },
        quantity: item.quantity,
      })),
      success_url: 'http://localhost:5173?checkout=success',
      cancel_url: 'http://localhost:5173?checkout=cancel',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe Checkout error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`\x1b[32m✓ Checkout API running on http://localhost:${PORT}\x1b[0m`);
  if (STRIPE_KEY) {
    console.log('  Stripe: configured (test mode)');
  }
});
