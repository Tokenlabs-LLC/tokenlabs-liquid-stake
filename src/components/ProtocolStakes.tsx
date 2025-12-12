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

// Compact avatar component with fallback
function ValidatorAvatar({
  imageUrl,
  name,
  size = "md",
  muted = false
}: {
  imageUrl?: string;
  name: string;
  size?: "xs" | "sm" | "md";
  muted?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = size === "xs" ? "w-3.5 h-3.5 text-[6px]" : size === "sm" ? "w-4 h-4 text-[7px]" : "w-[18px] h-[18px] text-[8px]";
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
      <div className="glass-card px-4 py-3 h-full">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-display font-semibold text-xs text-[var(--text-primary)] tracking-wide uppercase">
            Protocol Stakes
          </h3>
        </div>
        <div className="space-y-1 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-6 bg-[var(--bg-card-solid)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card px-4 py-3 h-full">
        <p className="text-red-400 text-xs">Error loading protocol stakes</p>
      </div>
    );
  }

  // Filter validators with actual stake
  const validatorsWithStake = displayStakes.filter((s) => s.totalStaked > 0n);
  const validatorsWithoutStake = displayStakes.filter((s) => s.totalStaked === 0n);

  return (
    <div className="glass-card px-4 py-3 flex flex-col max-h-[400px]">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-display font-semibold text-xs text-[var(--text-primary)] tracking-wide uppercase">
          Protocol Stakes
        </h3>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
          <img src={IOTA_LOGO} alt="IOTA" className="w-3 h-3 rounded-full" />
          <span className="text-[10px] mono font-medium text-[var(--accent-primary)]">{formatIota(totalProtocolStake)}</span>
        </div>
      </div>

      {/* Ultra-compact Stakes list */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {validatorsWithStake.length === 0 && validatorsWithoutStake.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)] text-xs">
            No validators configured
          </div>
        ) : validatorsWithStake.length === 0 ? (
          <div className="text-center py-3 text-[var(--text-muted)] text-xs">
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
                {/* Compact row with thin progress bar at bottom */}
                <div className="group relative bg-[var(--bg-card-solid)]/40 hover:bg-[var(--bg-card-solid)]/60 rounded py-1.5 px-2.5 transition-colors">
                  {/* Thin progress indicator at bottom */}
                  <div className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-[var(--accent-primary)]/60 to-[var(--accent-primary)]/20 rounded-b" style={{ width: `${percentage}%` }} />

                  {/* Content row */}
                  <div className="relative flex items-center gap-1.5">
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
                        className="w-3 h-3 flex items-center justify-center flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <svg
                          className={`w-2.5 h-2.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}

                    {/* Avatar */}
                    <ValidatorAvatar imageUrl={stake.imageUrl} name={stake.name} />

                    {/* Name */}
                    <span className="font-medium text-xs text-[var(--text-primary)] truncate min-w-0 flex-shrink">
                      {stake.name}
                    </span>

                    {/* Badges inline - compact */}
                    {stake.isGroup && stake.groupCount && (
                      <span className="text-[7px] px-1 py-px rounded bg-purple-500/20 text-purple-400 font-semibold flex-shrink-0">
                        {stake.groupCount}x
                      </span>
                    )}
                    <span className="text-[7px] px-1 py-px rounded bg-blue-500/15 text-blue-400/80 mono flex-shrink-0">
                      {(stake.votingPower / 100).toFixed(1)}%
                    </span>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Amount + Share - right aligned, compact */}
                    <span className="mono text-xs font-semibold text-[var(--accent-secondary)] flex-shrink-0">
                      {formatIota(stake.totalStaked)}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)] w-9 text-right flex-shrink-0 tabular-nums">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Expanded children - ultra compact */}
                {stake.isGroup && isExpanded && stake.children && (
                  <div className="ml-3 mt-0.5 space-y-px border-l border-purple-500/30 pl-2">
                    {stake.children.map((child) => {
                      const childPercentage =
                        totalProtocolStake > 0n
                          ? Number((child.totalStaked * 10000n) / totalProtocolStake) / 100
                          : 0;
                      return (
                        <div
                          key={child.address}
                          className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-purple-500/5"
                        >
                          <ValidatorAvatar imageUrl={child.imageUrl} name={child.name} size="xs" />
                          <span className="text-[10px] text-[var(--text-secondary)] truncate">
                            {child.name}
                          </span>
                          <span className="text-[6px] px-0.5 py-px rounded bg-blue-500/10 text-blue-400/60 mono flex-shrink-0">
                            {(child.votingPower / 100).toFixed(1)}%
                          </span>
                          <div className="flex-1" />
                          <span className="mono text-[10px] text-[var(--text-muted)]">
                            {formatIota(child.totalStaked)}
                          </span>
                          <span className="text-[8px] text-[var(--text-muted)] w-8 text-right tabular-nums">
                            {childPercentage.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Collapsed validators without stake */}
        {validatorsWithoutStake.length > 0 && (
          <details className="group mt-1">
            <summary className="text-[10px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] py-1.5 list-none flex items-center gap-1">
              <svg
                className="w-2.5 h-2.5 transition-transform group-open:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {validatorsWithoutStake.length} without stake
            </summary>
            <div className="space-y-px mt-0.5 max-h-28 overflow-y-auto">
              {validatorsWithoutStake.map((stake) => (
                <div
                  key={stake.id}
                  className="flex items-center gap-1.5 py-1 px-2 rounded bg-[var(--bg-card-solid)]/20 text-[var(--text-muted)]"
                >
                  <ValidatorAvatar imageUrl={stake.imageUrl} name={stake.name} size="xs" muted />
                  <span className="text-[10px] truncate">{stake.name}</span>
                  {stake.isGroup && stake.groupCount && (
                    <span className="text-[6px] px-0.5 rounded bg-purple-500/10 text-purple-400/50 font-medium">
                      {stake.groupCount}x
                    </span>
                  )}
                  <span className="text-[6px] px-0.5 rounded bg-blue-500/10 text-blue-400/50 mono">
                    {(stake.votingPower / 100).toFixed(1)}%
                  </span>
                  <div className="flex-1" />
                  <span className="text-[9px] mono">0</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Minimal footer */}
      {validatorsWithStake.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]/50 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span>{validatorsWithStake.length} active</span>
          <span className="mono">avg {formatIota(totalProtocolStake / BigInt(Math.max(validatorsWithStake.length, 1)))}</span>
        </div>
      )}
    </div>
  );
}
