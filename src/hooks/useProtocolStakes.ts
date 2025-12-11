"use client";

import { useIotaClient } from "@iota/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { POOL_ID } from "@/lib/constants";

export interface ValidatorStake {
  address: string;
  totalStaked: bigint;
  priority: number;
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
              priority: validatorData.get(validatorAddress.toLowerCase())?.priority ?? 0,
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
          });
        }
      }

      // Sort by priority (descending), then by registration order (ascending)
      stakes.sort((a, b) => {
        const priorityA = a.priority;
        const priorityB = b.priority;

        // First sort by priority (higher first)
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }

        // Then by registration order (earlier first)
        const orderA = validatorData.get(a.address.toLowerCase())?.order ?? 999;
        const orderB = validatorData.get(b.address.toLowerCase())?.order ?? 999;
        return orderA - orderB;
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
