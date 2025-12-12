"use client";

import { useState, useMemo } from "react";
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

const shortenAddress = truncateAddress;

type TabType = "overview" | "vaults" | "events";

// Search input component
function SearchInput({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

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
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div>
            <span className="text-gray-400">Epoch:</span>{" "}
            <span className="text-white font-mono">{epochInfo.currentEpoch}</span>
          </div>
          <div className="text-gray-600">•</div>
          <div>
            <span className="text-gray-400">Duration:</span>{" "}
            <span className="text-white font-mono">
              {epochInfo.epochDurationMs ? `${(epochInfo.epochDurationMs / 3600000).toFixed(1)}h` : "-"}
            </span>
          </div>
          <div className="text-gray-600">•</div>
          <div>
            <span className="text-gray-400">Reported:</span>{" "}
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
          Vaults ({vaults.length})
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "events"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Events ({events.length})
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

// Rewards Overview Tab
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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredValidators = useMemo(() => {
    if (!rewardsInfo) return [];
    if (!searchQuery.trim()) return rewardsInfo.validatorBreakdown;

    const query = searchQuery.toLowerCase();
    return rewardsInfo.validatorBreakdown.filter((v) => {
      const name = (v.validatorName || getValidatorName(v.validatorAddress)).toLowerCase();
      const address = v.validatorAddress.toLowerCase();
      return name.includes(query) || address.includes(query);
    });
  }, [rewardsInfo, searchQuery, getValidatorName]);

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
  const totalActiveStakes = rewardsInfo.validatorBreakdown.reduce((sum, v) => sum + v.activeStakes, 0);
  const totalPendingStakes = rewardsInfo.validatorBreakdown.reduce((sum, v) => sum + v.pendingStakes, 0);

  return (
    <div className="space-y-4">
      {/* Stats Grid - More Compact */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-3">
          <div className="text-gray-400 text-xs mb-1">Principal</div>
          <div className="text-lg font-bold text-white font-mono">
            {formatIota(rewardsInfo.totalPrincipal)}
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg border border-green-500/30 p-3">
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Real Rewards
          </div>
          <div className="text-lg font-bold text-green-400 font-mono">
            {formatIota(rewardsInfo.totalRewards)}
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg border border-blue-500/30 p-3">
          <div className="text-gray-400 text-xs mb-1">Total Value</div>
          <div className="text-lg font-bold text-blue-400 font-mono">
            {formatIota(rewardsInfo.totalValue)}
          </div>
        </div>
      </div>

      {/* Compact Status Bar */}
      <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg border border-gray-700 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            <span className="text-green-400 font-mono">{totalActiveStakes}</span> active
          </span>
          <span className="text-gray-400">
            <span className="text-amber-400 font-mono">{totalPendingStakes}</span> pending
          </span>
        </div>
        <span className="text-gray-500">Exchange Rate Method • Epoch {rewardsInfo.currentEpoch}</span>
      </div>

      {/* Rewards Report - Compact */}
      <div className={`p-3 rounded-lg border ${needsUpdate ? "bg-amber-500/10 border-amber-500/30" : "bg-green-500/10 border-green-500/30"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">{needsUpdate ? "⚠️" : "✅"}</span>
            <div className="text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-400">Reported: <span className="text-white font-mono">{formatIota(reportedRewards)}</span></span>
                <span className="text-gray-400">Real: <span className="text-green-400 font-mono">{formatIota(rewardsInfo.totalRewards)}</span></span>
                {needsUpdate && (
                  <span className="text-amber-400 font-mono">+{formatIota(rewardsDelta)}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleCopyRewards}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              copied ? "bg-green-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Validators Table - Compact with Search */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between gap-4">
          <span className="font-medium text-white text-sm whitespace-nowrap">
            Rewards by Validator ({rewardsInfo.validatorBreakdown.length})
          </span>
          <div className="flex-1 max-w-xs">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search validator..."
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-800/30 text-xs text-gray-400 border-b border-gray-700/50">
          <div className="col-span-5">Validator</div>
          <div className="col-span-2 text-right">Principal</div>
          <div className="col-span-2 text-right">Rewards</div>
          <div className="col-span-2 text-right">Value</div>
          <div className="col-span-1 text-center">Stakes</div>
        </div>

        {/* Table Body */}
        <div className="max-h-64 overflow-y-auto">
          {filteredValidators.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              {searchQuery ? "No validators match your search" : "No validators"}
            </div>
          ) : (
            filteredValidators.map((v) => (
              <div
                key={v.validatorAddress}
                className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors items-center text-sm"
              >
                {/* Validator */}
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {(v.validatorName || getValidatorName(v.validatorAddress))[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate text-xs">
                      {v.validatorName || getValidatorName(v.validatorAddress)}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono truncate">
                      {shortenAddress(v.validatorAddress)}
                    </div>
                  </div>
                </div>
                {/* Principal */}
                <div className="col-span-2 text-right font-mono text-white text-xs">
                  {formatIota(v.principal)}
                </div>
                {/* Rewards */}
                <div className="col-span-2 text-right font-mono text-green-400 text-xs">
                  +{formatIota(v.rewards)}
                </div>
                {/* Value */}
                <div className="col-span-2 text-right font-mono text-blue-400 text-xs">
                  {formatIota(v.currentValue)}
                </div>
                {/* Stakes */}
                <div className="col-span-1 text-center">
                  <span className="inline-flex items-center gap-1 text-[10px]">
                    <span className="text-green-400">{v.activeStakes}</span>
                    <span className="text-gray-600">/</span>
                    <span className="text-amber-400">{v.pendingStakes}</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info Box - Collapsed */}
      <details className="bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <summary className="p-3 text-sm font-medium text-blue-300 cursor-pointer hover:bg-blue-500/5">
          🔐 How Exchange Rate Calculation Works
        </summary>
        <div className="px-3 pb-3 text-xs text-gray-400 space-y-1">
          <p>• Each validator pool has an <strong>exchange rate</strong> that increases over time</p>
          <p>• <strong>Formula:</strong> reward = principal × (current_rate / deposit_rate) - principal</p>
          <p>• This is the <strong>exact value</strong> you would receive if you unstaked now</p>
          <p>• Stakes must be "Active" (1 epoch after staking) to start earning</p>
        </div>
      </details>
    </div>
  );
}

// Vaults Tab
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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVaults = useMemo(() => {
    if (!searchQuery.trim()) return vaults;

    const query = searchQuery.toLowerCase();
    return vaults.filter((v) => {
      const name = getValidatorName(v.address).toLowerCase();
      const address = v.address.toLowerCase();
      return name.includes(query) || address.includes(query);
    });
  }, [vaults, searchQuery, getValidatorName]);

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
      {/* Search */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by validator name or address..."
      />

      {/* Vaults List */}
      <div className="space-y-2">
        {filteredVaults.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            No validators match your search
          </div>
        ) : (
          filteredVaults.map((vault) => (
            <div
              key={vault.address}
              className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden"
            >
              {/* Vault Header */}
              <button
                onClick={() => setExpandedVault(expandedVault === vault.address ? null : vault.address)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                    {getValidatorName(vault.address)[0]}
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium text-sm">{getValidatorName(vault.address)}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{shortenAddress(vault.address)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{formatIota(vault.totalStaked)} IOTA</div>
                    <div className="text-[10px] text-gray-400">{vault.stakes.length} stake(s)</div>
                  </div>
                  <span className="text-gray-400 text-xs">{expandedVault === vault.address ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Vault Details */}
              {expandedVault === vault.address && (
                <div className="border-t border-gray-700 p-3 space-y-2">
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>Last Stake: <span className="text-white font-mono">Epoch {vault.stakeEpoch}</span></span>
                    <span>This Epoch: <span className="text-white font-mono">{vault.stakeEpoch === currentEpoch ? formatIota(vault.stakedInEpoch) : "0"} IOTA</span></span>
                  </div>

                  {vault.stakes.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 text-left">
                            <th className="pb-1">#</th>
                            <th className="pb-1">Principal</th>
                            <th className="pb-1">Activation</th>
                            <th className="pb-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vault.stakes.map((stake, idx) => {
                            const isEarning = currentEpoch >= stake.rewardsStartEpoch;
                            const isPending = currentEpoch === stake.activationEpoch;

                            return (
                              <tr key={stake.objectId} className="border-t border-gray-700/50">
                                <td className="py-1 text-gray-500">{idx + 1}</td>
                                <td className="py-1 text-white font-mono">{formatIota(stake.principal)}</td>
                                <td className="py-1 font-mono text-gray-300">{stake.activationEpoch}</td>
                                <td className="py-1">
                                  {isEarning ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                      <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                                      Earning
                                    </span>
                                  ) : isPending ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                      Activating
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
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
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Total */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between text-sm">
        <span className="text-gray-300">Total Staked:</span>
        <span className="text-white font-mono">
          {formatIota(vaults.reduce((sum, v) => sum + v.totalStaked, 0n))} IOTA
        </span>
      </div>
    </div>
  );
}

// Events Tab
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
        No stake events found.
      </div>
    );
  }

  const getEventIcon = (type: StakeHistoryEvent["type"]) => {
    switch (type) {
      case "stake": return "🟢";
      case "stake_to_validators": return "🎯";
      case "unstake": return "🔴";
    }
  };

  const getEventLabel = (type: StakeHistoryEvent["type"]) => {
    switch (type) {
      case "stake": return "Auto";
      case "stake_to_validators": return "Manual";
      case "unstake": return "Unstake";
    }
  };

  return (
    <div className="space-y-2">
      {events.map((event, idx) => (
        <div
          key={`${event.txDigest}-${idx}`}
          className="bg-gray-900/50 rounded-lg border border-gray-700 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getEventIcon(event.type)}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{getEventLabel(event.type)}</span>
                  <span className="text-[10px] text-gray-500">
                    {event.timestamp ? new Date(event.timestamp).toLocaleDateString() : "-"}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono">{shortenAddress(event.staker)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono text-sm ${event.type === "unstake" ? "text-red-400" : "text-green-400"}`}>
                {event.type === "unstake" ? "-" : "+"}{formatIota(event.iotaAmount)}
              </div>
              <div className="text-[10px] text-gray-500 font-mono">{formatIota(event.certAmount)} tIOTA</div>
            </div>
          </div>
        </div>
      ))}

      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Stakes: <span className="text-green-400 font-mono">{events.filter((e) => e.type !== "unstake").length}</span></span>
          <span className="text-gray-400">Unstakes: <span className="text-red-400 font-mono">{events.filter((e) => e.type === "unstake").length}</span></span>
          <span className="text-gray-400">Net: <span className="text-white font-mono">{formatIota(events.reduce((sum, e) => sum + (e.type === "unstake" ? -e.iotaAmount : e.iotaAmount), 0n))}</span></span>
        </div>
      </div>
    </div>
  );
}
