"use client";

import { useIotaClient } from "@iota/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { POOL_ID } from "@/lib/constants";

export interface ValidatorStake {
  address: string;
  totalStaked: bigint;
}

export function useProtocolStakes() {
  const client = useIotaClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["protocolStakes", POOL_ID],
    queryFn: async () => {
      // Get the pool object with all nested content
      const poolObj = await client.getObject({
        id: POOL_ID,
        options: { showContent: true },
      });

      if (poolObj.data?.content?.dataType !== "moveObject") {
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolFields = poolObj.data.content.fields as any;
      const validatorSetFields = poolFields?.validator_set?.fields;

      if (!validatorSetFields) {
        return [];
      }

      // Get validators from the sorted_validators vector or validators map
      const validatorsContents = validatorSetFields.validators?.fields?.contents || [];
      const validatorAddresses: string[] = [];

      for (const entry of validatorsContents) {
        const address = entry?.fields?.key;
        if (address) {
          validatorAddresses.push(address);
        }
      }

      // Get the vaults table ID
      const vaultsTableId = validatorSetFields.vaults?.fields?.id?.id;

      if (!vaultsTableId || validatorAddresses.length === 0) {
        return validatorAddresses.map((address) => ({
          address,
          totalStaked: 0n,
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
            const totalStaked = BigInt(
              vaultFields?.value?.fields?.total_staked ||
              vaultFields?.total_staked ||
              "0"
            );

            stakes.push({
              address: validatorAddress,
              totalStaked,
            });
            foundAddresses.add(validatorAddress);
          }
        } catch (e) {
          console.error("Error fetching vault:", e);
        }
      }

      // Add validators without vaults (0 stake)
      for (const addr of validatorAddresses) {
        if (!foundAddresses.has(addr)) {
          stakes.push({
            address: addr,
            totalStaked: 0n,
          });
        }
      }

      // Sort by stake (descending)
      stakes.sort((a, b) => {
        return b.totalStaked > a.totalStaked ? 1 : b.totalStaked < a.totalStaked ? -1 : 0;
      });

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
