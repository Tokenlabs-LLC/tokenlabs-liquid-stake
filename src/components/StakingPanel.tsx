"use client";

import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@iota/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useUserBalances } from "@/hooks/useUserBalances";
import { usePoolData } from "@/hooks/usePoolData";
import { ValidatorSelect } from "./ValidatorSelect";
import { buildStakeToValidatorsTx, buildUnstakeTx } from "@/lib/transactions";
import { formatIota, parseIota, calculateShares, calculateIota } from "@/lib/utils";
import { DEFAULT_VALIDATORS, ONE_IOTA, IOTA_LOGO, TIOTA_LOGO } from "@/lib/constants";

type Tab = "stake" | "unstake";

export function StakingPanel() {
  const account = useCurrentAccount();
  const queryClient = useQueryClient();
  const { totalIota, totalTiota, tiotaCoins, refetch: refetchBalances } = useUserBalances();
  const { poolState, ratio, refetch: refetchPool } = usePoolData();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  // Refetch all data including protocol stakes
  const refetchAll = () => {
    refetchBalances();
    refetchPool();
    queryClient.invalidateQueries({ queryKey: ["protocolStakes"] });
  };

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

  useEffect(() => {
    if (validatorMode === "auto") {
      setSelectedValidators(DEFAULT_VALIDATORS.map((v) => v.address));
    }
  }, [validatorMode]);

  const stakeAmountBigInt = stakeAmount ? parseIota(stakeAmount) : 0n;
  const unstakeAmountBigInt = unstakeAmount ? parseIota(unstakeAmount) : 0n;

  const estimatedTiota = stakeAmountBigInt > 0n ? calculateShares(stakeAmountBigInt, ratio) : 0n;
  const estimatedIota = unstakeAmountBigInt > 0n ? calculateIota(unstakeAmountBigInt, ratio) : 0n;

  const numValidators = validatorMode === "auto"
    ? DEFAULT_VALIDATORS.length
    : selectedValidators.length;
  const minStakePerValidator = poolState?.minStake || ONE_IOTA;
  const effectiveMinStake = minStakePerValidator * BigInt(Math.max(numValidators, 1));

  const validatorsValid = validatorMode === "auto" || selectedValidators.length > 0;
  const isStakeValid = stakeAmountBigInt >= effectiveMinStake && stakeAmountBigInt <= totalIota && validatorsValid;
  const isUnstakeValid = unstakeAmountBigInt > 0n && unstakeAmountBigInt <= totalTiota;

  const handleStake = async () => {
    if (!isStakeValid || !account) return;

    setTxStatus({ type: "pending", message: "Preparing transaction..." });

    try {
      const GAS_RESERVE = ONE_IOTA / 10n;

      if (totalIota < stakeAmountBigInt + GAS_RESERVE) {
        setTxStatus({
          type: "error",
          message: `Insufficient balance. Need ${formatIota(stakeAmountBigInt + GAS_RESERVE)} IOTA`,
        });
        return;
      }

      const validators = validatorMode === "auto"
        ? DEFAULT_VALIDATORS.map(v => v.address)
        : selectedValidators;

      const tx = buildStakeToValidatorsTx(validators, stakeAmountBigInt);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
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
            const errorMsg = error.message || "";
            if (errorMsg.includes("E_NO_VALIDATORS") || errorMsg.includes("300")) {
              setTxStatus({ type: "error", message: "No validators configured." });
            } else if (errorMsg.includes("E_MIN_LIMIT") || errorMsg.includes("100")) {
              setTxStatus({ type: "error", message: `Min: ${formatIota(effectiveMinStake)} IOTA` });
            } else if (errorMsg.includes("E_PAUSED") || errorMsg.includes("101")) {
              setTxStatus({ type: "error", message: "Pool is paused." });
            } else {
              setTxStatus({ type: "error", message: `Failed: ${errorMsg.slice(0, 50)}...` });
            }
          },
        }
      );
    } catch (error) {
      setTxStatus({
        type: "error",
        message: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      });
    }
  };

  const handleUnstake = async () => {
    if (!isUnstakeValid || !account) return;

    setTxStatus({ type: "pending", message: "Preparing unstake..." });

    try {
      const coinIds = tiotaCoins.map(c => c.objectId);

      if (coinIds.length === 0) {
        setTxStatus({ type: "error", message: "No tIOTA available." });
        return;
      }

      const tx = buildUnstakeTx(coinIds, unstakeAmountBigInt);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
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
            const errorMsg = error.message || "";
            if (errorMsg.includes("EpochNotYetEnded") ||
                errorMsg.includes("staking_pool") ||
                errorMsg.includes("dynamic_field") ||
                errorMsg.includes("E_NOTHING_TO_UNSTAKE")) {
              setTxStatus({
                type: "error",
                message: "Wait for next epoch to unstake.",
              });
            } else {
              setTxStatus({ type: "error", message: `Failed: ${errorMsg.slice(0, 50)}...` });
            }
          },
        }
      );
    } catch (error) {
      setTxStatus({
        type: "error",
        message: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      });
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

  if (!account) {
    return (
      <div className="glass-card p-6 text-center h-full flex flex-col justify-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/10 border border-[var(--border-subtle)] flex items-center justify-center">
          <svg className="w-6 h-6 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">Connect your wallet to start staking</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-subtle)]">
        <button
          onClick={() => setActiveTab("stake")}
          className={`tab-button ${activeTab === "stake" ? "active" : ""}`}
        >
          Stake
        </button>
        <button
          onClick={() => setActiveTab("unstake")}
          className={`tab-button ${activeTab === "unstake" ? "active" : ""}`}
        >
          Unstake
        </button>
      </div>

      <div className="p-5 flex-1 overflow-auto">
        {/* Stake Tab */}
        {activeTab === "stake" && (
          <div className="space-y-4">
            {/* Balance */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-muted)]">Available</span>
              <div className="flex items-center gap-1.5">
                <img src={IOTA_LOGO} alt="IOTA" className="w-4 h-4 rounded-full" />
                <span className="mono text-sm text-[var(--text-primary)]">{formatIota(totalIota)} IOTA</span>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-glass pr-24 mono"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={setMaxStake}
                    className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
                  >
                    MAX
                  </button>
                  <div className="flex items-center gap-1">
                    <img src={IOTA_LOGO} alt="IOTA" className="w-4 h-4 rounded-full" />
                    <span className="text-[var(--text-muted)] text-xs font-medium">IOTA</span>
                  </div>
                </div>
              </div>
              {stakeAmountBigInt < effectiveMinStake && (
                <p className={`text-xs mt-1.5 ${stakeAmountBigInt > 0n ? "text-red-400" : "text-[var(--text-muted)]"}`}>
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
              <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--accent-glow)] border border-[var(--border-accent)]">
                <span className="text-xs text-[var(--text-secondary)]">You receive</span>
                <div className="flex items-center gap-1.5">
                  <img src={TIOTA_LOGO} alt="tIOTA" className="w-4 h-4 rounded-full" />
                  <span className="mono font-semibold text-[var(--accent-primary)]">
                    ~{formatIota(estimatedTiota)} tIOTA
                  </span>
                </div>
              </div>
            )}

            {/* Stake Button */}
            <button
              onClick={handleStake}
              disabled={!isStakeValid || isPending}
              className="btn-glow w-full !py-3"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
          <div className="space-y-4">
            {/* Balance */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-muted)]">Balance</span>
              <div className="flex items-center gap-1.5">
                <img src={TIOTA_LOGO} alt="tIOTA" className="w-4 h-4 rounded-full" />
                <span className="mono text-sm text-[var(--text-primary)]">{formatIota(totalTiota)} tIOTA</span>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-glass pr-24 mono"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={setMaxUnstake}
                    className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
                  >
                    MAX
                  </button>
                  <div className="flex items-center gap-1">
                    <img src={TIOTA_LOGO} alt="tIOTA" className="w-4 h-4 rounded-full" />
                    <span className="text-[var(--text-muted)] text-xs font-medium">tIOTA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estimated Output */}
            {unstakeAmountBigInt > 0n && (
              <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--accent-glow)] border border-[var(--border-accent)]">
                <span className="text-xs text-[var(--text-secondary)]">You receive</span>
                <div className="flex items-center gap-1.5">
                  <img src={IOTA_LOGO} alt="IOTA" className="w-4 h-4 rounded-full" />
                  <span className="mono font-semibold text-[var(--accent-primary)]">
                    ~{formatIota(estimatedIota)} IOTA
                  </span>
                </div>
              </div>
            )}

            {/* Unstake Button */}
            <button
              onClick={handleUnstake}
              disabled={!isUnstakeValid || isPending}
              className="btn-secondary w-full !py-3"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
            className={`mt-4 p-4 rounded-xl border relative overflow-hidden ${
              txStatus.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : txStatus.type === "error"
                ? "bg-red-500/10 border-red-500/30"
                : "bg-[var(--accent-secondary)]/10 border-[var(--accent-secondary)]/30"
            }`}
          >
            {/* Background glow */}
            <div className={`absolute inset-0 opacity-20 ${
              txStatus.type === "success" ? "bg-gradient-to-r from-emerald-500/20 to-transparent" :
              txStatus.type === "error" ? "bg-gradient-to-r from-red-500/20 to-transparent" :
              "bg-gradient-to-r from-[var(--accent-secondary)]/20 to-transparent"
            }`} />

            <div className="relative flex items-start gap-3">
              {/* Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                txStatus.type === "success" ? "bg-emerald-500/20" :
                txStatus.type === "error" ? "bg-red-500/20" :
                "bg-[var(--accent-secondary)]/20"
              }`}>
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
                <p className={`font-medium text-sm ${
                  txStatus.type === "success" ? "text-emerald-400" :
                  txStatus.type === "error" ? "text-red-400" :
                  "text-[var(--accent-secondary)]"
                }`}>
                  {txStatus.message}
                </p>
                {txStatus.txDigest && (
                  <a
                    href={`${EXPLORER_URL}/${txStatus.txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                  >
                    <span className="mono text-xs text-[var(--text-secondary)] group-hover:text-white transition-colors">
                      {txStatus.txDigest.slice(0, 8)}...{txStatus.txDigest.slice(-6)}
                    </span>
                    <svg className="w-3 h-3 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={() => setTxStatus({ type: null, message: "" })}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
