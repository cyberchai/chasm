/**
 * Sponge Wallet Integration — Agent Financial Infrastructure
 *
 * Gives the Chasm orchestrator agent its own wallet via Sponge,
 * enabling autonomous merchant payouts, balance checks, and
 * payment-link generation for the generated storefronts.
 *
 * SDK: @paysponge/sdk  |  Docs: https://docs.paysponge.com/wallet/sdk-wallet
 * MCP:  https://api.wallet.paysponge.com/mcp
 */

import { SpongeWallet } from "@paysponge/sdk";
import { getEnv, type EnvSource } from "../env.js";
import { logger, type ChasmLogger } from "../logger.js";

let _wallet: SpongeWallet | null = null;

/**
 * Lazily connect to the Sponge Wallet.
 * Re-uses a singleton so we don't re-auth on every webhook.
 */
export async function getSpongeWallet(
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<SpongeWallet | null> {
  const apiKey = getEnv("SPONGE_API_KEY", env);
  if (!apiKey) {
    log.info("SPONGE_API_KEY not set — Sponge wallet disabled.");
    return null;
  }

  if (_wallet) return _wallet;

  try {
    log.info("Connecting to Sponge Wallet...");
    _wallet = await SpongeWallet.connect({
      apiKey,
      noBrowser: true, // server-side, no browser popups
    });
    log.info("Sponge Wallet connected successfully.", {
      agentId: _wallet.getAgentId(),
    });
    return _wallet;
  } catch (error) {
    log.error("Failed to connect Sponge Wallet", { error });
    return null;
  }
}

/** Print a human-readable wallet status for demo / debug. */
export async function getWalletStatus(
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<{
  connected: boolean;
  agentId?: string;
  addresses?: Record<string, string>;
  balances?: Record<string, unknown>;
}> {
  const wallet = await getSpongeWallet(env, log);
  if (!wallet) return { connected: false };

  try {
    const addresses = await wallet.getAddresses();
    const balances = await wallet.getBalances();
    return {
      connected: true,
      agentId: wallet.getAgentId(),
      addresses,
      balances,
    };
  } catch (error) {
    log.error("Failed to fetch Sponge wallet status", { error });
    return { connected: true, agentId: wallet.getAgentId() };
  }
}

/**
 * Log a merchant payout event.
 * In production this would call wallet.transfer() — for the hackathon
 * demo we log intent and show the Sponge wallet balance changing.
 */
export async function logMerchantPayout(
  merchantId: string,
  amountUsd: string,
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<{ success: boolean; summary: string }> {
  const wallet = await getSpongeWallet(env, log);
  if (!wallet) {
    return { success: false, summary: "Sponge wallet not connected" };
  }

  log.info("Merchant payout intent recorded via Sponge", {
    merchantId,
    amountUsd,
    agentId: wallet.getAgentId(),
  });

  // For the demo: read-only — show balances but don't transfer
  const balances = await wallet.getBalances();

  return {
    success: true,
    summary: `Sponge agent ${wallet.getAgentId()} logged payout of $${amountUsd} for merchant ${merchantId}. Current balances: ${JSON.stringify(balances)}`,
  };
}
