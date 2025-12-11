"use client";

import { useCurrentAccount, useIotaClientQuery } from "@iota/dapp-kit";
import { OWNER_CAP_ID, OPERATOR_CAP_ID, PACKAGE_ID } from "@/lib/constants";
import type { AdminCaps } from "@/types";

const OWNER_CAP_TYPE = `${PACKAGE_ID}::ownership::OwnerCap`;
const OPERATOR_CAP_TYPE = `${PACKAGE_ID}::ownership::OperatorCap`;

export function useAdminCaps(): AdminCaps & { isLoading: boolean } {
  const account = useCurrentAccount();
  const address = account?.address;

  // Check if user owns the OwnerCap
  const { data: ownerCapData, isLoading: ownerLoading } = useIotaClientQuery(
    "getObject",
    {
      id: OWNER_CAP_ID,
      options: {
        showOwner: true,
      },
    },
    {
      enabled: !!address,
    }
  );

  // Check if user owns the OperatorCap
  const { data: operatorCapData, isLoading: operatorLoading } = useIotaClientQuery(
    "getObject",
    {
      id: OPERATOR_CAP_ID,
      options: {
        showOwner: true,
      },
    },
    {
      enabled: !!address,
    }
  );

  // Check ownership
  let hasOwnerCap = false;
  let hasOperatorCap = false;

  if (ownerCapData?.data?.owner && address) {
    const owner = ownerCapData.data.owner;
    if (typeof owner === "object" && owner !== null && "AddressOwner" in owner) {
      hasOwnerCap = (owner as { AddressOwner: string }).AddressOwner === address;
    }
  }

  if (operatorCapData?.data?.owner && address) {
    const owner = operatorCapData.data.owner;
    if (typeof owner === "object" && owner !== null && "AddressOwner" in owner) {
      hasOperatorCap = (owner as { AddressOwner: string }).AddressOwner === address;
    }
  }

  return {
    hasOwnerCap,
    hasOperatorCap,
    ownerCapId: hasOwnerCap ? OWNER_CAP_ID : undefined,
    operatorCapId: hasOperatorCap ? OPERATOR_CAP_ID : undefined,
    isLoading: ownerLoading || operatorLoading,
  };
}
