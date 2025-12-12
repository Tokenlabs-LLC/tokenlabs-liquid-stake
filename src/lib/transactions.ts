import { Transaction } from "@iota/iota-sdk/transactions";
import {
  PACKAGE_ID,
  POOL_ID,
  METADATA_ID,
  SYSTEM_STATE,
  CLOCK,
  OWNER_CAP_ID,
  OPERATOR_CAP_ID,
  ONE_IOTA,
  MAX_PERCENT,
} from "./constants";

// ============================================
// Validation Helpers
// ============================================

/** Maximum u64 value for overflow protection */
const MAX_U64 = 18_446_744_073_709_551_615n;

/** Minimum stake value (contract requires > 1000 NANOS) */
const MIN_STAKE_VALUE = 1001n;

/**
 * Validates an IOTA address format
 * @throws Error if address is invalid
 */
function validateAddress(address: string, fieldName: string = "Address"): void {
  if (!address || typeof address !== "string") {
    throw new Error(`${fieldName} is required`);
  }
  // IOTA addresses are 66 chars (0x + 64 hex chars)
  if (address.length !== 66) {
    throw new Error(`${fieldName} must be 66 characters (got ${address.length})`);
  }
  if (!address.startsWith("0x")) {
    throw new Error(`${fieldName} must start with '0x'`);
  }
  // Validate hex characters
  if (!/^0x[0-9a-fA-F]{64}$/.test(address)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }
}

/**
 * Validates an object ID format
 * @throws Error if object ID is invalid
 */
function validateObjectId(objectId: string, fieldName: string = "Object ID"): void {
  validateAddress(objectId, fieldName); // Same format as addresses
}

/**
 * Validates a bigint amount doesn't overflow u64
 * @throws Error if amount overflows or is negative
 */
function validateU64(value: bigint, fieldName: string = "Amount"): void {
  if (value < 0n) {
    throw new Error(`${fieldName} must be non-negative (received: ${value})`);
  }
  if (value > MAX_U64) {
    throw new Error(`${fieldName} exceeds maximum u64 value`);
  }
}

/**
 * Validates all addresses in an array
 * @throws Error if any address is invalid
 */
function validateAddressArray(addresses: string[], fieldName: string = "Addresses"): void {
  if (!addresses || !Array.isArray(addresses)) {
    throw new Error(`${fieldName} must be an array`);
  }
  addresses.forEach((addr, i) => {
    validateAddress(addr, `${fieldName}[${i}]`);
  });
}

// ============================================
// Gas Budget Constants (in NANOS)
// ============================================

const GAS_BUDGET_STAKE = 100_000_000; // 0.1 IOTA for single-validator stake
const GAS_BUDGET_STAKE_BASE = 100_000_000; // 0.1 IOTA base for multi-validator stake
const GAS_BUDGET_PER_VALIDATOR = 50_000_000; // 0.05 IOTA per validator (system call is expensive)
const GAS_BUDGET_UNSTAKE_BASE = 50_000_000; // 0.05 IOTA base for unstake
const GAS_BUDGET_PER_COIN = 5_000_000; // 0.005 IOTA per additional coin merged
const GAS_BUDGET_ADMIN = 75_000_000; // 0.075 IOTA for admin operations
const GAS_BUDGET_OPERATOR = 100_000_000; // 0.1 IOTA for operator operations
const GAS_BUDGET_REBALANCE = 150_000_000; // 0.15 IOTA for rebalance (complex)
const MAX_COINS_PER_UNSTAKE = 50; // Maximum coins to merge in one transaction

/**
 * Calculate dynamic gas budget for multi-validator staking
 * Each validator requires a separate iota_system::request_add_stake call
 * @param numValidators - Number of validators to stake to
 * @returns Gas budget in NANOS
 */
function calculateStakeGas(numValidators: number): number {
  // For single validator, use fixed budget
  if (numValidators <= 1) {
    return GAS_BUDGET_STAKE;
  }
  // For multiple validators: base + (validators * per-validator cost)
  return GAS_BUDGET_STAKE_BASE + (numValidators * GAS_BUDGET_PER_VALIDATOR);
}

/**
 * Calculate dynamic gas budget for updating validators
 * Each validator requires VecMap operations and potential sorting
 * @param numValidators - Number of validators to update
 * @returns Gas budget in NANOS
 */
function calculateUpdateValidatorsGas(numValidators: number): number {
  const baseGas = 50_000_000; // 0.05 IOTA base
  const perValidatorGas = 15_000_000; // 0.015 IOTA per validator
  return baseGas + (numValidators * perValidatorGas);
}

/**
 * Calculate dynamic gas budget for rebalance operation
 * Rebalance iterates through bad validators and moves stake
 * @param estimatedBadValidators - Estimated number of validators to rebalance (default: 5)
 * @returns Gas budget in NANOS
 */
function calculateRebalanceGas(estimatedBadValidators: number = 5): number {
  const baseGas = 100_000_000; // 0.1 IOTA base
  const perValidatorGas = 30_000_000; // 0.03 IOTA per validator (unstake + restake)
  return baseGas + (estimatedBadValidators * perValidatorGas);
}

// ============================================
// User Transactions
// ============================================

/**
 * Build stake transaction
 * Stakes IOTA to the pool and receives tIOTA
 * Uses tx.gas to split the stake amount, leaving remainder for gas payment
 * @param amount - The amount to stake (in NANOS, 1 IOTA = 1e9 NANOS)
 * @throws Error if amount is 0, negative, or exceeds u64 max
 */
export function buildStakeTx(amount: bigint): Transaction {
  // Validate amount
  if (amount <= 0n) {
    throw new Error("Stake amount must be greater than 0");
  }
  validateU64(amount, "Stake amount");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_STAKE);

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
 * @param validators - Array of validator addresses (must be valid IOTA addresses)
 * @param amount - The amount to stake (in NANOS, 1 IOTA = 1e9 NANOS)
 * @param gasBudget - Optional gas budget. If not provided, uses dynamic calculation as fallback.
 *                    Recommended: use dry run to estimate gas before calling this.
 * @throws Error if validators array is empty/invalid or amount is invalid
 */
export function buildStakeToValidatorsTx(
  validators: string[],
  amount: bigint,
  gasBudget?: number
): Transaction {
  // Validate inputs
  if (!validators || validators.length === 0) {
    throw new Error("At least one validator address is required");
  }
  validateAddressArray(validators, "Validators");

  if (amount <= 0n) {
    throw new Error("Stake amount must be greater than 0");
  }
  validateU64(amount, "Stake amount");

  const tx = new Transaction();

  // Only set gas budget if explicitly provided (for final execution)
  // For devInspect estimation, leave it unset to get accurate measurement
  if (gasBudget !== undefined) {
    tx.setGasBudget(gasBudget);
  }

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
 * @param certCoinIds - Array of tIOTA coin object IDs to use
 * @param amount - The amount of tIOTA to unstake (in NANOS)
 * @param gasBudget - Optional gas budget. If not provided, uses dynamic calculation.
 * @throws Error if certCoinIds is empty, amount is invalid, or too many coins
 */
export function buildUnstakeTx(certCoinIds: string[], amount: bigint, gasBudget?: number): Transaction {
  // Validate inputs
  if (!certCoinIds || certCoinIds.length === 0) {
    throw new Error("At least one tIOTA coin ID is required");
  }
  if (amount <= 0n) {
    throw new Error("Unstake amount must be greater than 0");
  }
  validateU64(amount, "Unstake amount");

  if (certCoinIds.length > MAX_COINS_PER_UNSTAKE) {
    throw new Error(
      `Too many coins (${certCoinIds.length}). Maximum is ${MAX_COINS_PER_UNSTAKE} per transaction. ` +
      `Please unstake in multiple transactions.`
    );
  }

  // Validate each coin ID
  certCoinIds.forEach((id, i) => {
    validateObjectId(id, `Coin ID[${i}]`);
  });

  const tx = new Transaction();
  // Only set gas budget if explicitly provided (for final execution)
  if (gasBudget !== undefined) {
    tx.setGasBudget(gasBudget);
  }

  const primaryCoin = tx.object(certCoinIds[0]);

  if (certCoinIds.length > 1) {
    tx.mergeCoins(primaryCoin, certCoinIds.slice(1).map(id => tx.object(id)));
  }

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
 * @param value - New minimum stake (must be > 1000 NANOS)
 * @throws Error if value is too low or exceeds u64
 */
export function buildChangeMinStakeTx(
  value: bigint,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  if (value < MIN_STAKE_VALUE) {
    throw new Error(`Minimum stake must be greater than 1000 NANOS (got ${value})`);
  }
  validateU64(value, "Minimum stake");
  validateObjectId(ownerCapId, "Owner Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

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
 * Change base reward fee (in basis points)
 * @param value - Fee in basis points (0-9999, e.g., 500 = 5%)
 * @throws Error if value is out of range
 */
export function buildChangeRewardFeeTx(
  value: number,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  if (!Number.isInteger(value) || value < 0 || value >= MAX_PERCENT) {
    throw new Error(
      `Reward fee must be an integer between 0 and ${MAX_PERCENT - 1} (got ${value}). ` +
      `Example: 500 = 5%`
    );
  }
  validateObjectId(ownerCapId, "Owner Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

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
 * Update rewards threshold (in basis points)
 * @param value - Threshold in basis points (1-10000, e.g., 100 = 1%)
 * @throws Error if value is out of range
 */
export function buildUpdateThresholdTx(
  value: number,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_PERCENT) {
    throw new Error(
      `Threshold must be an integer between 1 and ${MAX_PERCENT} (got ${value}). ` +
      `Example: 100 = 1%`
    );
  }
  validateObjectId(ownerCapId, "Owner Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

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
 * @param paused - Whether to pause the pool
 */
export function buildSetPauseTx(
  paused: boolean,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  validateObjectId(ownerCapId, "Owner Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

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
 * @param toAddress - Address to send collected fees to
 * @throws Error if toAddress is invalid
 */
export function buildCollectFeeTx(
  toAddress: string,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  validateAddress(toAddress, "Recipient address");
  validateObjectId(ownerCapId, "Owner Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

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

/**
 * Change max validator stake per epoch
 * @param value - Max amount in NANOS (must be >= 1 IOTA)
 * @throws Error if value is too low or exceeds u64
 */
export function buildChangeMaxStakePerEpochTx(
  value: bigint,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  if (value < ONE_IOTA) {
    throw new Error(`Max stake per epoch must be at least 1 IOTA (${ONE_IOTA} NANOS)`);
  }
  validateU64(value, "Max stake per epoch");
  validateObjectId(ownerCapId, "Owner Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

  tx.moveCall({
    target: `${PACKAGE_ID}::native_pool::change_max_validator_stake_per_epoch`,
    arguments: [
      tx.object(POOL_ID),
      tx.object(ownerCapId),
      tx.pure.u64(value),
    ],
  });

  return tx;
}

// ============================================
// Operator Transactions
// ============================================

/**
 * Update validators list
 * Gas budget scales dynamically with number of validators
 * @param validators - Array of validator addresses
 * @param priorities - Array of priority values (must match validators length)
 * @throws Error if arrays don't match or contain invalid values
 */
export function buildUpdateValidatorsTx(
  validators: string[],
  priorities: number[],
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  // Validate arrays exist and have content
  if (!validators || validators.length === 0) {
    throw new Error("At least one validator is required");
  }
  if (!priorities || !Array.isArray(priorities)) {
    throw new Error("Priorities array is required");
  }

  // Validate array lengths match
  if (validators.length !== priorities.length) {
    throw new Error(
      `Validators and priorities arrays must have the same length ` +
      `(got ${validators.length} validators and ${priorities.length} priorities)`
    );
  }

  // Validate addresses
  validateAddressArray(validators, "Validators");

  // Validate priorities are non-negative integers
  priorities.forEach((p, i) => {
    if (!Number.isInteger(p) || p < 0) {
      throw new Error(`Priority[${i}] must be a non-negative integer (got ${p})`);
    }
  });

  validateObjectId(operatorCapId, "Operator Cap ID");

  const tx = new Transaction();
  // Dynamic gas: each validator requires VecMap operations + sorting
  // 10 validators = 0.05 + (10 * 0.015) = 0.2 IOTA
  const gasBudget = calculateUpdateValidatorsGas(validators.length);
  tx.setGasBudget(gasBudget);

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
 * @param value - New total rewards value (must be > current total_rewards)
 * @throws Error if value exceeds u64
 */
export function buildUpdateRewardsTx(
  value: bigint,
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  if (value <= 0n) {
    throw new Error("Rewards value must be greater than 0");
  }
  validateU64(value, "Rewards value");
  validateObjectId(operatorCapId, "Operator Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_OPERATOR);

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
 * @param coinId - Object ID of the IOTA coin to add
 * @throws Error if coinId is invalid
 */
export function buildAddPendingTx(
  coinId: string,
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  validateObjectId(coinId, "Coin ID");
  validateObjectId(operatorCapId, "Operator Cap ID");

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_OPERATOR);

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
 * Rebalance - move stake from bad validators (priority 0) to good ones
 * Gas budget scales with estimated number of bad validators
 * @param estimatedBadValidators - Expected number of validators to rebalance (default: 5)
 *                                 Higher values = more gas budget for safety
 */
export function buildRebalanceTx(estimatedBadValidators: number = 5): Transaction {
  const tx = new Transaction();
  // Dynamic gas: rebalance iterates through bad validators, unstakes, and restakes
  // 5 validators = 0.1 + (5 * 0.03) = 0.25 IOTA
  const gasBudget = calculateRebalanceGas(estimatedBadValidators);
  tx.setGasBudget(gasBudget);

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
  tx.setGasBudget(GAS_BUDGET_ADMIN);

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
 * WARNING: This will PERMANENTLY transfer ownership. Double-check the address!
 * @param toAddress - The address to transfer ownership to
 * @throws Error if toAddress is invalid
 */
export function buildTransferOwnerCapTx(
  toAddress: string,
  ownerCapId: string = OWNER_CAP_ID
): Transaction {
  validateAddress(toAddress, "Recipient address");
  validateObjectId(ownerCapId, "Owner Cap ID");

  // Extra safety: prevent transfer to zero address
  if (toAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Cannot transfer ownership to zero address");
  }

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

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
 * WARNING: This will PERMANENTLY transfer operator rights. Double-check the address!
 * @param toAddress - The address to transfer operator rights to
 * @throws Error if toAddress is invalid
 */
export function buildTransferOperatorCapTx(
  toAddress: string,
  operatorCapId: string = OPERATOR_CAP_ID
): Transaction {
  validateAddress(toAddress, "Recipient address");
  validateObjectId(operatorCapId, "Operator Cap ID");

  // Extra safety: prevent transfer to zero address
  if (toAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Cannot transfer operator cap to zero address");
  }

  const tx = new Transaction();
  tx.setGasBudget(GAS_BUDGET_ADMIN);

  tx.moveCall({
    target: `${PACKAGE_ID}::ownership::transfer_operator`,
    arguments: [
      tx.object(operatorCapId),
      tx.pure.address(toAddress),
    ],
  });

  return tx;
}
