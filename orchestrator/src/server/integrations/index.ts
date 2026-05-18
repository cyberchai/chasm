/**
 * Integration barrel — re-exports all sponsor integrations.
 */
export { getSpongeWallet, getWalletStatus, logMerchantPayout } from "./sponge.js";
export {
  ingestBusinessProfile,
  storeConversation,
  getMerchantContext,
} from "./supermemory.js";
export {
  createMerchantIndex,
  searchMerchantKnowledge,
  buildContextFromResults,
} from "./moss.js";
