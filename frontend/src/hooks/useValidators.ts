"use client";

import { useIotaClientQuery } from "@iota/dapp-kit";
import { DEFAULT_VALIDATORS } from "@/lib/constants";
import type { ValidatorInfo } from "@/types";

export function useValidators() {
  // Get all validators from the system
  const { data, isLoading, error } = useIotaClientQuery("getLatestIotaSystemState", {});

  let validators: ValidatorInfo[] = [];

  if (data) {
    // Map active validators
    validators = data.activeValidators.map((v) => ({
      name: v.name || "Unknown",
      address: v.iotaAddress,
      apy: v.stakingPoolIotaBalance ? parseFloat(v.stakingPoolIotaBalance) : undefined,
      totalStake: BigInt(v.stakingPoolIotaBalance || "0"),
    }));

    // Sort by stake (descending)
    validators.sort((a, b) => {
      const stakeA = a.totalStake || 0n;
      const stakeB = b.totalStake || 0n;
      return stakeB > stakeA ? 1 : stakeB < stakeA ? -1 : 0;
    });
  }

  // Mark default validators
  const defaultAddresses = new Set(DEFAULT_VALIDATORS.map((v) => v.address));

  return {
    validators,
    defaultValidators: DEFAULT_VALIDATORS,
    isDefaultValidator: (address: string) => defaultAddresses.has(address),
    isLoading,
    error,
  };
}
