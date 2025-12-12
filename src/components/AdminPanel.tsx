"use client";

import { useState, useMemo, useCallback } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useIotaClient } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { useAdminCaps } from "@/hooks/useAdmin";
import { usePoolData } from "@/hooks/usePoolData";

// Validation helpers for production safety
const MAX_U64 = 18446744073709551615n;

function isValidIotaAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(addr);
}

function safeParseIota(input: string): bigint | null {
  try {
    if (!input || !/^[0-9.]+$/.test(input.trim())) return null;
    const parts = input.trim().split(".");
    if (parts.length > 2) return null;
    const whole = BigInt(parts[0] || "0");
    let fraction = 0n;
    if (parts[1]) {
      const fracStr = parts[1].padEnd(9, "0").slice(0, 9);
      fraction = BigInt(fracStr);
    }
    const result = whole * 1_000_000_000n + fraction;
    if (result < 0n || result > MAX_U64) return null;
    return result;
  } catch {
    return null;
  }
}

function safeParsePercent(input: string): number | null {
  try {
    if (!input || !/^[0-9.]+$/.test(input.trim())) return null;
    const value = parseFloat(input.trim());
    if (isNaN(value) || value < 0 || value > 100) return null;
    return value;
  } catch {
    return null;
  }
}

function safeParseInt(input: string, min: number, max: number): number | null {
  try {
    if (!input) return null;
    const value = parseInt(input.trim());
    if (isNaN(value) || value < min || value > max) return null;
    return value;
  } catch {
    return null;
  }
}

// Avatar component with fallback
function ValidatorAvatar({
  imageUrl,
  name,
}: {
  imageUrl?: string;
  name: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return (
      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-gray-400">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className="w-6 h-6 rounded-full flex-shrink-0"
      onError={() => setHasError(true)}
    />
  );
}
import {
  buildChangeMinStakeTx,
  buildChangeRewardFeeTx,
  buildUpdateThresholdTx,
  buildSetPauseTx,
  buildCollectFeeTx,
  buildChangeMaxStakePerEpochTx,
  buildUpdateValidatorsTx,
  buildUpdateRewardsTx,
  buildRebalanceTx,
  buildTransferOwnerCapTx,
  buildTransferOperatorCapTx,
} from "@/lib/transactions";
import { formatIota, formatPercent, formatRelativeTime, truncateAddress } from "@/lib/utils";
import { useProtocolStakes } from "@/hooks/useProtocolStakes";
import { useValidators } from "@/hooks/useValidators";
import { StakeHistoryPanel } from "./StakeHistoryPanel";

export function AdminPanel() {
  const account = useCurrentAccount();
  const client = useIotaClient();
  const { hasOwnerCap, hasOperatorCap, ownerCapId, operatorCapId, isLoading: capsLoading } = useAdminCaps();
  const { poolState, refetch: refetchPool } = usePoolData();
  const { stakes: protocolStakesRaw, totalProtocolStake } = useProtocolStakes();

  // Sort by priority (descending), then by registration order (ascending)
  const protocolStakes = useMemo(() => {
    return [...protocolStakesRaw].sort((a, b) => {
      // First sort by priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by registration order (earlier first)
      return a.registrationOrder - b.registrationOrder;
    });
  }, [protocolStakesRaw]);
  const { validators: systemValidators } = useValidators();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  // Create memoized validator lookup functions
  const getValidatorName = useMemo(
    () => (address: string) => {
      const validator = systemValidators.find(
        (v) => v.address.toLowerCase() === address.toLowerCase()
      );
      return validator?.name || truncateAddress(address, 6);
    },
    [systemValidators]
  );

  const getValidatorImage = useMemo(
    () => (address: string) => {
      const validator = systemValidators.find(
        (v) => v.address.toLowerCase() === address.toLowerCase()
      );
      return validator?.imageUrl;
    },
    [systemValidators]
  );

  // Owner form state
  const [minStake, setMinStake] = useState("");
  const [maxStakePerEpoch, setMaxStakePerEpoch] = useState("");
  const [rewardFee, setRewardFee] = useState("");
  const [threshold, setThreshold] = useState("");
  const [feeRecipient, setFeeRecipient] = useState("");

  // Operator form state
  const [newValidatorAddress, setNewValidatorAddress] = useState("");
  const [newValidatorPriority, setNewValidatorPriority] = useState("50");
  const [rewardsValue, setRewardsValue] = useState("");

  // Transfer form state
  const [newOwnerAddress, setNewOwnerAddress] = useState("");
  const [newOperatorAddress, setNewOperatorAddress] = useState("");
  const [showDangerZone, setShowDangerZone] = useState(false);

  // Validator search
  const [validatorSearch, setValidatorSearch] = useState("");

  // Filter validators by search
  const filteredProtocolStakes = useMemo(() => {
    if (!validatorSearch.trim()) return protocolStakes;
    const query = validatorSearch.toLowerCase();
    return protocolStakes.filter((stake) => {
      const name = getValidatorName(stake.address).toLowerCase();
      const address = stake.address.toLowerCase();
      return name.includes(query) || address.includes(query);
    });
  }, [protocolStakes, validatorSearch, getValidatorName]);

  // Status
  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error" | "pending" | null;
    message: string;
  }>({ type: null, message: "" });

  /**
   * Execute transaction with automatic gas estimation using devInspect
   */
  const executeTx = useCallback(
    async (
      tx: Transaction,
      successMsg: string
    ) => {
      if (!account) return;

      setTxStatus({ type: "pending", message: "Estimating gas..." });

      try {
        // Set sender and high gas budget for accurate estimation
        tx.setSender(account.address);
        tx.setGasBudget(500_000_000); // 0.5 IOTA max for estimation

        // Use devInspectTransactionBlock for gas estimation
        const inspectResult = await client.devInspectTransactionBlock({
          transactionBlock: tx,
          sender: account.address,
        });

        if (inspectResult.effects.status.status !== "success") {
          const errorMsg = inspectResult.effects.status.error || "Transaction simulation failed";
          setTxStatus({ type: "error", message: `Simulation failed: ${errorMsg.slice(0, 80)}` });
          setTimeout(() => setTxStatus({ type: null, message: "" }), 8000);
          return;
        }

        // Calculate gas with 10% buffer
        const gasUsed = inspectResult.effects.gasUsed;
        const computationCost = BigInt(gasUsed.computationCost);
        const storageCost = BigInt(gasUsed.storageCost);
        const storageRebate = BigInt(gasUsed.storageRebate);
        // gasBudget needs to cover computation + storage (rebate comes back after)
        const gasBudget = computationCost + storageCost;
        const gasWithBuffer = BigInt(Math.ceil(Number(gasBudget) * 1.1));
        // Minimum 0.01 IOTA, maximum 2 IOTA
        const minGas = 10_000_000n;
        const maxGas = 2_000_000_000n;
        const finalGas = gasWithBuffer < minGas ? minGas : gasWithBuffer > maxGas ? maxGas : gasWithBuffer;

        console.log(`Admin tx gas estimate: computation=${computationCost}, storage=${storageCost}, rebate=${storageRebate}, budget=${gasBudget}, finalBudget=${finalGas}`);

        // Set the estimated gas budget
        tx.setGasBudget(Number(finalGas));

        setTxStatus({ type: "pending", message: "Confirm in wallet..." });

        signAndExecute(
          { transaction: tx },
          {
            onSuccess: (result) => {
              setTxStatus({
                type: "success",
                message: `${successMsg} TX: ${result.digest.slice(0, 10)}...`,
              });
              setTimeout(refetchPool, 2000);
              setTimeout(() => setTxStatus({ type: null, message: "" }), 5000);
            },
            onError: (error) => {
              setTxStatus({ type: "error", message: `Failed: ${error.message}` });
              setTimeout(() => setTxStatus({ type: null, message: "" }), 8000);
            },
          }
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("Admin tx error:", error);
        setTxStatus({ type: "error", message: `Error: ${msg.slice(0, 100)}` });
        setTimeout(() => setTxStatus({ type: null, message: "" }), 8000);
      }
    },
    [account, client, signAndExecute, refetchPool]
  );

  // Don't show if not connected
  if (!account) {
    return null;
  }

  // Show loading
  if (capsLoading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-semibold mb-4">Admin Panel</h2>
        <p className="text-gray-400">Checking permissions...</p>
      </div>
    );
  }

  // Don't show if no admin access
  if (!hasOwnerCap && !hasOperatorCap) {
    return null;
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Admin Panel</h2>
          <div className="flex gap-2">
            {hasOwnerCap && (
              <span className="px-3 py-1 bg-purple-900/50 text-purple-400 rounded-full text-sm">
                Owner
              </span>
            )}
            {hasOperatorCap && (
              <span className="px-3 py-1 bg-blue-900/50 text-blue-400 rounded-full text-sm">
                Operator
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Protocol Validators Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-200">Protocol Validators</h3>
              <p className="text-sm text-gray-500 mt-1">
                Validators registered in the protocol with their stake and priority
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total Staked</p>
              <p className="text-lg font-semibold text-blue-400">{formatIota(totalProtocolStake)} IOTA</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={validatorSearch}
                onChange={(e) => setValidatorSearch(e.target.value)}
                placeholder="Search by name or address..."
                className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {validatorSearch && (
                <button
                  onClick={() => setValidatorSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {validatorSearch.trim() && (
              <span className="text-xs text-gray-500">
                {filteredProtocolStakes.length} of {protocolStakes.length}
              </span>
            )}
          </div>

          {filteredProtocolStakes.length === 0 ? (
            <div className="p-4 bg-gray-800/30 rounded-lg text-center text-gray-500 text-sm">
              {validatorSearch.trim() ? "No validators match your search" : "No validators registered"}
            </div>
          ) : (
            <div className="bg-gray-800/30 rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800/50 text-xs text-gray-500 font-medium uppercase tracking-wider">
                <div className="col-span-3">Validator</div>
                <div className="col-span-2">Address</div>
                <div className="col-span-2 text-right">Voting Power</div>
                <div className="col-span-2 text-right">Staked</div>
                <div className="col-span-1 text-center">P</div>
                <div className="col-span-2 text-center">Status</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-800/50 max-h-64 overflow-y-auto">
                {filteredProtocolStakes.map((stake) => {
                  const isBanned = stake.priority === 0;
                  const isHighPriority = stake.priority >= 100;

                  return (
                    <div
                      key={stake.address}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                        isBanned ? "bg-red-900/10" : ""
                      }`}
                    >
                      {/* Validator */}
                      <div className="col-span-3 flex items-center gap-2 min-w-0">
                        <ValidatorAvatar
                          imageUrl={getValidatorImage(stake.address)}
                          name={getValidatorName(stake.address)}
                        />
                        <span className="text-sm text-gray-200 truncate">
                          {getValidatorName(stake.address)}
                        </span>
                      </div>

                      {/* Address */}
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="text-xs text-gray-500 mono">
                          {stake.address.slice(0, 6)}...{stake.address.slice(-4)}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(stake.address);
                            setTxStatus({ type: "success", message: "Address copied!" });
                            setTimeout(() => setTxStatus({ type: null, message: "" }), 2000);
                          }}
                          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                          title="Copy address"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>

                      {/* Voting Power */}
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-medium text-blue-400 mono">
                          {(stake.votingPower / 100).toFixed(2)}%
                        </span>
                      </div>

                      {/* Staked */}
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-medium text-gray-300 mono">
                          {formatIota(stake.totalStaked)}
                        </span>
                      </div>

                      {/* Priority */}
                      <div className="col-span-1 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${
                            isBanned
                              ? "bg-red-900/50 text-red-400"
                              : isHighPriority
                              ? "bg-green-900/50 text-green-400"
                              : "bg-gray-700 text-gray-300"
                          }`}
                        >
                          {stake.priority}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-2 text-center">
                        {isBanned ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-900/30 text-red-400">
                            Banned
                          </span>
                        ) : stake.totalStaked > 0n ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-900/30 text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">
                            No stake
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Stake History & Vaults Panel */}
        <StakeHistoryPanel />

        <div className="border-t border-gray-800" />

        {/* Owner Functions */}
        {hasOwnerCap && ownerCapId && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-purple-400">Owner Settings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Administrative controls for pool configuration
              </p>
            </div>

            {/* Min Stake */}
            <div className="p-4 bg-gray-800/30 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Minimum Stake
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  The minimum amount of IOTA that users must stake in a single transaction.
                  Prevents dust attacks and ensures meaningful stake positions.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={minStake}
                    onChange={(e) => setMinStake(e.target.value)}
                    placeholder="1.0"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {poolState ? formatIota(poolState.minStake) : "..."} IOTA
                  </p>
                </div>
                <button
                  onClick={() => {
                    const parsed = safeParseIota(minStake);
                    if (!parsed) {
                      setTxStatus({ type: "error", message: "Invalid amount. Use format: 1.5" });
                      return;
                    }
                    const tx = buildChangeMinStakeTx(parsed, ownerCapId);
                    executeTx(tx, "Min stake updated!");
                  }}
                  disabled={isPending || !minStake}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors h-fit"
                >
                  Update
                </button>
              </div>
            </div>

            {/* Max Stake Per Validator Per Epoch */}
            <div className="p-4 bg-gray-800/30 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Max Stake Per Validator Per Epoch
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum amount of IOTA that can be staked to a single validator in one epoch.
                  This limit helps distribute stake across validators and prevents concentration.
                  Only applies to the internal stake_pool() distribution, not user-chosen validators.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={maxStakePerEpoch}
                    onChange={(e) => setMaxStakePerEpoch(e.target.value)}
                    placeholder="50000000"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {poolState ? formatIota(poolState.maxValidatorStakePerEpoch) : "..."} IOTA
                    {poolState && poolState.maxValidatorStakePerEpoch > 0n && (
                      <span className="text-gray-600 ml-1">
                        ({(Number(poolState.maxValidatorStakePerEpoch) / 1e9 / 1e6).toFixed(0)}M)
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const parsed = safeParseIota(maxStakePerEpoch);
                    if (!parsed) {
                      setTxStatus({ type: "error", message: "Invalid amount. Use format: 50000000" });
                      return;
                    }
                    const tx = buildChangeMaxStakePerEpochTx(parsed, ownerCapId);
                    executeTx(tx, "Max stake per epoch updated!");
                  }}
                  disabled={isPending || !maxStakePerEpoch}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors h-fit"
                >
                  Update
                </button>
              </div>
            </div>

            {/* Collect Fees */}
            <div className="p-4 bg-gray-800/30 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Collect Protocol Fees
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Withdraw accumulated protocol fees to a specified wallet address.
                  Fees accumulate from the protocol fee charged on staking rewards.
                </p>
                {poolState && (
                  <p className="text-sm text-purple-400 mt-2">
                    Available to collect: {formatIota(poolState.collectableFee)} IOTA
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={feeRecipient}
                  onChange={(e) => setFeeRecipient(e.target.value)}
                  placeholder="Recipient address (0x...)"
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => {
                    if (!isValidIotaAddress(feeRecipient)) {
                      setTxStatus({ type: "error", message: "Invalid IOTA address format (0x + 64 hex chars)" });
                      return;
                    }
                    const tx = buildCollectFeeTx(feeRecipient, ownerCapId);
                    executeTx(tx, "Fees collected!");
                  }}
                  disabled={isPending || !feeRecipient || (poolState?.collectableFee ?? 0n) <= 0n}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                  title={(poolState?.collectableFee ?? 0n) <= 0n ? "No fees available to collect" : ""}
                >
                  Collect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        {hasOwnerCap && hasOperatorCap && (
          <div className="border-t border-gray-800" />
        )}

        {/* Operator Functions */}
        {hasOperatorCap && operatorCapId && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-blue-400">Operator Settings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Day-to-day operations: validator management and rewards reporting
              </p>
            </div>

            {/* Update Validators */}
            <div className="p-4 bg-gray-800/30 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Manage Validators
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Add or update validators in the pool. Priority determines stake distribution order:
                  higher priority validators receive stakes first. Set priority to 0 to ban a validator
                  (their stake will be moved during rebalancing).
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={newValidatorAddress}
                  onChange={(e) => setNewValidatorAddress(e.target.value)}
                  placeholder="Validator address (0x...)"
                  className="md:col-span-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                />
                <div>
                  <input
                    type="number"
                    value={newValidatorPriority}
                    onChange={(e) => setNewValidatorPriority(e.target.value)}
                    placeholder="Priority"
                    min="0"
                    max="255"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!isValidIotaAddress(newValidatorAddress)) {
                      setTxStatus({ type: "error", message: "Invalid validator address format (0x + 64 hex chars)" });
                      return;
                    }
                    const priority = safeParseInt(newValidatorPriority, 0, 255);
                    if (priority === null) {
                      setTxStatus({ type: "error", message: "Priority must be a number between 0 and 255" });
                      return;
                    }
                    const tx = buildUpdateValidatorsTx(
                      [newValidatorAddress],
                      [priority],
                      operatorCapId
                    );
                    executeTx(tx, "Validator updated!");
                    setNewValidatorAddress("");
                  }}
                  disabled={isPending || !newValidatorAddress}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                >
                  Update
                </button>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Priority guide: 100 = high priority, 50 = normal, 0 = banned</p>
              </div>
            </div>

            {/* Update Rewards */}
            <div className="p-4 bg-gray-800/30 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Report Total Rewards
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Update the total rewards earned by the pool from validators. This value is used
                  to calculate the tIOTA/IOTA exchange rate. Must be higher than previous value
                  and within the threshold limit. Can only be updated once every 12 hours.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={rewardsValue}
                    onChange={(e) => setRewardsValue(e.target.value)}
                    placeholder="New total rewards in IOTA"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-xs text-gray-500 mt-1 space-y-1">
                    <p>Current: {poolState ? formatIota(poolState.totalRewards) : "..."} IOTA</p>
                    {poolState && poolState.rewardsUpdateTs > 0 && (
                      <p>Last update: {formatRelativeTime(poolState.rewardsUpdateTs)}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const parsed = safeParseIota(rewardsValue);
                    if (!parsed) {
                      setTxStatus({ type: "error", message: "Invalid rewards amount. Use format: 1.5" });
                      return;
                    }
                    const tx = buildUpdateRewardsTx(parsed, operatorCapId);
                    executeTx(tx, "Rewards updated!");
                  }}
                  disabled={isPending || !rewardsValue}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors h-fit"
                >
                  Update
                </button>
              </div>
            </div>

            {/* Rebalance */}
            <div className="p-4 bg-gray-800/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-200">Rebalance Stakes</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">
                    Move staked IOTA from banned validators (priority = 0) to active validators.
                    This should be executed after banning a validator to ensure stakes are
                    properly redistributed according to current priorities.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const tx = buildRebalanceTx();
                    executeTx(tx, "Rebalance completed!");
                  }}
                  disabled={isPending}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                >
                  Rebalance
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone - Ownership Transfer */}
        {(hasOwnerCap || hasOperatorCap) && (
          <>
            <div className="border-t border-gray-800" />

            <div className="space-y-4">
              <button
                onClick={() => setShowDangerZone(!showDangerZone)}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showDangerZone ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">Danger Zone - Critical Settings</span>
              </button>

              {showDangerZone && (
                <div className="space-y-6 p-4 bg-red-900/10 border border-red-900/50 rounded-lg">
                  <div className="flex items-start gap-3 p-3 bg-red-900/20 rounded-lg">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm text-red-300">
                      <p className="font-medium">Warning: Critical settings that affect the protocol!</p>
                      <p className="mt-1 text-red-400/80">
                        Changes here can significantly impact users and protocol operation.
                        Double-check all values before confirming.
                      </p>
                    </div>
                  </div>

                  {/* Emergency Pause */}
                  {hasOwnerCap && ownerCapId && (
                    <div className="p-4 bg-gray-800/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-red-300">Emergency Pause</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Halts all staking and unstaking operations. Use in case of security
                            incidents or critical bugs. Users cannot interact with the pool while paused.
                          </p>
                          <p className={`text-sm mt-2 ${poolState?.paused ? "text-red-400" : "text-green-400"}`}>
                            Status: {poolState?.paused ? "PAUSED" : "ACTIVE"}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const action = poolState?.paused ? "unpause" : "pause";
                            if (confirm(`Are you sure you want to ${action} the pool?`)) {
                              const tx = buildSetPauseTx(!poolState?.paused, ownerCapId);
                              executeTx(tx, poolState?.paused ? "Pool unpaused!" : "Pool paused!");
                            }
                          }}
                          disabled={isPending}
                          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                            poolState?.paused
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-red-600 hover:bg-red-700 text-white"
                          }`}
                        >
                          {poolState?.paused ? "Unpause" : "Pause"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Protocol Fee */}
                  {hasOwnerCap && ownerCapId && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-red-300">
                          Protocol Fee
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Percentage fee charged on staking rewards. This fee is deducted from rewards
                          before they are distributed to tIOTA holders. Revenue goes to the protocol treasury.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="relative">
                            <input
                              type="text"
                              value={rewardFee}
                              onChange={(e) => setRewardFee(e.target.value)}
                              placeholder="5.00"
                              className="w-full px-4 py-2 bg-gray-800 border border-red-900/50 rounded-lg text-gray-100 focus:outline-none focus:border-red-500 pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Current: {poolState ? formatPercent(poolState.baseRewardFee) : "..."} (Default: 5%)
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const percent = safeParsePercent(rewardFee);
                            if (percent === null) {
                              setTxStatus({ type: "error", message: "Invalid percentage. Enter a value between 0 and 100" });
                              return;
                            }
                            const basisPoints = Math.round(percent * 100);
                            if (confirm(`Are you sure you want to change the protocol fee to ${percent}%?`)) {
                              const tx = buildChangeRewardFeeTx(basisPoints, ownerCapId);
                              executeTx(tx, "Protocol fee updated!");
                            }
                          }}
                          disabled={isPending || !rewardFee}
                          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors h-fit"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rewards Threshold */}
                  {hasOwnerCap && ownerCapId && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-red-300">
                          Rewards Update Threshold
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Maximum percentage increase allowed when the operator updates rewards.
                          This is a security measure to prevent malicious operators from inflating
                          rewards artificially. The new rewards value must be within this % of the previous value.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="relative">
                            <input
                              type="text"
                              value={threshold}
                              onChange={(e) => setThreshold(e.target.value)}
                              placeholder="1.00"
                              className="w-full px-4 py-2 bg-gray-800 border border-red-900/50 rounded-lg text-gray-100 focus:outline-none focus:border-red-500 pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Current: {poolState ? formatPercent(poolState.rewardsThreshold) : "..."} (Default: 1%)
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const percent = safeParsePercent(threshold);
                            if (percent === null) {
                              setTxStatus({ type: "error", message: "Invalid percentage. Enter a value between 0 and 100" });
                              return;
                            }
                            const basisPoints = Math.round(percent * 100);
                            if (confirm(`Are you sure you want to change the rewards threshold to ${percent}%?`)) {
                              const tx = buildUpdateThresholdTx(basisPoints, ownerCapId);
                              executeTx(tx, "Threshold updated!");
                            }
                          }}
                          disabled={isPending || !threshold}
                          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors h-fit"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-red-900/30 pt-6">
                    <p className="text-sm font-medium text-red-400 mb-4">Ownership Transfer (Irreversible)</p>
                  </div>

                  {/* Transfer Owner */}
                  {hasOwnerCap && ownerCapId && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-red-300">
                          Transfer Owner Cap
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Transfer full administrative control to a new address. The new owner will be able
                          to change fees, pause the pool, collect fees, and transfer ownership again.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newOwnerAddress}
                          onChange={(e) => setNewOwnerAddress(e.target.value)}
                          placeholder="New owner address (0x...)"
                          className="flex-1 px-4 py-2 bg-gray-800 border border-red-900/50 rounded-lg text-gray-100 focus:outline-none focus:border-red-500"
                        />
                        <button
                          onClick={() => {
                            if (!isValidIotaAddress(newOwnerAddress)) {
                              setTxStatus({ type: "error", message: "Invalid IOTA address format (0x + 64 hex chars)" });
                              return;
                            }
                            if (confirm(`Are you sure you want to transfer Owner Cap to ${newOwnerAddress}? This action is IRREVERSIBLE.`)) {
                              const tx = buildTransferOwnerCapTx(newOwnerAddress, ownerCapId);
                              executeTx(tx, "Owner Cap transferred!");
                              setNewOwnerAddress("");
                            }
                          }}
                          disabled={isPending || !newOwnerAddress}
                          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                        >
                          Transfer Owner
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transfer Operator */}
                  {hasOperatorCap && operatorCapId && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-red-300">
                          Transfer Operator Cap
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Transfer operational control to a new address. The new operator will be able
                          to manage validators, update rewards, and perform rebalancing.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newOperatorAddress}
                          onChange={(e) => setNewOperatorAddress(e.target.value)}
                          placeholder="New operator address (0x...)"
                          className="flex-1 px-4 py-2 bg-gray-800 border border-red-900/50 rounded-lg text-gray-100 focus:outline-none focus:border-red-500"
                        />
                        <button
                          onClick={() => {
                            if (!isValidIotaAddress(newOperatorAddress)) {
                              setTxStatus({ type: "error", message: "Invalid IOTA address format (0x + 64 hex chars)" });
                              return;
                            }
                            if (confirm(`Are you sure you want to transfer Operator Cap to ${newOperatorAddress}? This action is IRREVERSIBLE.`)) {
                              const tx = buildTransferOperatorCapTx(newOperatorAddress, operatorCapId);
                              executeTx(tx, "Operator Cap transferred!");
                              setNewOperatorAddress("");
                            }
                          }}
                          disabled={isPending || !newOperatorAddress}
                          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                        >
                          Transfer Operator
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Transaction Status */}
        {txStatus.type && (
          <div
            className={`p-4 rounded-lg ${
              txStatus.type === "success"
                ? "bg-green-900/20 border border-green-800 text-green-400"
                : txStatus.type === "error"
                ? "bg-red-900/20 border border-red-800 text-red-400"
                : "bg-blue-900/20 border border-blue-800 text-blue-400"
            }`}
          >
            {txStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
