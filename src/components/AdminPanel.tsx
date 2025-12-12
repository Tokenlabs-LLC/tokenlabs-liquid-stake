"use client";

import { useState, useMemo } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@iota/dapp-kit";
import { useAdminCaps } from "@/hooks/useAdmin";
import { usePoolData } from "@/hooks/usePoolData";

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
  buildUpdateValidatorsTx,
  buildUpdateRewardsTx,
  buildRebalanceTx,
  buildTransferOwnerCapTx,
  buildTransferOperatorCapTx,
} from "@/lib/transactions";
import { formatIota, parseIota, formatPercent, formatRelativeTime, truncateAddress } from "@/lib/utils";
import { useProtocolStakes } from "@/hooks/useProtocolStakes";
import { useValidators } from "@/hooks/useValidators";

export function AdminPanel() {
  const account = useCurrentAccount();
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

  // Create validator name map
  const getValidatorName = (address: string) => {
    const validator = systemValidators.find(
      (v) => v.address.toLowerCase() === address.toLowerCase()
    );
    return validator?.name || truncateAddress(address, 6);
  };

  const getValidatorImage = (address: string) => {
    const validator = systemValidators.find(
      (v) => v.address.toLowerCase() === address.toLowerCase()
    );
    return validator?.imageUrl;
  };

  // Owner form state
  const [minStake, setMinStake] = useState("");
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

  // Status
  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error" | "pending" | null;
    message: string;
  }>({ type: null, message: "" });

  const executeTx = (
    tx: ReturnType<typeof buildChangeMinStakeTx>,
    successMsg: string
  ) => {
    setTxStatus({ type: "pending", message: "Processing..." });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          setTxStatus({
            type: "success",
            message: `${successMsg} TX: ${result.digest.slice(0, 10)}...`,
          });
          setTimeout(refetchPool, 2000);
        },
        onError: (error) => {
          setTxStatus({ type: "error", message: `Failed: ${error.message}` });
        },
      }
    );
  };

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
          <div className="flex items-center justify-between">
            <div>
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

          {protocolStakes.length === 0 ? (
            <div className="p-4 bg-gray-800/30 rounded-lg text-center text-gray-500 text-sm">
              No validators registered
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
                {protocolStakes.map((stake) => {
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
                    const tx = buildChangeMinStakeTx(parseIota(minStake), ownerCapId);
                    executeTx(tx, "Min stake updated!");
                  }}
                  disabled={isPending || !minStake}
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
                    const tx = buildCollectFeeTx(feeRecipient, ownerCapId);
                    executeTx(tx, "Fees collected!");
                  }}
                  disabled={isPending || !feeRecipient}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
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
                    const tx = buildUpdateValidatorsTx(
                      [newValidatorAddress],
                      [parseInt(newValidatorPriority)],
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
                    const tx = buildUpdateRewardsTx(parseIota(rewardsValue), operatorCapId);
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
                            const basisPoints = Math.round(parseFloat(rewardFee) * 100);
                            if (confirm(`Are you sure you want to change the protocol fee to ${rewardFee}%?`)) {
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
                            const basisPoints = Math.round(parseFloat(threshold) * 100);
                            if (confirm(`Are you sure you want to change the rewards threshold to ${threshold}%?`)) {
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
