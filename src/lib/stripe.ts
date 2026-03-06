import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  typescript: true,
});

export const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_ID_PRO ?? "";
