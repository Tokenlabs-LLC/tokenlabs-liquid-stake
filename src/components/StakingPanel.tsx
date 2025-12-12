"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useIotaClient } from "@iota/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useUserBalances } from "@/hooks/useUserBalances";
import { usePoolData } from "@/hooks/usePoolData";
import { ValidatorSelect } from "./ValidatorSelect";
import { buildStakeToValidatorsTx, buildUnstakeTx } from "@/lib/transactions";
import { formatIota, parseIota, calculateShares, calculateIota } from "@/lib/utils";
import { DEFAULT_VALIDATORS, ONE_IOTA, IOTA_LOGO, TIOTA_LOGO } from "@/lib/constants";

type Tab = "stake" | "unstake";

/** Transaction timeout in milliseconds (60 seconds) */
const TX_TIMEOUT = 60_000;

/** Maximum number of coins to use per unstake transaction */
const MAX_COINS_PER_TX = 50;

/**
 * Validate and sanitize numeric input for IOTA amounts
 * Only allows digits and at most one decimal point with max 9 decimal places
 */
function sanitizeAmountInput(value: string): string {
  if (value === "") return "";

  // Remove any characters that aren't digits or decimal point
  let sanitized = value.replace(/[^\d.]/g, "");

  // Handle multiple decimal points - keep only the first one
  const parts = sanitized.split(".");
  if (parts.length > 2) {
    sanitized = parts[0] + "." + parts.slice(1).join("");
  }

  // Limit decimal places to 9 (IOTA decimals)
  if (parts.length === 2 && parts[1].length > 9) {
    sanitized = parts[0] + "." + parts[1].slice(0, 9);
  }

  // Prevent leading zeros (except for "0" or "0.xxx")
  if (sanitized.length > 1 && sanitized.startsWith("0") && sanitized[1] !== ".") {
    sanitized = sanitized.replace(/^0+/, "") || "0";
  }

  return sanitized;
}

/**
 * Select optimal coins for a given amount
 * Returns coins sorted by balance (largest first) up to MAX_COINS_PER_TX
 */
function selectCoinsForAmount(
  coins: { objectId: string; balance: bigint }[],
  amount: bigint
): string[] {
  if (coins.length === 0) return [];

  // Sort by balance descending (use largest coins first for efficiency)
  const sorted = [...coins].sort((a, b) =>
    a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0
  );

  const selected: string[] = [];
  let accumulated = 0n;

  for (const coin of sorted) {
    if (accumulated >= amount) break;
    if (selected.length >= MAX_COINS_PER_TX) break;

    selected.push(coin.objectId);
    accumulated += coin.balance;
  }

  return selected;
}


export function StakingPanel() {
  const account = useCurrentAccount();
  const client = useIotaClient();
  const queryClient = useQueryClient();
  const { totalIota, totalTiota, tiotaCoins, refetch: refetchBalances } = useUserBalances();
  const { poolState, ratio, refetch: refetchPool } = usePoolData();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  // Refs for timeout management
  const txTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Refetch all data including protocol stakes
  const refetchAll = useCallback(() => {
    refetchBalances();
    refetchPool();
    queryClient.invalidateQueries({ queryKey: ["protocolStakes"] });
  }, [refetchBalances, refetchPool, queryClient]);

  const [activeTab, setActiveTab] = useState<Tab>("stake");
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [validatorMode, setValidatorMode] = useState<"auto" | "manual">("auto");
  const [selectedValidators, setSelectedValidators] = useState<string[]>(
    DEFAULT_VALIDATORS.map((v) => v.address)
  );
  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error" | "pending" | null;
    message: string;
    txDigest?: string;
  }>({ type: null, message: "" });

  const EXPLORER_URL = "https://iotascan.com/testnet/tx";

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (txTimeoutRef.current) {
        clearTimeout(txTimeoutRef.current);
      }
    };
  }, []);

  // Auto-dismiss success messages after 10 seconds
  useEffect(() => {
    if (txStatus.type === "success") {
      const timeout = setTimeout(() => {
        setTxStatus({ type: null, message: "" });
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [txStatus.type]);

  useEffect(() => {
    if (validatorMode === "auto") {
      setSelectedValidators(DEFAULT_VALIDATORS.map((v) => v.address));
    }
  }, [validatorMode]);

  const stakeAmountBigInt = stakeAmount ? parseIota(stakeAmount) : 0n;
  const unstakeAmountBigInt = unstakeAmount ? parseIota(unstakeAmount) : 0n;

  const estimatedTiota = stakeAmountBigInt > 0n ? calculateShares(stakeAmountBigInt, ratio) : 0n;
  const estimatedIota = unstakeAmountBigInt > 0n ? calculateIota(unstakeAmountBigInt, ratio) : 0n;

  const numValidators = validatorMode === "auto" ? DEFAULT_VALIDATORS.length : selectedValidators.length;
  const minStakePerValidator = poolState?.minStake || ONE_IOTA;
  const effectiveMinStake = minStakePerValidator * BigInt(Math.max(numValidators, 1));

  const validatorsValid = validatorMode === "auto" || selectedValidators.length > 0;
  const isStakeValid = stakeAmountBigInt >= effectiveMinStake && stakeAmountBigInt <= totalIota && validatorsValid;
  const isUnstakeValid = unstakeAmountBigInt > 0n && unstakeAmountBigInt <= totalTiota;

  // Clear transaction timeout
  const clearTxTimeout = useCallback(() => {
    if (txTimeoutRef.current) {
      clearTimeout(txTimeoutRef.current);
      txTimeoutRef.current = null;
    }
  }, []);

  // Set transaction timeout
  const setTxTimeout = useCallback(() => {
    clearTxTimeout();
    txTimeoutRef.current = setTimeout(() => {
      if (isProcessingRef.current) {
        setTxStatus({
          type: "error",
          message: "Transaction timed out. Please check your wallet or try again.",
        });
        isProcessingRef.current = false;
      }
    }, TX_TIMEOUT);
  }, [clearTxTimeout]);

  const handleStake = async () => {
    if (!isStakeValid || !account || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setTxStatus({ type: "pending", message: "Estimating gas..." });
    setTxTimeout();

    try {
      const validators = validatorMode === "auto" ? DEFAULT_VALIDATORS.map((v) => v.address) : selectedValidators;

      // Build transaction with high gas budget for devInspect estimation
      // We use a high budget so devInspect doesn't fail, then read actual gas used
      const txForEstimate = buildStakeToValidatorsTx(validators, stakeAmountBigInt, 1_000_000_000); // 1 IOTA max for estimation
      txForEstimate.setSender(account.address);

      // Use devInspectTransactionBlock - this doesn't require actual funds
      // and gives us the gas estimation
      const inspectResult = await client.devInspectTransactionBlock({
        transactionBlock: txForEstimate,
        sender: account.address,
      });

      if (inspectResult.effects.status.status !== "success") {
        clearTxTimeout();
        isProcessingRef.current = false;
        const errorMsg = inspectResult.effects.status.error || "Transaction simulation failed";
        console.error("DevInspect failed:", errorMsg);
        setTxStatus({ type: "error", message: `Simulation failed: ${errorMsg.slice(0, 80)}` });
        return;
      }

      // Calculate gas with buffer
      const gasUsed = inspectResult.effects.gasUsed;
      const computationCost = BigInt(gasUsed.computationCost);
      const storageCost = BigInt(gasUsed.storageCost);
      const storageRebate = BigInt(gasUsed.storageRebate);
      // gasBudget needs to cover computation + storage (rebate comes back after)
      const gasBudget = computationCost + storageCost;
      // Net cost to user is after rebate
      const netGasCost = gasBudget > storageRebate ? gasBudget - storageRebate : 0n;
      // Add 10% buffer for safety (devInspect is already conservative)
      const gasWithBuffer = BigInt(Math.ceil(Number(gasBudget) * 1.1));
      // Minimum 0.01 IOTA, maximum 5 IOTA for budget
      const minGas = 10_000_000n;
      const maxGas = 5_000_000_000n;
      const finalGas = gasWithBuffer < minGas ? minGas : gasWithBuffer > maxGas ? maxGas : gasWithBuffer;

      console.log(`Gas estimate: computation=${computationCost}, storage=${storageCost}, rebate=${storageRebate}, budget=${gasBudget}, netCost=${netGasCost}, finalBudget=${finalGas}`);

      // Check if user has enough balance (stake amount + net gas cost + small buffer)
      const gasReserve = netGasCost + 10_000_000n; // net cost + 0.01 IOTA buffer
      if (totalIota < stakeAmountBigInt + gasReserve) {
        clearTxTimeout();
        isProcessingRef.current = false;
        const maxStakeable = totalIota > gasReserve ? totalIota - gasReserve : 0n;
        setTxStatus({
          type: "error",
          message: `Insufficient balance. Max stakeable: ~${formatIota(maxStakeable)} IOTA`,
        });
        return;
      }

      // Build final transaction with estimated gas
      const tx = buildStakeToValidatorsTx(validators, stakeAmountBigInt, Number(finalGas));

      setTxStatus({ type: "pending", message: "Confirm in wallet..." });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            clearTxTimeout();
            isProcessingRef.current = false;
            setTxStatus({
              type: "success",
              message: "Staked successfully!",
              txDigest: result.digest,
            });
            setStakeAmount("");
            refetchAll();
            setTimeout(() => {
              refetchAll();
            }, 2000);
          },
          onError: (error) => {
            clearTxTimeout();
            isProcessingRef.current = false;
            const errorMsg = error.message || "";
            if (errorMsg.includes("E_NO_VALIDATORS") || errorMsg.includes("300")) {
              setTxStatus({ type: "error", message: "No validators configured." });
            } else if (errorMsg.includes("E_MIN_LIMIT") || errorMsg.includes("100")) {
              setTxStatus({ type: "error", message: `Min: ${formatIota(effectiveMinStake)} IOTA` });
            } else if (errorMsg.includes("E_PAUSED") || errorMsg.includes("101")) {
              setTxStatus({ type: "error", message: "Pool is paused." });
            } else if (errorMsg.includes("rejected") || errorMsg.includes("cancelled")) {
              setTxStatus({ type: "error", message: "Transaction cancelled." });
            } else if (errorMsg.includes("InsufficientGas")) {
              setTxStatus({ type: "error", message: "Insufficient gas. Try with fewer validators." });
            } else {
              // Sanitize error message - remove potential sensitive data
              const safeMsg = errorMsg.replace(/0x[a-fA-F0-9]+/g, "[address]").slice(0, 100);
              setTxStatus({ type: "error", message: `Failed: ${safeMsg}` });
            }
          },
        }
      );
    } catch (error) {
      clearTxTimeout();
      isProcessingRef.current = false;
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Stake error:", error);
      setTxStatus({ type: "error", message: `Error: ${msg.slice(0, 100)}` });
    }
  };

  const handleUnstake = async () => {
    if (!isUnstakeValid || !account || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setTxStatus({ type: "pending", message: "Estimating gas..." });
    setTxTimeout();

    try {
      // Prepare coins with balance info for optimal selection
      const coinsWithBalance = tiotaCoins.map((c) => ({
        objectId: c.objectId,
        balance: BigInt(c.balance),
      }));

      // Select optimal coins for the amount
      const selectedCoinIds = selectCoinsForAmount(coinsWithBalance, unstakeAmountBigInt);

      if (selectedCoinIds.length === 0) {
        clearTxTimeout();
        isProcessingRef.current = false;
        setTxStatus({ type: "error", message: "No tIOTA available." });
        return;
      }

      // Check if we have enough coins
      const selectedTotal = coinsWithBalance
        .filter((c) => selectedCoinIds.includes(c.objectId))
        .reduce((sum, c) => sum + c.balance, 0n);

      if (selectedTotal < unstakeAmountBigInt) {
        clearTxTimeout();
        isProcessingRef.current = false;
        setTxStatus({ type: "error", message: "Insufficient tIOTA balance." });
        return;
      }

      // Build transaction with high gas budget for devInspect estimation
      const txForEstimate = buildUnstakeTx(selectedCoinIds, unstakeAmountBigInt, 500_000_000); // 0.5 IOTA max for estimation
      txForEstimate.setSender(account.address);

      // Use devInspectTransactionBlock for gas estimation
      const inspectResult = await client.devInspectTransactionBlock({
        transactionBlock: txForEstimate,
        sender: account.address,
      });

      if (inspectResult.effects.status.status !== "success") {
        clearTxTimeout();
        isProcessingRef.current = false;
        const errorMsg = inspectResult.effects.status.error || "Transaction simulation failed";
        // Check for epoch-related errors
        if (errorMsg.includes("EpochNotYetEnded") || errorMsg.includes("staking_pool") || errorMsg.includes("dynamic_field")) {
          setTxStatus({ type: "error", message: "Wait for next epoch to unstake." });
        } else {
          setTxStatus({ type: "error", message: `Simulation failed: ${errorMsg.slice(0, 80)}` });
        }
        return;
      }

      // Calculate gas with buffer
      const gasUsed = inspectResult.effects.gasUsed;
      const computationCost = BigInt(gasUsed.computationCost);
      const storageCost = BigInt(gasUsed.storageCost);
      const storageRebate = BigInt(gasUsed.storageRebate);
      // gasBudget needs to cover computation + storage (rebate comes back after)
      const gasBudget = computationCost + storageCost;
      // Add 10% buffer for safety
      const gasWithBuffer = BigInt(Math.ceil(Number(gasBudget) * 1.1));
      // Minimum 0.01 IOTA, maximum 2 IOTA
      const minGas = 10_000_000n;
      const maxGas = 2_000_000_000n;
      const finalGas = gasWithBuffer < minGas ? minGas : gasWithBuffer > maxGas ? maxGas : gasWithBuffer;

      console.log(`Unstake gas estimate: computation=${computationCost}, storage=${storageCost}, rebate=${storageRebate}, budget=${gasBudget}, finalBudget=${finalGas}`);

      // Build final transaction with estimated gas
      const tx = buildUnstakeTx(selectedCoinIds, unstakeAmountBigInt, Number(finalGas));

      setTxStatus({ type: "pending", message: "Confirm in wallet..." });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            clearTxTimeout();
            isProcessingRef.current = false;
            setTxStatus({
              type: "success",
              message: "Unstaked successfully!",
              txDigest: result.digest,
            });
            setUnstakeAmount("");
            refetchAll();
            setTimeout(() => {
              refetchAll();
            }, 2000);
          },
          onError: (error) => {
            clearTxTimeout();
            isProcessingRef.current = false;
            const errorMsg = error.message || "";
            if (
              errorMsg.includes("EpochNotYetEnded") ||
              errorMsg.includes("staking_pool") ||
              errorMsg.includes("dynamic_field") ||
              errorMsg.includes("E_NOTHING_TO_UNSTAKE")
            ) {
              setTxStatus({
                type: "error",
                message: "Wait for next epoch to unstake.",
              });
            } else if (errorMsg.includes("rejected") || errorMsg.includes("cancelled")) {
              setTxStatus({ type: "error", message: "Transaction cancelled." });
            } else {
              const safeMsg = errorMsg.replace(/0x[a-fA-F0-9]+/g, "[address]").slice(0, 100);
              setTxStatus({ type: "error", message: `Failed: ${safeMsg}` });
            }
          },
        }
      );
    } catch (error) {
      clearTxTimeout();
      isProcessingRef.current = false;
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Unstake error:", error);
      setTxStatus({ type: "error", message: `Error: ${msg.slice(0, 100)}` });
    }
  };

  const setMaxStake = () => {
    if (totalIota > 0n) {
      const maxAmount = totalIota > ONE_IOTA ? totalIota - ONE_IOTA / 10n : totalIota;
      setStakeAmount(formatIota(maxAmount));
    }
  };

  const setMaxUnstake = () => {
    if (totalTiota > 0n) {
      setUnstakeAmount(formatIota(totalTiota));
    }
  };

  // Handle keyboard navigation for tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, tab: Tab) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveTab(tab);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setActiveTab(tab === "stake" ? "unstake" : "stake");
    }
  };

  if (!account) {
    return (
      <div className="glass-card p-6 text-center h-full flex flex-col justify-center" role="region" aria-label="Connect wallet prompt">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/10 border border-[var(--border-subtle)] flex items-center justify-center">
          <svg className="w-6 h-6 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">Connect your wallet to start staking</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden h-full flex flex-col" role="region" aria-label="Staking panel">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-subtle)]" role="tablist" aria-label="Staking options">
        <button
          onClick={() => setActiveTab("stake")}
          onKeyDown={(e) => handleTabKeyDown(e, "stake")}
          className={`tab-button ${activeTab === "stake" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "stake"}
          aria-controls="stake-panel"
          id="stake-tab"
          tabIndex={activeTab === "stake" ? 0 : -1}
        >
          Stake
        </button>
        <button
          onClick={() => setActiveTab("unstake")}
          onKeyDown={(e) => handleTabKeyDown(e, "unstake")}
          className={`tab-button ${activeTab === "unstake" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "unstake"}
          aria-controls="unstake-panel"
          id="unstake-tab"
          tabIndex={activeTab === "unstake" ? 0 : -1}
        >
          Unstake
        </button>
      </div>

      <div className="p-5 flex-1 overflow-auto">
        {/* Stake Tab */}
        {activeTab === "stake" && (
          <div id="stake-panel" role="tabpanel" aria-labelledby="stake-tab" className="space-y-4">
            {/* Balance */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-muted)]">Available</span>
              <div className="flex items-center gap-1.5">
                <img src={IOTA_LOGO} alt="" className="w-4 h-4 rounded-full" aria-hidden="true" />
                <span className="mono text-sm text-[var(--text-primary)]">{formatIota(totalIota)} IOTA</span>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label htmlFor="stake-amount" className="sr-only">
                Amount to stake in IOTA
              </label>
              <div className="relative">
                <input
                  id="stake-amount"
                  type="text"
                  inputMode="decimal"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(sanitizeAmountInput(e.target.value))}
                  placeholder="0.00"
                  className="input-glass pr-24 mono"
                  aria-describedby={stakeAmountBigInt > 0n && stakeAmountBigInt < effectiveMinStake ? "stake-min-error" : undefined}
                  aria-invalid={stakeAmountBigInt > 0n && !isStakeValid}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={setMaxStake}
                    className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
                    aria-label="Set maximum stake amount"
                  >
                    MAX
                  </button>
                  <div className="flex items-center gap-1">
                    <img src={IOTA_LOGO} alt="" className="w-4 h-4 rounded-full" aria-hidden="true" />
                    <span className="text-[var(--text-muted)] text-xs font-medium">IOTA</span>
                  </div>
                </div>
              </div>
              {stakeAmountBigInt < effectiveMinStake && (
                <p
                  id="stake-min-error"
                  className={`text-xs mt-1.5 ${stakeAmountBigInt > 0n ? "text-red-400" : "text-[var(--text-muted)]"}`}
                  role={stakeAmountBigInt > 0n ? "alert" : undefined}
                >
                  Min: {formatIota(effectiveMinStake)} IOTA ({numValidators} {numValidators === 1 ? "validator" : "validators"})
                </p>
              )}
            </div>

            {/* Validator Selection */}
            <ValidatorSelect
              selectedValidators={selectedValidators}
              onSelectionChange={setSelectedValidators}
              mode={validatorMode}
              onModeChange={setValidatorMode}
            />

            {/* Estimated Output */}
            {stakeAmountBigInt > 0n && (
              <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--accent-glow)] border border-[var(--border-accent)]" aria-live="polite">
                <span className="text-xs text-[var(--text-secondary)]">You receive</span>
                <div className="flex items-center gap-1.5">
                  <img src={TIOTA_LOGO} alt="" className="w-4 h-4 rounded-full" aria-hidden="true" />
                  <span className="mono font-semibold text-[var(--accent-primary)]">~{formatIota(estimatedTiota)} tIOTA</span>
                </div>
              </div>
            )}

            {/* Stake Button */}
            <button
              onClick={handleStake}
              disabled={!isStakeValid || isPending || isProcessingRef.current}
              className="btn-glow w-full !py-3"
              aria-busy={isPending}
              aria-label={
                !isStakeValid
                  ? stakeAmountBigInt < effectiveMinStake
                    ? `Stake button disabled. Minimum stake is ${formatIota(effectiveMinStake)} IOTA`
                    : stakeAmountBigInt > totalIota
                    ? "Stake button disabled. Insufficient balance"
                    : "Stake button disabled. Enter valid amount"
                  : `Stake ${stakeAmount} IOTA to receive approximately ${formatIota(estimatedTiota)} tIOTA`
              }
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Stake IOTA"
              )}
            </button>
          </div>
        )}

        {/* Unstake Tab */}
        {activeTab === "unstake" && (
          <div id="unstake-panel" role="tabpanel" aria-labelledby="unstake-tab" className="space-y-4">
            {/* Balance */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-muted)]">Balance</span>
              <div className="flex items-center gap-1.5">
                <img src={TIOTA_LOGO} alt="" className="w-4 h-4 rounded-full" aria-hidden="true" />
                <span className="mono text-sm text-[var(--text-primary)]">{formatIota(totalTiota)} tIOTA</span>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label htmlFor="unstake-amount" className="sr-only">
                Amount to unstake in tIOTA
              </label>
              <div className="relative">
                <input
                  id="unstake-amount"
                  type="text"
                  inputMode="decimal"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(sanitizeAmountInput(e.target.value))}
                  placeholder="0.00"
                  className="input-glass pr-24 mono"
                  aria-invalid={unstakeAmountBigInt > 0n && !isUnstakeValid}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={setMaxUnstake}
                    className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
                    aria-label="Set maximum unstake amount"
                  >
                    MAX
                  </button>
                  <div className="flex items-center gap-1">
                    <img src={TIOTA_LOGO} alt="" className="w-4 h-4 rounded-full" aria-hidden="true" />
                    <span className="text-[var(--text-muted)] text-xs font-medium">tIOTA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estimated Output */}
            {unstakeAmountBigInt > 0n && (
              <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--accent-glow)] border border-[var(--border-accent)]" aria-live="polite">
                <span className="text-xs text-[var(--text-secondary)]">You receive</span>
                <div className="flex items-center gap-1.5">
                  <img src={IOTA_LOGO} alt="" className="w-4 h-4 rounded-full" aria-hidden="true" />
                  <span className="mono font-semibold text-[var(--accent-primary)]">~{formatIota(estimatedIota)} IOTA</span>
                </div>
              </div>
            )}

            {/* Unstake Button */}
            <button
              onClick={handleUnstake}
              disabled={!isUnstakeValid || isPending || isProcessingRef.current}
              className="btn-secondary w-full !py-3"
              aria-busy={isPending}
              aria-label={
                !isUnstakeValid
                  ? unstakeAmountBigInt > totalTiota
                    ? "Unstake button disabled. Insufficient balance"
                    : "Unstake button disabled. Enter valid amount"
                  : `Unstake ${unstakeAmount} tIOTA to receive approximately ${formatIota(estimatedIota)} IOTA`
              }
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Unstake tIOTA"
              )}
            </button>
          </div>
        )}

        {/* Transaction Status */}
        {txStatus.type && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`mt-4 p-4 rounded-xl border relative overflow-hidden ${
              txStatus.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : txStatus.type === "error"
                ? "bg-red-500/10 border-red-500/30"
                : "bg-[var(--accent-secondary)]/10 border-[var(--accent-secondary)]/30"
            }`}
          >
            {/* Background glow */}
            <div
              className={`absolute inset-0 opacity-20 ${
                txStatus.type === "success"
                  ? "bg-gradient-to-r from-emerald-500/20 to-transparent"
                  : txStatus.type === "error"
                  ? "bg-gradient-to-r from-red-500/20 to-transparent"
                  : "bg-gradient-to-r from-[var(--accent-secondary)]/20 to-transparent"
              }`}
              aria-hidden="true"
            />

            <div className="relative flex items-start gap-3">
              {/* Icon */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  txStatus.type === "success"
                    ? "bg-emerald-500/20"
                    : txStatus.type === "error"
                    ? "bg-red-500/20"
                    : "bg-[var(--accent-secondary)]/20"
                }`}
                aria-hidden="true"
              >
                {txStatus.type === "success" && (
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {txStatus.type === "error" && (
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {txStatus.type === "pending" && (
                  <svg className="animate-spin w-4 h-4 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium text-sm ${
                    txStatus.type === "success"
                      ? "text-emerald-400"
                      : txStatus.type === "error"
                      ? "text-red-400"
                      : "text-[var(--accent-secondary)]"
                  }`}
                >
                  {txStatus.message}
                </p>
                {txStatus.txDigest && (
                  <a
                    href={`${EXPLORER_URL}/${txStatus.txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                    aria-label={`View transaction ${txStatus.txDigest.slice(0, 8)} in explorer`}
                  >
                    <span className="mono text-xs text-[var(--text-secondary)] group-hover:text-white transition-colors">
                      {txStatus.txDigest.slice(0, 8)}...{txStatus.txDigest.slice(-6)}
                    </span>
                    <svg
                      className="w-3 h-3 text-[var(--text-muted)] group-hover:text-white transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={() => setTxStatus({ type: null, message: "" })}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                aria-label="Dismiss notification"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
