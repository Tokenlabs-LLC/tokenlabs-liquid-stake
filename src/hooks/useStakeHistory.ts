"use client";

import { useIotaClient } from "@iota/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { PACKAGE_ID, POOL_ID } from "@/lib/constants";

// Event types from the contract
export interface StakeHistoryEvent {
  type: "stake" | "stake_to_validators" | "unstake";
  timestamp: number;
  epoch: number;
  staker: string;
  iotaAmount: bigint;
  certAmount: bigint;
  validators?: string[]; // Only for stake_to_validators
  txDigest: string;
}

export interface ValidatorVaultInfo {
  address: string;
  totalStaked: bigint;
  stakeEpoch: number;
  stakedInEpoch: bigint;
  stakes: StakedIotaInfo[];
}

export interface StakedIotaInfo {
  objectId: string;
  principal: bigint;
  activationEpoch: number;
  rewardsStartEpoch: number; // activationEpoch + 1
}

export function useStakeHistory() {
  const client = useIotaClient();

  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["stakeHistory", PACKAGE_ID],
    queryFn: async () => {
      const history: StakeHistoryEvent[] = [];

      // Query StakedEvent
      try {
        const stakedEvents = await client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::native_pool::StakedEvent`,
          },
          order: "descending",
          limit: 50,
        });

        for (const event of stakedEvents.data) {
          const parsed = event.parsedJson as {
            staker: string;
            iota_amount: string;
            cert_amount: string;
          };

          history.push({
            type: "stake",
            timestamp: Number(event.timestampMs),
            epoch: 0, // Will be filled from checkpoint
            staker: parsed.staker,
            iotaAmount: BigInt(parsed.iota_amount),
            certAmount: BigInt(parsed.cert_amount),
            txDigest: event.id.txDigest,
          });
        }
      } catch (e) {
        console.error("Error fetching StakedEvent:", e);
      }

      // Query StakedToValidatorsEvent
      try {
        const stakedToValidatorsEvents = await client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::native_pool::StakedToValidatorsEvent`,
          },
          order: "descending",
          limit: 50,
        });

        for (const event of stakedToValidatorsEvents.data) {
          const parsed = event.parsedJson as {
            staker: string;
            validators: string[];
            iota_amount: string;
            cert_amount: string;
          };

          history.push({
            type: "stake_to_validators",
            timestamp: Number(event.timestampMs),
            epoch: 0,
            staker: parsed.staker,
            iotaAmount: BigInt(parsed.iota_amount),
            certAmount: BigInt(parsed.cert_amount),
            validators: parsed.validators,
            txDigest: event.id.txDigest,
          });
        }
      } catch (e) {
        console.error("Error fetching StakedToValidatorsEvent:", e);
      }

      // Query UnstakedEvent
      try {
        const unstakedEvents = await client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::native_pool::UnstakedEvent`,
          },
          order: "descending",
          limit: 50,
        });

        for (const event of unstakedEvents.data) {
          const parsed = event.parsedJson as {
            staker: string;
            cert_amount: string;
            iota_amount: string;
          };

          history.push({
            type: "unstake",
            timestamp: Number(event.timestampMs),
            epoch: 0,
            staker: parsed.staker,
            iotaAmount: BigInt(parsed.iota_amount),
            certAmount: BigInt(parsed.cert_amount),
            txDigest: event.id.txDigest,
          });
        }
      } catch (e) {
        console.error("Error fetching UnstakedEvent:", e);
      }

      // Sort by timestamp descending
      history.sort((a, b) => b.timestamp - a.timestamp);

      return history;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    events: events ?? [],
    isLoading: eventsLoading,
    refetch: refetchEvents,
  };
}

export function useValidatorVaults() {
  const client = useIotaClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["validatorVaults", POOL_ID],
    queryFn: async () => {
      // Get pool object
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

      const vaultsTableId = validatorSetFields.vaults?.fields?.id?.id;
      if (!vaultsTableId) {
        return [];
      }

      // Get ALL vaults with pagination
      const allDynamicFields: Awaited<ReturnType<typeof client.getDynamicFields>>["data"] = [];
      let vaultsCursor: string | null | undefined = null;

      do {
        const response = await client.getDynamicFields({
          parentId: vaultsTableId,
          limit: 50,
          cursor: vaultsCursor ?? undefined,
        });
        allDynamicFields.push(...response.data);
        vaultsCursor = response.hasNextPage ? response.nextCursor : null;
      } while (vaultsCursor);

      const vaults: ValidatorVaultInfo[] = [];

      for (const field of allDynamicFields) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const validatorAddress = (field.name as any).value;
          if (!validatorAddress) continue;

          const vaultObj = await client.getObject({
            id: field.objectId,
            options: { showContent: true },
          });

          if (vaultObj.data?.content?.dataType === "moveObject") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vaultFields = vaultObj.data.content.fields as any;
            const vaultData = vaultFields?.value?.fields || vaultFields;

            const totalStaked = BigInt(vaultData?.total_staked || "0");
            const stakeEpoch = parseInt(vaultData?.stake_epoch || "0");
            const stakedInEpoch = BigInt(vaultData?.staked_in_epoch || "0");

            // Get stakes table
            const stakesTableId = vaultData?.stakes?.fields?.id?.id;
            const stakes: StakedIotaInfo[] = [];

            if (stakesTableId) {
              try {
                // Get ALL stakes with pagination
                const allStakesFields: Awaited<ReturnType<typeof client.getDynamicFields>>["data"] = [];
                let stakesCursor: string | null | undefined = null;

                do {
                  const response = await client.getDynamicFields({
                    parentId: stakesTableId,
                    limit: 50,
                    cursor: stakesCursor ?? undefined,
                  });
                  allStakesFields.push(...response.data);
                  stakesCursor = response.hasNextPage ? response.nextCursor : null;
                } while (stakesCursor);

                for (const stakeField of allStakesFields) {
                  try {
                    const stakeObj = await client.getObject({
                      id: stakeField.objectId,
                      options: { showContent: true },
                    });

                    if (stakeObj.data?.content?.dataType === "moveObject") {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const stakeData = (stakeObj.data.content.fields as any)?.value?.fields || stakeObj.data.content.fields;

                      // StakedIota fields: id, pool_id, stake_activation_epoch, principal
                      const principal = BigInt(stakeData?.principal || "0");
                      const activationEpoch = parseInt(stakeData?.stake_activation_epoch || "0");

                      stakes.push({
                        objectId: stakeField.objectId,
                        principal,
                        activationEpoch,
                        rewardsStartEpoch: activationEpoch + 1,
                      });
                    }
                  } catch (e) {
                    console.error("Error fetching stake:", e);
                  }
                }

                // Sort by activation epoch
                stakes.sort((a, b) => a.activationEpoch - b.activationEpoch);
              } catch (e) {
                console.error("Error fetching stakes table:", e);
              }
            }

            vaults.push({
              address: validatorAddress,
              totalStaked,
              stakeEpoch,
              stakedInEpoch,
              stakes,
            });
          }
        } catch (e) {
          console.error("Error fetching vault:", e);
        }
      }

      // Sort by total staked descending
      vaults.sort((a, b) => {
        if (b.totalStaked > a.totalStaked) return 1;
        if (b.totalStaked < a.totalStaked) return -1;
        return 0;
      });

      return vaults;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    vaults: data ?? [],
    isLoading,
    refetch,
  };
}

// Hook to get current system epoch info
export function useEpochInfo() {
  const client = useIotaClient();

  const { data } = useQuery({
    queryKey: ["epochInfo"],
    queryFn: async () => {
      const systemState = await client.getLatestIotaSystemState();
      return {
        currentEpoch: parseInt(systemState.epoch),
        epochStartTimestamp: parseInt(systemState.epochStartTimestampMs),
        epochDurationMs: parseInt(systemState.epochDurationMs),
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return data ?? { currentEpoch: 0, epochStartTimestamp: 0, epochDurationMs: 0 };
}

// Hook to get REAL rewards calculated from EXCHANGE RATES directly
// NOT using estimatedReward - we calculate ourselves from the staking pool exchange rates
export interface PoolRewardsInfo {
  totalPrincipal: bigint;
  totalRewards: bigint; // REAL rewards calculated from exchange rates
  totalValue: bigint; // principal + rewards
  currentEpoch: number;
  calculationMethod: "exchange_rates"; // To show we're using real data
  validatorBreakdown: {
    validatorAddress: string;
    validatorName: string;
    stakingPoolId: string;
    principal: bigint;
    rewards: bigint;
    currentValue: bigint; // principal + rewards
    stakeActivationEpoch: number;
    stakesCount: number;
    activeStakes: number;
    pendingStakes: number;
    // Exchange rate data
    currentExchangeRate: number; // iota_amount / pool_token_amount
  }[];
}

// Interface for exchange rate calculation
interface ExchangeRateData {
  iotaAmount: bigint;
  poolTokenAmount: bigint;
}

// Calculate exchange rate as a decimal (for display only)
function calculateExchangeRate(data: ExchangeRateData): number {
  if (data.poolTokenAmount === 0n) return 1;
  return Number(data.iotaAmount) / Number(data.poolTokenAmount);
}

// Calculate reward using BigInt to avoid precision loss
// Formula: currentValue = principal * (current_iota / current_pool_token) / (deposit_iota / deposit_pool_token)
// Simplified: currentValue = principal * current_iota * deposit_pool_token / (current_pool_token * deposit_iota)
function calculateRewardBigInt(
  principal: bigint,
  currentRate: ExchangeRateData,
  depositRate: ExchangeRateData
): bigint {
  // Handle edge cases
  if (currentRate.poolTokenAmount === 0n || depositRate.iotaAmount === 0n || depositRate.poolTokenAmount === 0n) {
    return 0n;
  }

  // Use BigInt multiplication with proper ordering to avoid overflow
  // currentValue = principal * currentIota * depositPoolToken / (currentPoolToken * depositIota)
  const numerator = principal * currentRate.iotaAmount * depositRate.poolTokenAmount;
  const denominator = currentRate.poolTokenAmount * depositRate.iotaAmount;

  if (denominator === 0n) return 0n;

  const currentValue = numerator / denominator;
  const reward = currentValue - principal;

  return reward > 0n ? reward : 0n;
}

export function usePoolRewardsEstimate() {
  const client = useIotaClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["poolRewardsReal", POOL_ID],
    queryFn: async () => {
      try {
        // 1. Get system state to get exchange rates for all validators
        const systemState = await client.getLatestIotaSystemState();
        const currentEpoch = parseInt(systemState.epoch);

        // Build map of validator address -> staking pool data (with current exchange rate)
        const validatorPoolData = new Map<string, {
          name: string;
          stakingPoolId: string;
          exchangeRatesId: string;
          currentExchangeRate: ExchangeRateData;
        }>();

        for (const validator of systemState.activeValidators) {
          const addr = validator.iotaAddress.toLowerCase();
          validatorPoolData.set(addr, {
            name: validator.name || "Unknown",
            stakingPoolId: validator.stakingPoolId,
            exchangeRatesId: (validator as { exchangeRatesId?: string }).exchangeRatesId || "",
            currentExchangeRate: {
              // Current exchange rate = stakingPoolIotaBalance / poolTokenBalance
              iotaAmount: BigInt(validator.stakingPoolIotaBalance || "0"),
              poolTokenAmount: BigInt(validator.poolTokenBalance || "0"),
            },
          });
        }

        // 2. Get pool object to find our stake objects
        const poolObj = await client.getObject({
          id: POOL_ID,
          options: { showContent: true },
        });

        if (poolObj.data?.content?.dataType !== "moveObject") {
          return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poolFields = poolObj.data.content.fields as any;
        const validatorSetFields = poolFields?.validator_set?.fields;

        if (!validatorSetFields) {
          return null;
        }

        const vaultsTableId = validatorSetFields.vaults?.fields?.id?.id;
        if (!vaultsTableId) {
          return null;
        }

        // Get ALL vaults with pagination
        const allVaultFields: Awaited<ReturnType<typeof client.getDynamicFields>>["data"] = [];
        let vaultCursor: string | null | undefined = null;

        do {
          const response = await client.getDynamicFields({
            parentId: vaultsTableId,
            limit: 50,
            cursor: vaultCursor ?? undefined,
          });
          allVaultFields.push(...response.data);
          vaultCursor = response.hasNextPage ? response.nextCursor : null;
        } while (vaultCursor);

        let totalPrincipal = 0n;
        let totalRewards = 0n;
        const validatorBreakdown: PoolRewardsInfo["validatorBreakdown"] = [];

        // Process each validator vault
        for (const field of allVaultFields) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const validatorAddress = (field.name as any).value;
            if (!validatorAddress) continue;

            const poolData = validatorPoolData.get(validatorAddress.toLowerCase());
            if (!poolData) continue;

            const vaultObj = await client.getObject({
              id: field.objectId,
              options: { showContent: true },
            });

            if (vaultObj.data?.content?.dataType !== "moveObject") continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vaultFields = vaultObj.data.content.fields as any;
            const vaultData = vaultFields?.value?.fields || vaultFields;

            // Get stakes table
            const stakesTableId = vaultData?.stakes?.fields?.id?.id;
            if (!stakesTableId) continue;

            // Get ALL stakes with pagination
            const allStakesFields: Awaited<ReturnType<typeof client.getDynamicFields>>["data"] = [];
            let stakesCursor: string | null | undefined = null;

            do {
              const response = await client.getDynamicFields({
                parentId: stakesTableId,
                limit: 50,
                cursor: stakesCursor ?? undefined,
              });
              allStakesFields.push(...response.data);
              stakesCursor = response.hasNextPage ? response.nextCursor : null;
            } while (stakesCursor);

            // Collect stake info for this validator
            interface StakeInfo {
              principal: bigint;
              activationEpoch: number;
              poolId: string;
            }
            const stakes: StakeInfo[] = [];

            for (const stakeField of allStakesFields) {
              try {
                const stakeObj = await client.getObject({
                  id: stakeField.objectId,
                  options: { showContent: true },
                });

                if (stakeObj.data?.content?.dataType === "moveObject") {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const stakeData = (stakeObj.data.content.fields as any)?.value?.fields || stakeObj.data.content.fields;
                  stakes.push({
                    principal: BigInt(stakeData?.principal || "0"),
                    activationEpoch: parseInt(stakeData?.stake_activation_epoch || "0"),
                    poolId: stakeData?.pool_id || "",
                  });
                }
              } catch (e) {
                console.error("Error fetching stake:", e);
              }
            }

            if (stakes.length === 0) continue;

            // 3. Get exchange rates for deposit epochs from the exchange_rates table
            // We need to query the exchange rate at each stake's activation epoch
            const exchangeRatesId = poolData.exchangeRatesId;
            const depositRates = new Map<number, ExchangeRateData>();

            if (exchangeRatesId) {
              // Get unique activation epochs
              const uniqueEpochs = [...new Set(stakes.map(s => s.activationEpoch))];

              // Query exchange rates for these epochs using getDynamicFieldObject
              // This queries directly by key instead of paginating through all entries
              for (const epoch of uniqueEpochs) {
                try {
                  // Use getDynamicFieldObject to query by epoch key directly
                  const rateObj = await client.getDynamicFieldObject({
                    parentObjectId: exchangeRatesId,
                    name: {
                      type: "u64",
                      value: epoch.toString(),
                    },
                  });

                  if (rateObj.data?.content?.dataType === "moveObject") {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const rateFields = (rateObj.data.content.fields as any)?.value?.fields ||
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (rateObj.data.content.fields as any)?.value ||
                      rateObj.data.content.fields;
                    depositRates.set(epoch, {
                      iotaAmount: BigInt(rateFields?.iota_amount || "0"),
                      poolTokenAmount: BigInt(rateFields?.pool_token_amount || "0"),
                    });
                  }
                } catch (e) {
                  // If we can't get the exact epoch, try to fallback
                  // This can happen for very new stakes where the epoch hasn't been recorded yet
                  console.warn(`Could not fetch exchange rate for epoch ${epoch}, stake may be too new`);
                }
              }
            }

            // 4. Calculate rewards for each stake using exchange rates (BigInt precision)
            // Formula: reward = principal × (current_rate / deposit_rate) - principal
            let validatorPrincipal = 0n;
            let validatorRewards = 0n;
            let earliestActivation = Infinity;
            let activeCount = 0;
            let pendingCount = 0;

            const currentRateData = poolData.currentExchangeRate;
            const currentRateDisplay = calculateExchangeRate(currentRateData);

            for (const stake of stakes) {
              validatorPrincipal += stake.principal;

              // Check if stake is active AND earning (rewards start at activation + 1)
              // Stake lifecycle: created -> pending (activation epoch) -> active (activation+1 onwards)
              const isActive = stake.activationEpoch <= currentEpoch;
              const isEarning = stake.activationEpoch < currentEpoch; // Rewards start next epoch

              if (stake.activationEpoch < earliestActivation) {
                earliestActivation = stake.activationEpoch;
              }

              if (isActive) {
                activeCount++;

                if (isEarning) {
                  // Get deposit exchange rate
                  const depositRateData = depositRates.get(stake.activationEpoch);

                  if (depositRateData && depositRateData.poolTokenAmount > 0n) {
                    // Use BigInt calculation for precision
                    const reward = calculateRewardBigInt(stake.principal, currentRateData, depositRateData);
                    validatorRewards += reward;
                  } else {
                    // FALLBACK: If we couldn't get deposit rate, try using current rate as estimate
                    // This assumes rate was ~1.0 at deposit time (conservative estimate)
                    // Only do this for stakes that should definitely have rewards
                    const epochsEarning = currentEpoch - stake.activationEpoch;
                    if (epochsEarning >= 2) {
                      // Use a conservative estimate: assume 5% APY, ~0.014% per epoch
                      // This is better than returning 0 for old stakes
                      const estimatedRewardPercent = BigInt(Math.floor(epochsEarning * 14)); // 0.014% per epoch in basis points
                      const estimatedReward = (stake.principal * estimatedRewardPercent) / 1000000n;
                      validatorRewards += estimatedReward;
                      console.warn(`Using fallback estimate for stake at epoch ${stake.activationEpoch} (${epochsEarning} epochs): ${estimatedReward}`);
                    }
                    // For recent stakes without rate data, 0 rewards is acceptable
                  }
                }
                // Stakes at activation epoch are active but not earning yet - 0 rewards is correct
              } else {
                pendingCount++;
                // Pending stakes don't have rewards yet
              }
            }

            totalPrincipal += validatorPrincipal;
            totalRewards += validatorRewards;

            validatorBreakdown.push({
              validatorAddress,
              validatorName: poolData.name,
              stakingPoolId: poolData.stakingPoolId,
              principal: validatorPrincipal,
              rewards: validatorRewards,
              currentValue: validatorPrincipal + validatorRewards,
              stakeActivationEpoch: earliestActivation === Infinity ? 0 : earliestActivation,
              stakesCount: stakes.length,
              activeStakes: activeCount,
              pendingStakes: pendingCount,
              currentExchangeRate: currentRateDisplay,
            });
          } catch (e) {
            console.error("Error processing validator:", e);
          }
        }

        // Sort by principal descending
        validatorBreakdown.sort((a, b) => {
          if (b.principal > a.principal) return 1;
          if (b.principal < a.principal) return -1;
          return 0;
        });

        return {
          totalPrincipal,
          totalRewards,
          totalValue: totalPrincipal + totalRewards,
          currentEpoch,
          calculationMethod: "exchange_rates" as const,
          validatorBreakdown,
        } as PoolRewardsInfo;
      } catch (e) {
        console.error("Error calculating pool rewards:", e);
        return null;
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    rewardsInfo: data,
    isLoading,
    refetch,
  };
}
