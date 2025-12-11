"use client";

import { useCurrentAccount, useIotaClientQuery } from "@iota/dapp-kit";
import { CERT_TYPE } from "@/lib/constants";
import type { CoinObject } from "@/types";

export function useUserBalances() {
  const account = useCurrentAccount();
  const address = account?.address;

  // Get IOTA coins
  const {
    data: iotaCoinsData,
    isLoading: iotaLoading,
    refetch: refetchIota,
  } = useIotaClientQuery(
    "getCoins",
    {
      owner: address!,
      coinType: "0x2::iota::IOTA",
    },
    {
      enabled: !!address,
    }
  );

  // Get tIOTA (CERT) coins
  const {
    data: certCoinsData,
    isLoading: certLoading,
    refetch: refetchCert,
  } = useIotaClientQuery(
    "getCoins",
    {
      owner: address!,
      coinType: CERT_TYPE,
    },
    {
      enabled: !!address,
    }
  );

  // Parse IOTA coins
  const iotaCoins: CoinObject[] = (iotaCoinsData?.data || []).map((coin) => ({
    objectId: coin.coinObjectId,
    balance: BigInt(coin.balance),
  }));

  const totalIota = iotaCoins.reduce((sum, coin) => sum + coin.balance, 0n);

  // Parse tIOTA coins
  const tiotaCoins: CoinObject[] = (certCoinsData?.data || []).map((coin) => ({
    objectId: coin.coinObjectId,
    balance: BigInt(coin.balance),
  }));

  const totalTiota = tiotaCoins.reduce((sum, coin) => sum + coin.balance, 0n);

  const refetch = () => {
    refetchIota();
    refetchCert();
  };

  return {
    address,
    iotaCoins,
    tiotaCoins,
    totalIota,
    totalTiota,
    isLoading: iotaLoading || certLoading,
    isConnected: !!address,
    refetch,
  };
}
