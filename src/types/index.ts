// Pool state from the contract
export interface PoolState {
  pending: bigint;
  collectableFee: bigint;
  totalStaked: bigint;
  totalRewards: bigint;
  collectedRewards: bigint;
  minStake: bigint;
  baseRewardFee: number;
  rewardsThreshold: number;
  rewardsUpdateTs: number;
  maxValidatorStakePerEpoch: bigint;
  paused: boolean;
  version: number;
}

// Validator info
export interface ValidatorInfo {
  name: string;
  address: string;
  imageUrl?: string;
  priority?: number;
  apy?: number;
  totalStake?: bigint;
}

// Token metadata
export interface TokenMetadata {
  totalSupply: bigint;
  decimals: number;
  symbol: string;
  name: string;
}

// User balances
export interface UserBalances {
  iota: bigint;
  tiota: bigint;
  iotaCoins: CoinObject[];
  tiotaCoins: CoinObject[];
}

// Coin object from chain
export interface CoinObject {
  objectId: string;
  balance: bigint;
}

// Admin capabilities
export interface AdminCaps {
  hasOwnerCap: boolean;
  hasOperatorCap: boolean;
  ownerCapId?: string;
  operatorCapId?: string;
}

// Transaction result
export interface TxResult {
  digest: string;
  status: "success" | "failure";
  error?: string;
}

// Pool fields from dynamic field lookup
export interface NativePoolFields {
  pending: string;
  collectable_fee: string;
  total_staked: string;
  staked_update_epoch: string;
  base_reward_fee: string;
  version: string;
  paused: boolean;
  min_stake: string;
  total_rewards: string;
  collected_rewards: string;
  rewards_threshold: string;
  rewards_update_ts: string;
  max_validator_stake_per_epoch: string;
}

// Metadata fields
export interface MetadataFields {
  total_supply: {
    fields: {
      value: string;
    };
  };
}
