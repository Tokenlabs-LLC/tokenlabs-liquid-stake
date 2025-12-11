"use client";

import { usePoolData } from "@/hooks/usePoolData";
import { formatIota, formatPercent, formatRatio } from "@/lib/utils";
import { IOTA_LOGO, TIOTA_LOGO } from "@/lib/constants";

export function PoolStats() {
  const { poolState, metadata, ratio, isLoading, error } = usePoolData();

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex flex-wrap gap-8 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 min-w-[100px]">
              <div className="h-3 bg-[var(--bg-card-solid)] rounded w-14 mb-3" />
              <div className="h-7 bg-[var(--bg-card-solid)] rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 border-red-500/30">
        <p className="text-red-400 text-sm">Error loading pool data</p>
      </div>
    );
  }

  if (!poolState || !metadata) {
    return (
      <div className="glass-card p-6">
        <p className="text-[var(--text-muted)] text-sm">No pool data available</p>
      </div>
    );
  }

  const tvl = poolState.totalStaked + poolState.pending;
  const netRewards = poolState.totalRewards - poolState.collectedRewards;

  const stats = [
    { label: "TVL", value: formatIota(tvl), unit: "IOTA", logo: IOTA_LOGO, highlight: true },
    { label: "Rewards", value: formatIota(netRewards), unit: "IOTA", logo: IOTA_LOGO },
    { label: "Supply", value: formatIota(metadata.totalSupply), unit: "tIOTA", logo: TIOTA_LOGO },
    { label: "Rate", value: formatRatio(ratio), unit: "", logo: null },
    { label: "Fee", value: formatPercent(poolState.baseRewardFee), unit: "", logo: null },
  ];

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        {/* Stats */}
        <div className="flex flex-wrap items-center gap-10">
          {stats.map((stat, index) => (
            <div key={stat.label} className="group relative">
              {/* Decorative connector */}
              {index > 0 && (
                <div className="hidden lg:block absolute -left-5 top-1/2 -translate-y-1/2 w-px h-8 bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent" />
              )}

              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-medium mb-1.5">
                {stat.label}
              </p>
              <div className={`flex items-center gap-1.5 text-xl font-semibold transition-colors ${
                stat.highlight
                  ? "text-[var(--accent-secondary)] group-hover:text-[var(--text-primary)]"
                  : "text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]"
              }`}>
                <span className="mono">{stat.value}</span>
                {stat.logo && (
                  <img src={stat.logo} alt={stat.unit} className="w-4 h-4 rounded-full" />
                )}
                {stat.unit && (
                  <span className="text-sm text-[var(--text-muted)] font-normal">
                    {stat.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <div className={`status-dot ${poolState.paused ? "!bg-red-500 !shadow-red-500/50" : ""}`} />
          <span className={`text-sm font-semibold tracking-wide ${
            poolState.paused
              ? "text-red-400"
              : "text-[var(--accent-secondary)]"
          }`}>
            {poolState.paused ? "Paused" : "Active"}
          </span>
        </div>
      </div>
    </div>
  );
}
