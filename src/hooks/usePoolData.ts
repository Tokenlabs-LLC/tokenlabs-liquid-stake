"use client";

import { useIotaClientQuery } from "@iota/dapp-kit";
import { POOL_ID, METADATA_ID, ONE_IOTA } from "@/lib/constants";
import type { PoolState, TokenMetadata, NativePoolFields, MetadataFields } from "@/types";

// Hook to get pool state
export function usePoolState() {
  const { data, isLoading, error, refetch } = useIotaClientQuery("getObject", {
    id: POOL_ID,
    options: {
      showContent: true,
    },
  });

  let poolState: PoolState | null = null;

  if (data?.data?.content?.dataType === "moveObject") {
    const fields = data.data.content.fields as unknown as NativePoolFields;
    poolState = {
      pending: BigInt(fields.pending || "0"),
      collectableFee: BigInt(fields.collectable_fee || "0"),
      totalStaked: BigInt(fields.total_staked || "0"),
      totalRewards: BigInt(fields.total_rewards || "0"),
      collectedRewards: BigInt(fields.collected_rewards || "0"),
      minStake: BigInt(fields.min_stake || ONE_IOTA.toString()),
      baseRewardFee: parseInt(fields.base_reward_fee || "500"),
      rewardsThreshold: parseInt(fields.rewards_threshold || "100"),
      rewardsUpdateTs: parseInt(fields.rewards_update_ts || "0"),
      maxValidatorStakePerEpoch: BigInt(fields.max_validator_stake_per_epoch || "0"),
      paused: fields.paused || false,
      version: parseInt(fields.version || "1"),
    };
  }

  return {
    poolState,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get token metadata (tIOTA supply)
export function useTokenMetadata() {
  const { data, isLoading, error, refetch } = useIotaClientQuery("getObject", {
    id: METADATA_ID,
    options: {
      showContent: true,
    },
  });

  let metadata: TokenMetadata | null = null;

  if (data?.data?.content?.dataType === "moveObject") {
    const fields = data.data.content.fields as unknown as MetadataFields;
    metadata = {
      totalSupply: BigInt(fields.total_supply?.fields?.value || "0"),
      decimals: 9,
      symbol: "tIOTA",
      name: "Tokenlabs IOTA",
    };
  }

  return {
    metadata,
    isLoading,
    error,
    refetch,
  };
}

// Combined pool data hook
export function usePoolData() {
  const { poolState, isLoading: poolLoading, error: poolError, refetch: refetchPool } = usePoolState();
  const { metadata, isLoading: metadataLoading, error: metadataError, refetch: refetchMetadata } = useTokenMetadata();

  const RATIO_MAX = 1_000_000_000_000_000_000n;

  let ratio: bigint = RATIO_MAX; // Default 1:1

  if (poolState && metadata) {
    const tvl = poolState.totalStaked + poolState.pending + poolState.totalRewards - poolState.collectedRewards;

    if (tvl > 0n && metadata.totalSupply > 0n) {
      ratio = (metadata.totalSupply * RATIO_MAX) / tvl;
    } else if (metadata.totalSupply === 0n) {
      // Empty pool - 1:1 ratio
      ratio = RATIO_MAX;
    }
  }

  // Refetch both pool state and metadata
  const refetch = async () => {
    await Promise.all([refetchPool(), refetchMetadata()]);
  };

  return {
    poolState,
    metadata,
    ratio,
    isLoading: poolLoading || metadataLoading,
    error: poolError || metadataError,
    refetch,
  };
}
