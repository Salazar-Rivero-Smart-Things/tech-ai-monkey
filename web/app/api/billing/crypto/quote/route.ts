import { NextResponse } from "next/server";
import { ASSETS, getEurPrices, walletAddress, unitsForEur, type CryptoAsset } from "@/lib/billing/crypto";
import { PLANS, PAID_PLANS } from "@/lib/billing/plans";

const TOPUP_TIERS = [5, 10, 20, 50, 100];

function amountsFor(eur: number, prices: Record<CryptoAsset, number>) {
  const out: Record<string, { units: number; coins: number }> = {};
  for (const asset of Object.keys(ASSETS) as CryptoAsset[]) {
    const units = unitsForEur(asset, eur, prices[asset]);
    out[asset] = { units, coins: units / 10 ** ASSETS[asset].decimals };
  }
  return out;
}

export async function GET() {
  try {
    const prices = await getEurPrices();
    const assets = Object.fromEntries(
      (Object.keys(ASSETS) as CryptoAsset[]).map((asset) => [
        asset,
        { address: walletAddress(asset), priceEur: prices[asset], decimals: ASSETS[asset].decimals },
      ]),
    );
    const plans = PAID_PLANS.map((id) => ({
      id,
      priceEur: PLANS[id].priceEur,
      crypto: amountsFor(PLANS[id].priceEur, prices),
    }));
    const topups = TOPUP_TIERS.map((eur) => ({
      eur,
      tokens: Math.floor(eur / 0.00016),
      crypto: amountsFor(eur, prices),
    }));
    return NextResponse.json({ assets, plans, topups });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quote failed." },
      { status: 500 },
    );
  }
}
