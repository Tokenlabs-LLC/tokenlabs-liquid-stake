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
      imageUrl: v.imageUrl || undefined,
      apy: v.stakingPoolIotaBalance ? parseFloat(v.stakingPoolIotaBalance) : undefined,
      totalStake: BigInt(v.stakingPoolIotaBalance || "0"),
      votingPower: v.votingPower ? parseInt(v.votingPower) : 0,
    }));

    // Sort by voting power (descending)
    validators.sort((a, b) => {
      const vpA = a.votingPower || 0;
      const vpB = b.votingPower || 0;
      return vpB - vpA;
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
