"use client";

import { useState, useMemo } from "react";
import { useProtocolStakes } from "@/hooks/useProtocolStakes";
import { useValidators } from "@/hooks/useValidators";
import { formatIota, truncateAddress } from "@/lib/utils";
import { IOTA_LOGO } from "@/lib/constants";

// IOTA validator names to group
const IOTA_VALIDATOR_NAMES = ["IOTA 1", "IOTA 2", "IOTA 3", "IOTA 4"];

// IOTA validator addresses (fallback for name matching)
const IOTA_VALIDATOR_ADDRESSES = [
  "0xb64051fe5048486c0a215ff1ec48dc63214528bcc4d00c27d151404dbd717ba4", // IOTA 4
];

// Check if validator is part of IOTA group
function isIotaValidator(name: string, address: string): boolean {
  if (IOTA_VALIDATOR_NAMES.includes(name)) return true;
  if (IOTA_VALIDATOR_ADDRESSES.some(addr => addr.toLowerCase() === address.toLowerCase())) return true;
  // Also check if name starts with "IOTA " followed by a number
  if (/^IOTA \d+$/i.test(name)) return true;
  return false;
}

// Child stake in a group
interface ChildStake {
  address: string;
  name: string;
  imageUrl?: string;
  totalStaked: bigint;
  votingPower: number;
}

// Grouped stake type for display
interface DisplayStake {
  id: string;
  name: string;
  imageUrl?: string;
  totalStaked: bigint;
  votingPower: number;
  isGroup: boolean;
  groupCount?: number;
  children?: ChildStake[];
}

// Avatar component with fallback
function ValidatorAvatar({
  imageUrl,
  name,
  size = "md",
  muted = false
}: {
  imageUrl?: string;
  name: string;
  size?: "sm" | "md";
  muted?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = size === "sm" ? "w-4 h-4 text-[7px]" : "w-5 h-5 text-[9px]";
  const bgColor = muted ? "bg-[var(--text-muted)]/20" : "bg-[var(--accent-primary)]/30";
  const textColor = muted ? "text-[var(--text-muted)]" : "text-[var(--accent-primary)]";

  if (!imageUrl || hasError) {
    return (
      <div className={`${sizeClasses} rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <span className={`font-bold ${textColor}`}>
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className={`${sizeClasses} rounded-full object-cover flex-shrink-0 ${muted ? "opacity-60" : ""}`}
      onError={() => setHasError(true)}
    />
  );
}

export function ProtocolStakes() {
  const { stakes, totalProtocolStake, isLoading, error } = useProtocolStakes();
  const { validators: allValidators } = useValidators();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Create a map of validator addresses to names and images from system validators
  const validatorData = useMemo(() => {
    const map = new Map<string, { name: string; imageUrl?: string }>();
    for (const v of allValidators) {
      map.set(v.address.toLowerCase(), {
        name: v.name,
        imageUrl: v.imageUrl,
      });
    }
    return map;
  }, [allValidators]);

  const getValidatorName = (address: string) => {
    return validatorData.get(address.toLowerCase())?.name || truncateAddress(address, 6);
  };

  const getValidatorImage = (address: string) => {
    return validatorData.get(address.toLowerCase())?.imageUrl;
  };

  // Group IOTA 1-4 into IOTA 4x
  const displayStakes = useMemo((): DisplayStake[] => {
    if (stakes.length === 0) return [];

    const iotaStakes = stakes.filter((s) => {
      const name = getValidatorName(s.address);
      return isIotaValidator(name, s.address);
    });

    const otherStakes = stakes.filter((s) => {
      const name = getValidatorName(s.address);
      return !isIotaValidator(name, s.address);
    });

    const result: DisplayStake[] = [];

    // Create IOTA 4x group if we have any IOTA validators
    if (iotaStakes.length > 0) {
      const totalStaked = iotaStakes.reduce((sum, s) => sum + s.totalStaked, 0n);
      const totalVotingPower = iotaStakes.reduce((sum, s) => sum + s.votingPower, 0);
      const firstIota = iotaStakes[0];
      // Sort children by voting power
      const sortedIotaStakes = [...iotaStakes].sort((a, b) => b.votingPower - a.votingPower);

      result.push({
        id: "iota-4x-group",
        name: "IOTA",
        imageUrl: getValidatorImage(firstIota.address),
        totalStaked,
        votingPower: totalVotingPower,
        isGroup: true,
        groupCount: iotaStakes.length,
        children: sortedIotaStakes.map((s) => ({
          address: s.address,
          name: getValidatorName(s.address),
          imageUrl: getValidatorImage(s.address),
          totalStaked: s.totalStaked,
          votingPower: s.votingPower,
        })),
      });
    }

    // Add other validators
    for (const s of otherStakes) {
      result.push({
        id: s.address,
        name: getValidatorName(s.address),
        imageUrl: getValidatorImage(s.address),
        totalStaked: s.totalStaked,
        votingPower: s.votingPower,
        isGroup: false,
      });
    }

    // Sort by voting power (descending)
    result.sort((a, b) => b.votingPower - a.votingPower);

    return result;
  }, [stakes, validatorData]);

  if (isLoading) {
    return (
      <div className="glass-card p-5 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm text-[var(--text-primary)]">
            Protocol Stakes
          </h3>
        </div>
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 bg-[var(--bg-card-solid)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-5 h-full">
        <p className="text-red-400 text-sm">Error loading protocol stakes</p>
      </div>
    );
  }

  // Filter validators with actual stake
  const validatorsWithStake = displayStakes.filter((s) => s.totalStaked > 0n);
  const validatorsWithoutStake = displayStakes.filter((s) => s.totalStaked === 0n);

  return (
    <div className="glass-card p-5 flex flex-col max-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm text-[var(--text-primary)]">
          Protocol Stakes
        </h3>
        <div className="stat-chip !py-1 !px-2.5 text-xs">
          <img src={IOTA_LOGO} alt="IOTA" className="w-3.5 h-3.5 rounded-full" />
          <span className="value">{formatIota(totalProtocolStake)} IOTA</span>
        </div>
      </div>

      {/* Stakes list */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {validatorsWithStake.length === 0 && validatorsWithoutStake.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            No validators configured
          </div>
        ) : validatorsWithStake.length === 0 ? (
          <div className="text-center py-4 text-[var(--text-muted)] text-sm">
            No stake distributed yet
          </div>
        ) : (
          validatorsWithStake.map((stake) => {
            const percentage =
              totalProtocolStake > 0n
                ? Number((stake.totalStaked * 10000n) / totalProtocolStake) / 100
                : 0;
            const isExpanded = expandedGroups.has(stake.id);

            return (
              <div key={stake.id}>
                <div
                  className="relative bg-[var(--bg-card-solid)]/50 rounded-lg p-3 border border-[var(--border-subtle)] overflow-hidden"
                >
                  {/* Progress bar background */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-transparent"
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Content */}
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Expand button for groups */}
                      {stake.isGroup && stake.children && (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedGroups((prev) => {
                              const next = new Set(prev);
                              if (next.has(stake.id)) {
                                next.delete(stake.id);
                              } else {
                                next.add(stake.id);
                              }
                              return next;
                            });
                          }}
                          className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                      {/* Validator Icon */}
                      <ValidatorAvatar
                        imageUrl={stake.imageUrl}
                        name={stake.name}
                      />
                      <span className="font-medium text-sm text-[var(--text-primary)]">
                        {stake.name}
                      </span>
                      {/* Group badge */}
                      {stake.isGroup && stake.groupCount && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
                          {stake.groupCount}x
                        </span>
                      )}
                      {/* Voting Power Badge */}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium mono" title="Network Voting Power">
                        VP {(stake.votingPower / 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="mono text-sm font-semibold text-[var(--accent-secondary)]" title="Staked Amount">
                        {formatIota(stake.totalStaked)} IOTA
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] w-12 text-right" title="Share of Protocol Stake">
                        Share {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded children */}
                {stake.isGroup && isExpanded && stake.children && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-purple-500/30 pl-3">
                    {stake.children.map((child) => {
                      const childPercentage =
                        totalProtocolStake > 0n
                          ? Number((child.totalStaked * 10000n) / totalProtocolStake) / 100
                          : 0;
                      return (
                        <div
                          key={child.address}
                          className="relative bg-[var(--bg-card-solid)]/30 rounded-lg p-2 border border-[var(--border-subtle)]/50 overflow-hidden"
                        >
                          {/* Progress bar background */}
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"
                            style={{ width: `${childPercentage}%` }}
                          />
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ValidatorAvatar
                                imageUrl={child.imageUrl}
                                name={child.name}
                                size="sm"
                              />
                              <span className="text-xs text-[var(--text-secondary)]">
                                {child.name}
                              </span>
                              <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400/70 mono" title="Network Voting Power">
                                VP {(child.votingPower / 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="mono text-xs text-[var(--text-muted)]" title="Staked Amount">
                                {formatIota(child.totalStaked)} IOTA
                              </span>
                              <span className="text-[9px] text-[var(--text-muted)] w-12 text-right" title="Share of Protocol Stake">
                                {childPercentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Show validators without stake (collapsed) */}
        {validatorsWithoutStake.length > 0 && (
          <details className="group mt-2">
            <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] py-2 list-none flex items-center gap-1">
              <svg
                className="w-3 h-3 transition-transform group-open:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              {validatorsWithoutStake.length} validators without stake
            </summary>
            <div className="space-y-1 mt-1 max-h-32 overflow-y-auto">
              {validatorsWithoutStake.map((stake) => (
                <div
                  key={stake.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-[var(--bg-card-solid)]/30 text-[var(--text-muted)]"
                >
                  <div className="flex items-center gap-1.5">
                    {/* Validator Icon */}
                    <ValidatorAvatar
                      imageUrl={stake.imageUrl}
                      name={stake.name}
                      size="sm"
                      muted
                    />
                    <span className="text-xs">
                      {stake.name}
                    </span>
                    {/* Group badge */}
                    {stake.isGroup && stake.groupCount && (
                      <span className="text-[7px] px-0.5 py-0.5 rounded bg-purple-500/10 text-purple-400/60 font-medium">
                        {stake.groupCount}x
                      </span>
                    )}
                    {/* Voting Power Badge */}
                    <span className="text-[7px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400/60 mono" title="Network Voting Power">
                      VP {(stake.votingPower / 100).toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-[10px] mono" title="Staked Amount">0 IOTA</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Summary footer */}
      {validatorsWithStake.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{validatorsWithStake.length} active</span>
          <span className="mono">
            Avg: {formatIota(totalProtocolStake / BigInt(Math.max(validatorsWithStake.length, 1)))}
          </span>
        </div>
      )}
    </div>
  );
}
