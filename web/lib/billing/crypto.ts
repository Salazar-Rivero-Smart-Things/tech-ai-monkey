// Direct-to-wallet crypto payments. The business owns the wallet; the user
// sends coins and we verify the transaction on-chain before crediting tokens.

export type CryptoAsset = "btc" | "eth" | "usdc" | "bch";

export interface CryptoAssetInfo {
  id: CryptoAsset;
  name: string;
  coingeckoId: string;
  decimals: number;
  envKey: string;
}

export const ASSETS: Record<CryptoAsset, CryptoAssetInfo> = {
  btc: {
    id: "btc",
    name: "Bitcoin",
    coingeckoId: "bitcoin",
    decimals: 8,
    envKey: "CRYPTO_BTC_ADDRESS",
  },
  eth: {
    id: "eth",
    name: "Ethereum",
    coingeckoId: "ethereum",
    decimals: 18,
    envKey: "CRYPTO_ETH_ADDRESS",
  },
  usdc: {
    id: "usdc",
    name: "USD Coin",
    coingeckoId: "usd-coin",
    decimals: 6,
    envKey: "CRYPTO_USDC_ADDRESS",
  },
  bch: {
    id: "bch",
    name: "Bitcoin Cash",
    coingeckoId: "bitcoin-cash",
    decimals: 8,
    envKey: "CRYPTO_BCH_ADDRESS",
  },
};

export function walletAddress(asset: CryptoAsset): string {
  const address = process.env[ASSETS[asset].envKey];
  if (!address) {
    throw new Error(`${ASSETS[asset].envKey} is not set.`);
  }
  return address;
}

export async function getEurPrices(): Promise<Record<CryptoAsset, number>> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin,bitcoin-cash&vs_currencies=eur",
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Price lookup failed.");
  const data = (await res.json()) as Record<string, { eur: number }>;
  return {
    btc: data.bitcoin?.eur ?? 0,
    eth: data.ethereum?.eur ?? 0,
    usdc: data["usd-coin"]?.eur ?? 0,
    bch: data["bitcoin-cash"]?.eur ?? 0,
  };
}

// Smallest units (satoshis / wei / USDC 6-decimals) required for a EUR amount.
export function unitsForEur(asset: CryptoAsset, eur: number, priceEur: number): number {
  const coins = eur / priceEur;
  return Math.ceil(coins * 10 ** ASSETS[asset].decimals);
}

// ---- Verification (on-chain) ----

async function verifyBtc(txHash: string, address: string, expectedSat: number) {
  const res = await fetch(`https://mempool.space/api/tx/${txHash}`);
  if (!res.ok) throw new Error("Bitcoin transaction not found.");
  const tx = (await res.json()) as {
    status?: { confirmed?: boolean };
    vout?: Array<{ scriptpubkey_address?: string; value?: number }>;
  };
  if (!tx.status?.confirmed) throw new Error("Bitcoin transaction not confirmed yet.");
  const received = (tx.vout ?? [])
    .filter((o) => o.scriptpubkey_address === address)
    .reduce((sum, o) => sum + (o.value ?? 0), 0);
  if (received < expectedSat) {
    throw new Error(`Received ${received} sats, expected at least ${expectedSat}.`);
  }
  return { receivedSat: received };
}

async function verifyEth(txHash: string, address: string, expectedWei: number) {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new Error("ETHERSCAN_API_KEY is not set.");
  const res = await fetch(
    `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${key}`,
  );
  const data = (await res.json()) as { result?: { to?: string; value?: string } };
  const tx = data.result;
  if (!tx || tx.to?.toLowerCase() !== address.toLowerCase()) {
    throw new Error("ETH transaction not found or wrong recipient.");
  }
  const wei = Number(tx.value ?? "0");
  if (wei < expectedWei) {
    throw new Error(`Received ${wei} wei, expected at least ${expectedWei}.`);
  }
  return { receivedWei: wei };
}

async function verifyUsdc(txHash: string, address: string, expectedUnits: number) {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new Error("ETHERSCAN_API_KEY is not set.");
  const usdcContract = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const res = await fetch(
    `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&contractaddress=${usdcContract}&page=1&offset=100&sort=desc&apikey=${key}`,
  );
  const data = (await res.json()) as {
    result?: Array<{ hash?: string; value?: string; tokenDecimal?: string }>;
  };
  const tx = (data.result ?? []).find((t) => t.hash?.toLowerCase() === txHash.toLowerCase());
  if (!tx) throw new Error("USDC transfer not found.");
  const units = Number(tx.value ?? "0");
  if (units < expectedUnits) {
    throw new Error(`Received ${units} USDC units, expected at least ${expectedUnits}.`);
  }
  return { receivedUnits: units };
}

async function verifyBch(txHash: string, address: string, expectedSat: number) {
  const key = process.env.BLOCKCHAIR_API_KEY;
  const url = `https://api.blockchair.com/bitcoin-cash/dashboards/transaction/${txHash}${
    key ? `?key=${key}` : ""
  }`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Bitcoin Cash transaction not found.");
  const data = (await res.json()) as {
    data?: Record<
      string,
      { transaction?: { outputs?: Array<{ value?: number; recipient?: string }> } }
    >;
  };
  const tx = data.data?.[txHash]?.transaction;
  if (!tx) throw new Error("Bitcoin Cash transaction not found.");
  const received = (tx.outputs ?? [])
    .filter((o) => o.recipient === address)
    .reduce((sum, o) => sum + (o.value ?? 0), 0);
  if (received < expectedSat) {
    throw new Error(`Received ${received} sats, expected at least ${expectedSat}.`);
  }
  return { receivedSat: received };
}

export async function verifyPayment(
  asset: CryptoAsset,
  txHash: string,
  expectedEur: number,
) {
  const prices = await getEurPrices();
  const priceEur = prices[asset];
  if (priceEur <= 0) throw new Error("Could not determine a price for this asset.");
  const expectedUnits = unitsForEur(asset, expectedEur, priceEur);
  const address = walletAddress(asset);

  if (asset === "btc") return verifyBtc(txHash, address, expectedUnits);
  if (asset === "eth") return verifyEth(txHash, address, expectedUnits);
  if (asset === "bch") return verifyBch(txHash, address, expectedUnits);
  return verifyUsdc(txHash, address, expectedUnits);
}
