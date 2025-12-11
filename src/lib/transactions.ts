import { Transaction } from "@iota/iota-sdk/transactions";
import {
  PACKAGE_ID,
  POOL_ID,
  METADATA_ID,
  SYSTEM_STATE,
  CLOCK,
  OWNER_CAP_ID,
  OPERATOR_CAP_ID,
} from "./constants";

// ============================================
// User Transactions
// ============================================

/**
 * Build stake transaction
 * Stakes IOTA to the pool and receives tIOTA
 * Uses tx.gas to split the stake amount, leaving remainder for gas payment
 * @param amount - The amount to stake (in NANOS, 1 IOTA = 1e9 NANOS)
 */
export function buildStakeTx(amount: bigint): Transaction {
  const tx = new Transaction();

  // Split stake amount from the gas coin - wallet will select appropriate coin
  // The remainder stays in gas coin for paying transaction fees
  const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::stake`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(METADATA_ID),
      tx.object(SYSTEM_STATE),
      stakeCoin,
    ],
  });

  return tx;
}

/**
 * Build stake to specific validators transaction
 * Stakes IOTA distributed equally among chosen validators
 * Uses tx.gas to split the stake amount, leaving remainder for gas payment
 * @param validators - Array of validator addresses
 * @param amount - The amount to stake (in NANOS, 1 IOTA = 1e9 NANOS)
 */
export function buildStakeToValidatorsTx(
  validators: string[],
  amount: bigint
): Transaction {
  const tx = new Transaction();

  // Split stake amount from the gas coin - wallet will select appropriate coin
  // The remainder stays in gas coin for paying transaction fees
  const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::stake_to_validators`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(METADATA_ID),
      tx.object(SYSTEM_STATE),
      tx.pure.vector("address", validators),
      stakeCoin,
    ],
  });

  return tx;
}

/**
 * Build unstake transaction
 * Burns tIOTA and receives IOTA back
 * Automatically merges coins if needed
 * @param certCoinIds - Array of tIOTA coin object IDs to use
 * @param amount - The amount of tIOTA to unstake (in NANOS)
 */
export function buildUnstakeTx(certCoinIds: string[], amount: bigint): Transaction {
  const tx = new Transaction();

  // Set gas budget explicitly (50M NANOS = 0.05 IOTA should be plenty)
  tx.setGasBudget(50_000_000);

  // Use first coin as primary, merge others into it if needed
  const primaryCoin = tx.object(certCoinIds[0]);

  if (certCoinIds.length > 1) {
    // Merge all other coins into the primary coin
    tx.mergeCoins(primaryCoin, certCoinIds.slice(1).map(id => tx.object(id)));
  }

  // Split the exact amount from the merged tIOTA coin
  const [unstakeCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(amount)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::unstake`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(SYSTEM_STATE),
      tx.object(METADATA_ID),
      unstakeCoin,
    ],
  });

  return tx;
}

// ============================================
// Owner Transactions
// ============================================

/**
 * Change minimum stake amount
 */
export function buildChangeMinStakeTx(value: bigint, ownerCapId: string = OWNER_CAP_ID): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::change_min_stake`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(ownerCapId),
      tx.pure.u64(value),
    ],
  });

  return tx;
}

/**
 * Change base reward fee (in basis points, e.g., 500 = 5%)
 */
export function buildChangeRewardFeeTx(value: number, ownerCapId: string = OWNER_CAP_ID): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::change_base_reward_fee`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(ownerCapId),
      tx.pure.u64(value),
    ],
  });

  return tx;
}

/**
 * Update rewards threshold
 */
export function buildUpdateThresholdTx(value: number, ownerCapId: string = OWNER_CAP_ID): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::update_rewards_threshold`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(ownerCapId),
      tx.pure.u64(value),
    ],
  });

  return tx;
}

/**
 * Set pause state
 */
export function buildSetPauseTx(paused: boolean, ownerCapId: string = OWNER_CAP_ID): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::set_pause`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(ownerCapId),
      tx.pure.bool(paused),
    ],
  });

  return tx;
}

/**
 * Collect accumulated fees
 */
export function buildCollectFeeTx(toAddress: string, ownerCapId: string = OWNER_CAP_ID): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::collect_fee`,
    arguments: [
      tx.object(POOL_ID),
      tx.pure.address(toAddress),
      tx.object(ownerCapId),
    ],
  });

  return tx;
}

// ============================================
// Operator Transactions
// ============================================

/**
 * Update validators list
 */
export function buildUpdateValidatorsTx(
  validators: string[],
  priorities: number[],
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::update_validators`,
    arguments: [
      tx.object(POOL_ID),
      tx.pure.vector("address", validators),
      tx.pure.vector("u64", priorities.map(p => BigInt(p))),
      tx.object(operatorCapId),
    ],
  });

  return tx;
}

/**
 * Update rewards (requires 12h delay between updates)
 */
export function buildUpdateRewardsTx(
  value: bigint,
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::update_rewards`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(CLOCK),
      tx.pure.u64(value),
      tx.object(operatorCapId),
    ],
  });

  return tx;
}

/**
 * Add pending IOTA to pool
 */
export function buildAddPendingTx(
  coinId: string,
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::add_pending`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(coinId),
      tx.object(operatorCapId),
    ],
  });

  return tx;
}

/**
 * Rebalance - move stake from bad validators to good ones
 */
export function buildRebalanceTx(): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::rebalance`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(SYSTEM_STATE),
    ],
  });

  return tx;
}

/**
 * Publish current ratio (emits event)
 */
export function buildPublishRatioTx(): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::publish_ratio`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(METADATA_ID),
    ],
  });

  return tx;
}

// ============================================
// Ownership Transfer Transactions
// ============================================

/**
 * Transfer OwnerCap to a new address
 * WARNING: This will permanently transfer ownership
 */
export function buildTransferOwnerCapTx(
  toAddress: string,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::ownership::transfer_owner`,
    arguments: [
      tx.object(ownerCapId),
      tx.pure.address(toAddress),
    ],
  });

  return tx;
}

/**
 * Transfer OperatorCap to a new address
 * WARNING: This will permanently transfer operator rights
 */
export function buildTransferOperatorCapTx(
  toAddress: string,
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::ownership::transfer_operator`,
    arguments: [
      tx.object(operatorCapId),
      tx.pure.address(toAddress),
    ],
  });

  return tx;
}
