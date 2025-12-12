"use client";

import { useIotaClient } from "@iota/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { POOL_ID } from "@/lib/constants";

export interface ValidatorStake {
  address: string;
  totalStaked: bigint;
  priority: number;
  votingPower: number;
  registrationOrder: number; // Order in which validator was added to protocol
  stakedInEpoch: bigint; // Amount staked in current epoch (for max limit check)
  stakeEpoch: number; // Epoch when last stake was made
}

export function useProtocolStakes() {
  const client = useIotaClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["protocolStakes", POOL_ID],
    queryFn: async () => {
      // Fetch pool object and system state in parallel
      const [poolObj, systemState] = await Promise.all([
        client.getObject({
          id: POOL_ID,
          options: { showContent: true },
        }),
        client.getLatestIotaSystemState(),
      ]);

      if (poolObj.data?.content?.dataType !== "moveObject") {
        return [];
      }

      // Get current epoch
      const currentEpoch = parseInt(systemState.epoch);

      // Build voting power map from system validators
      const votingPowerMap = new Map<string, number>();
      for (const v of systemState.activeValidators) {
        votingPowerMap.set(
          v.iotaAddress.toLowerCase(),
          v.votingPower ? parseInt(v.votingPower) : 0
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolFields = poolObj.data.content.fields as any;
      const validatorSetFields = poolFields?.validator_set?.fields;

      if (!validatorSetFields) {
        return [];
      }

      // Get validators from the sorted_validators vector or validators map
      const validatorsContents = validatorSetFields.validators?.fields?.contents || [];
      const validatorData: Map<string, { priority: number; order: number }> = new Map();

      let order = 0;
      for (const entry of validatorsContents) {
        const address = entry?.fields?.key;
        const priority = parseInt(entry?.fields?.value || "0");
        if (address) {
          // Normalize address to lowercase for consistent matching
          validatorData.set(address.toLowerCase(), { priority, order: order++ });
        }
      }

      const validatorAddresses = Array.from(validatorData.keys());

      // Get the vaults table ID
      const vaultsTableId = validatorSetFields.vaults?.fields?.id?.id;

      if (!vaultsTableId || validatorAddresses.length === 0) {
        return validatorAddresses.map((address) => ({
          address,
          totalStaked: 0n,
          priority: validatorData.get(address)?.priority ?? 0,
          votingPower: votingPowerMap.get(address.toLowerCase()) ?? 0,
          registrationOrder: validatorData.get(address)?.order ?? 999,
          stakedInEpoch: 0n,
          stakeEpoch: 0,
        }));
      }

      // Query all dynamic fields at once to get the vaults
      const dynamicFields = await client.getDynamicFields({
        parentId: vaultsTableId,
        limit: 50,
      });

      const stakes: ValidatorStake[] = [];
      const foundAddresses = new Set<string>();

      // Process each dynamic field (vault)
      for (const field of dynamicFields.data) {
        try {
          // The name contains the validator address
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const validatorAddress = (field.name as any).value;

          if (!validatorAddress) continue;

          // Get the vault object
          const vaultObj = await client.getObject({
            id: field.objectId,
            options: { showContent: true },
          });

          if (vaultObj.data?.content?.dataType === "moveObject") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vaultFields = vaultObj.data.content.fields as any;
            // The vault might be wrapped in a "value" field
            const vaultData = vaultFields?.value?.fields || vaultFields;
            const totalStaked = BigInt(vaultData?.total_staked || "0");
            const stakeEpoch = parseInt(vaultData?.stake_epoch || "0");
            // Only count stakedInEpoch if it's from the current epoch
            const stakedInEpoch = stakeEpoch === currentEpoch
              ? BigInt(vaultData?.staked_in_epoch || "0")
              : 0n;

            stakes.push({
              address: validatorAddress,
              totalStaked,
              priority: validatorData.get(validatorAddress.toLowerCase())?.priority ?? 0,
              votingPower: votingPowerMap.get(validatorAddress.toLowerCase()) ?? 0,
              registrationOrder: validatorData.get(validatorAddress.toLowerCase())?.order ?? 999,
              stakedInEpoch,
              stakeEpoch,
            });
            foundAddresses.add(validatorAddress.toLowerCase());
          }
        } catch (e) {
          console.error("Error fetching vault:", e);
        }
      }

      // Add validators without vaults (0 stake)
      for (const addr of validatorAddresses) {
        if (!foundAddresses.has(addr.toLowerCase())) {
          stakes.push({
            address: addr,
            totalStaked: 0n,
            priority: validatorData.get(addr.toLowerCase())?.priority ?? 0,
            votingPower: votingPowerMap.get(addr.toLowerCase()) ?? 0,
            registrationOrder: validatorData.get(addr.toLowerCase())?.order ?? 999,
            stakedInEpoch: 0n,
            stakeEpoch: 0,
          });
        }
      }

      // Sort by voting power (descending)
      stakes.sort((a, b) => b.votingPower - a.votingPower);

      return stakes;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const totalProtocolStake = data?.reduce((sum, v) => sum + v.totalStaked, 0n) ?? 0n;

  return {
    stakes: data ?? [],
    totalProtocolStake,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get current epoch
export function useCurrentEpoch() {
  const client = useIotaClient();

  const { data } = useQuery({
    queryKey: ["currentEpoch"],
    queryFn: async () => {
      const systemState = await client.getLatestIotaSystemState();
      return parseInt(systemState.epoch);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return data ?? 0;
}
