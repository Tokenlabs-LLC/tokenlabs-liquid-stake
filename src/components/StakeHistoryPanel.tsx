"use client";

import { useState } from "react";
import {
  useStakeHistory,
  useValidatorVaults,
  useEpochInfo,
  usePoolRewardsEstimate,
  type StakeHistoryEvent,
  type ValidatorVaultInfo,
} from "@/hooks/useStakeHistory";
import { useValidators } from "@/hooks/useValidators";
import { usePoolData } from "@/hooks/usePoolData";
import { formatIota, truncateAddress } from "@/lib/utils";
// Note: DEFAULT_VALIDATORS removed - now using systemValidators for names

// Alias for clarity
const shortenAddress = truncateAddress;

type TabType = "overview" | "vaults" | "events";

export function StakeHistoryPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const { events, isLoading: eventsLoading, refetch: refetchEvents } = useStakeHistory();
  const { vaults, isLoading: vaultsLoading, refetch: refetchVaults } = useValidatorVaults();
  const { rewardsInfo, isLoading: rewardsLoading, refetch: refetchRewards } = usePoolRewardsEstimate();
  const { validators: systemValidators } = useValidators();
  const { poolState } = usePoolData();
  const epochInfo = useEpochInfo();

  const handleRefresh = () => {
    refetchEvents();
    refetchVaults();
    refetchRewards();
  };

  // Get validator name from system validators
  const getValidatorName = (address: string): string => {
    const found = systemValidators.find(
      (v) => v.address.toLowerCase() === address.toLowerCase()
    );
    return found?.name ?? shortenAddress(address);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">📊</span>
          Pool Analytics & Rewards
        </h3>
        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Current Epoch Info */}
      <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-gray-400">Current Epoch:</span>{" "}
            <span className="text-white font-mono">{epochInfo.currentEpoch}</span>
          </div>
          <div className="text-gray-500">|</div>
          <div>
            <span className="text-gray-400">Duration:</span>{" "}
            <span className="text-white font-mono">
              {epochInfo.epochDurationMs ? `${(epochInfo.epochDurationMs / 3600000).toFixed(1)}h` : "-"}
            </span>
          </div>
          <div className="text-gray-500">|</div>
          <div>
            <span className="text-gray-400">Reported Rewards:</span>{" "}
            <span className="text-green-400 font-mono">
              {poolState ? formatIota(poolState.totalRewards) : "..."} IOTA
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Rewards Overview
        </button>
        <button
          onClick={() => setActiveTab("vaults")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "vaults"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Validator Vaults ({vaults.length})
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "events"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Event History ({events.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === "overview" ? (
        <RewardsOverviewTab
          rewardsInfo={rewardsInfo}
          isLoading={rewardsLoading}
          currentEpoch={epochInfo.currentEpoch}
          reportedRewards={poolState?.totalRewards ?? 0n}
          getValidatorName={getValidatorName}
        />
      ) : activeTab === "vaults" ? (
        <VaultsTab
          vaults={vaults}
          isLoading={vaultsLoading}
          currentEpoch={epochInfo.currentEpoch}
          getValidatorName={getValidatorName}
        />
      ) : (
        <EventsTab events={events} isLoading={eventsLoading} getValidatorName={getValidatorName} />
      )}
    </div>
  );
}

// Rewards Overview Tab - Shows REAL rewards calculated from EXCHANGE RATES
function RewardsOverviewTab({
  rewardsInfo,
  isLoading,
  currentEpoch,
  reportedRewards,
  getValidatorName,
}: {
  rewardsInfo: ReturnType<typeof usePoolRewardsEstimate>["rewardsInfo"];
  isLoading: boolean;
  currentEpoch: number;
  reportedRewards: bigint;
  getValidatorName: (address: string) => string;
}) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Calculating rewards from exchange rates...
      </div>
    );
  }

  if (!rewardsInfo) {
    return (
      <div className="text-center py-8 text-gray-400">
        No stake data found. Stakes will appear here once users start staking.
      </div>
    );
  }

  const handleCopyRewards = () => {
    const rewardsIota = Number(rewardsInfo.totalRewards) / 1e9;
    navigator.clipboard.writeText(rewardsIota.toFixed(9));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rewardsDelta = rewardsInfo.totalRewards - reportedRewards;
  const needsUpdate = rewardsDelta > 0n;

  // Count totals
  const totalActiveStakes = rewardsInfo.validatorBreakdown.reduce((sum, v) => sum + v.activeStakes, 0);
  const totalPendingStakes = rewardsInfo.validatorBreakdown.reduce((sum, v) => sum + v.pendingStakes, 0);

  return (
    <div className="space-y-4">
      {/* Calculation Method Badge */}
      <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔐</span>
          <div>
            <span className="text-emerald-400 font-medium text-sm">Calculation: Exchange Rates</span>
            <p className="text-xs text-gray-400">
              Rewards calculated from on-chain pool exchange rates (NOT estimated, NOT APY-based)
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Epoch {rewardsInfo.currentEpoch}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Principal */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4">
          <div className="text-gray-400 text-sm mb-1">Total Principal Staked</div>
          <div className="text-2xl font-bold text-white font-mono">
            {formatIota(rewardsInfo.totalPrincipal)}
          </div>
          <div className="text-xs text-gray-500">IOTA</div>
        </div>

        {/* REAL Rewards */}
        <div className="bg-gray-900/50 rounded-lg border border-green-500/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Real Rewards (Exchange Rate)
          </div>
          <div className="text-2xl font-bold text-green-400 font-mono">
            {formatIota(rewardsInfo.totalRewards)}
          </div>
          <div className="text-xs text-gray-500">IOTA • From pool exchange rates</div>
        </div>

        {/* Total Value */}
        <div className="bg-gray-900/50 rounded-lg border border-blue-700/50 p-4">
          <div className="text-gray-400 text-sm mb-1">Total Value (TVL)</div>
          <div className="text-2xl font-bold text-blue-400 font-mono">
            {formatIota(rewardsInfo.totalValue)}
          </div>
          <div className="text-xs text-gray-500">IOTA • Principal + Rewards</div>
        </div>
      </div>

      {/* Stakes Status Bar */}
      <div className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-sm text-gray-400">Active Stakes:</span>
          <span className="text-sm font-mono text-green-400">{totalActiveStakes}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-sm text-gray-400">Pending:</span>
          <span className="text-sm font-mono text-amber-400">{totalPendingStakes}</span>
        </div>
        <div className="text-xs text-gray-500 ml-auto">
          Formula: reward = principal × (current_rate / deposit_rate) - principal
        </div>
      </div>

      {/* Rewards Report Helper */}
      <div className={`p-4 rounded-lg border ${needsUpdate ? "bg-amber-500/10 border-amber-500/30" : "bg-green-500/10 border-green-500/30"}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{needsUpdate ? "⚠️" : "✅"}</span>
              <span className="font-medium text-white">
                {needsUpdate ? "Rewards Update Required" : "Rewards Up to Date"}
              </span>
            </div>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-400">Currently Reported:</span>{" "}
                <span className="text-white font-mono">{formatIota(reportedRewards)} IOTA</span>
              </div>
              <div>
                <span className="text-gray-400">Real Rewards (Exchange Rates):</span>{" "}
                <span className="text-green-400 font-mono">{formatIota(rewardsInfo.totalRewards)} IOTA</span>
              </div>
              {needsUpdate && (
                <div>
                  <span className="text-gray-400">Difference:</span>{" "}
                  <span className="text-amber-400 font-mono">+{formatIota(rewardsDelta)} IOTA</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              🔐 Calculated using <strong>pool exchange rates</strong> from the blockchain.
              This is the exact value you would receive if you unstaked now.
            </p>
          </div>
          <button
            onClick={handleCopyRewards}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              copied
                ? "bg-green-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-white"
            }`}
          >
            {copied ? "Copied!" : "Copy Value"}
          </button>
        </div>
      </div>

      {/* Per-Validator Breakdown */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <span className="font-medium text-white">Rewards by Validator (Exchange Rate Method)</span>
        </div>
        <div className="divide-y divide-gray-700/50">
          {rewardsInfo.validatorBreakdown.map((v) => (
            <div key={v.validatorAddress} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                    {(v.validatorName || getValidatorName(v.validatorAddress))[0]}
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {v.validatorName || getValidatorName(v.validatorAddress)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {v.activeStakes} active, {v.pendingStakes} pending • Since epoch {v.stakeActivationEpoch}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-mono">{formatIota(v.principal)} IOTA</div>
                  <div className="text-xs text-green-400 font-mono">+{formatIota(v.rewards)} rewards</div>
                </div>
              </div>
              {/* Exchange Rate Info */}
              <div className="mt-2 pt-2 border-t border-gray-700/30 flex items-center gap-4 text-xs text-gray-500">
                <span>Exchange Rate: {v.currentExchangeRate?.toFixed(6) || "N/A"}</span>
                <span>•</span>
                <span>Current Value: {formatIota(v.currentValue)} IOTA</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Explanation Box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
        <div className="font-medium text-blue-300 mb-2">🔐 How Exchange Rate Calculation Works</div>
        <ul className="text-gray-400 space-y-1 list-disc list-inside">
          <li>Each validator pool has an <strong>exchange rate</strong> (IOTA/pool_token) that increases over time</li>
          <li><strong>Formula:</strong> reward = principal × (current_rate / deposit_rate) - principal</li>
          <li>This gives the <strong>exact reward</strong> you would receive if you unstaked now</li>
          <li>NOT based on APY estimates - this is the <strong>real on-chain value</strong></li>
          <li>Stakes must be "Active" (1 epoch after staking) to start earning</li>
        </ul>
      </div>
    </div>
  );
}

function VaultsTab({
  vaults,
  isLoading,
  currentEpoch,
  getValidatorName,
}: {
  vaults: ValidatorVaultInfo[];
  isLoading: boolean;
  currentEpoch: number;
  getValidatorName: (address: string) => string;
}) {
  const [expandedVault, setExpandedVault] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading vaults...
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No vaults found. Stakes will appear here once users start staking.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vaults.map((vault) => (
        <div
          key={vault.address}
          className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden"
        >
          {/* Vault Header */}
          <button
            onClick={() => setExpandedVault(expandedVault === vault.address ? null : vault.address)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                {getValidatorName(vault.address)[0]}
              </div>
              <div className="text-left">
                <div className="text-white font-medium">{getValidatorName(vault.address)}</div>
                <div className="text-xs text-gray-500 font-mono">{shortenAddress(vault.address)}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-white font-mono">{formatIota(vault.totalStaked)} IOTA</div>
                <div className="text-xs text-gray-400">{vault.stakes.length} stake(s)</div>
              </div>
              <span className="text-gray-400">{expandedVault === vault.address ? "▲" : "▼"}</span>
            </div>
          </button>

          {/* Vault Details */}
          {expandedVault === vault.address && (
            <div className="border-t border-gray-700 p-4 space-y-3">
              {/* Epoch Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Last Stake Epoch:</span>{" "}
                  <span className="text-white font-mono">{vault.stakeEpoch}</span>
                </div>
                <div>
                  <span className="text-gray-400">Staked This Epoch:</span>{" "}
                  <span className="text-white font-mono">
                    {vault.stakeEpoch === currentEpoch ? formatIota(vault.stakedInEpoch) : "0"} IOTA
                  </span>
                </div>
              </div>

              {/* Stakes Table */}
              {vault.stakes.length > 0 ? (
                <div className="mt-4">
                  <div className="text-sm text-gray-300 mb-2 font-medium">Individual Stakes:</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-left">
                          <th className="pb-2">#</th>
                          <th className="pb-2">Principal</th>
                          <th className="pb-2">Activation Epoch</th>
                          <th className="pb-2">Rewards Start</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vault.stakes.map((stake, idx) => {
                          const isEarning = currentEpoch >= stake.rewardsStartEpoch;
                          const isPending = currentEpoch === stake.activationEpoch;

                          return (
                            <tr key={stake.objectId} className="border-t border-gray-700/50">
                              <td className="py-2 text-gray-500">{idx + 1}</td>
                              <td className="py-2 text-white font-mono">
                                {formatIota(stake.principal)} IOTA
                              </td>
                              <td className="py-2 font-mono text-gray-300">
                                {stake.activationEpoch}
                              </td>
                              <td className="py-2 font-mono text-gray-300">
                                {stake.rewardsStartEpoch}
                              </td>
                              <td className="py-2">
                                {isEarning ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    Earning
                                  </span>
                                ) : isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Activating
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm mt-2">No individual stakes found in vault.</div>
              )}

              {/* Summary */}
              {vault.stakes.length > 0 && (
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Earning:</span>{" "}
                      <span className="text-green-400 font-mono">
                        {vault.stakes.filter((s) => currentEpoch >= s.rewardsStartEpoch).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Pending:</span>{" "}
                      <span className="text-amber-400 font-mono">
                        {vault.stakes.filter((s) => currentEpoch < s.rewardsStartEpoch).length}
                      </span>
                    </div>
                    {vault.stakes.some((s) => currentEpoch < s.rewardsStartEpoch) && (
                      <div className="text-gray-400 text-xs">
                        (Next rewards start in epoch {Math.min(...vault.stakes.filter((s) => currentEpoch < s.rewardsStartEpoch).map((s) => s.rewardsStartEpoch))})
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Total Summary */}
      <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Total Staked Across All Validators:</span>
          <span className="text-white font-mono text-lg">
            {formatIota(vaults.reduce((sum, v) => sum + v.totalStaked, 0n))} IOTA
          </span>
        </div>
      </div>
    </div>
  );
}

function EventsTab({
  events,
  isLoading,
  getValidatorName,
}: {
  events: StakeHistoryEvent[];
  isLoading: boolean;
  getValidatorName: (address: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading events...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No stake events found. Events will appear here as users stake and unstake.
      </div>
    );
  }

  const getEventIcon = (type: StakeHistoryEvent["type"]) => {
    switch (type) {
      case "stake":
        return "🟢";
      case "stake_to_validators":
        return "🎯";
      case "unstake":
        return "🔴";
    }
  };

  const getEventLabel = (type: StakeHistoryEvent["type"]) => {
    switch (type) {
      case "stake":
        return "Auto Stake";
      case "stake_to_validators":
        return "Manual Stake";
      case "unstake":
        return "Unstake";
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="space-y-2">
      {events.map((event, idx) => (
        <div
          key={`${event.txDigest}-${idx}`}
          className="bg-gray-900/50 rounded-lg border border-gray-700 p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getEventIcon(event.type)}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{getEventLabel(event.type)}</span>
                  <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Staker: <span className="font-mono">{shortenAddress(event.staker)}</span>
                </div>
                {event.validators && event.validators.length > 0 && (
                  <div className="text-sm text-gray-400 mt-1">
                    Validators: {event.validators.map(getValidatorName).join(", ")}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono ${event.type === "unstake" ? "text-red-400" : "text-green-400"}`}>
                {event.type === "unstake" ? "-" : "+"}{formatIota(event.iotaAmount)} IOTA
              </div>
              <div className="text-xs text-gray-500 font-mono mt-1">
                {formatIota(event.certAmount)} tIOTA
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700/50">
            <a
              href={`https://explorer.iota.org/testnet/txblock/${event.txDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 font-mono"
            >
              {shortenAddress(event.txDigest)} ↗
            </a>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Stakes:</span>{" "}
            <span className="text-green-400 font-mono">
              {events.filter((e) => e.type !== "unstake").length}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Total Unstakes:</span>{" "}
            <span className="text-red-400 font-mono">
              {events.filter((e) => e.type === "unstake").length}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Net Staked:</span>{" "}
            <span className="text-white font-mono">
              {formatIota(
                events.reduce(
                  (sum, e) => sum + (e.type === "unstake" ? -e.iotaAmount : e.iotaAmount),
                  0n
                )
              )} IOTA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
