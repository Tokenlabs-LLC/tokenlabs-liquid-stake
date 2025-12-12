"use client";

import { usePoolData } from "@/hooks/usePoolData";
import { formatIota, formatPercent, formatRatio } from "@/lib/utils";
import { IOTA_LOGO, TIOTA_LOGO } from "@/lib/constants";

export function PoolStats() {
  const { poolState, metadata, ratio, isLoading, error } = usePoolData();

  if (isLoading) {
    return (
      <div className="glass-card px-5 py-4" role="region" aria-label="Pool statistics loading">
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 animate-pulse" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 bg-[var(--bg-card-solid)] rounded w-8" />
              <div className="h-4 bg-[var(--bg-card-solid)] rounded w-16" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading pool statistics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card px-5 py-4 border-red-500/30" role="alert">
        <p className="text-red-400 text-sm">Error loading pool data</p>
      </div>
    );
  }

  if (!poolState || !metadata) {
    return (
      <div className="glass-card px-5 py-4" role="region" aria-label="Pool statistics unavailable">
        <p className="text-[var(--text-muted)] text-sm">No pool data available</p>
      </div>
    );
  }

  // Net rewards (protect against negative values which indicate a bug)
  const netRewards = poolState.totalRewards >= poolState.collectedRewards
    ? poolState.totalRewards - poolState.collectedRewards
    : 0n;

  // TVL must match ratio calculation: totalStaked + pending + netRewards
  const tvl = poolState.totalStaked + poolState.pending + netRewards;

  return (
    <div className="glass-card px-5 py-4" role="region" aria-label="Pool statistics">
      <div className="grid grid-cols-3 gap-x-6 gap-y-2.5">
        {/* Row 1 */}
        <Stat label="TVL" value={formatIota(tvl)} unit="IOTA" logo={IOTA_LOGO} highlight />
        <Stat label="Rewards" value={formatIota(netRewards)} unit="IOTA" logo={IOTA_LOGO} />
        <Stat label="Supply" value={formatIota(metadata.totalSupply)} unit="tIOTA" logo={TIOTA_LOGO} />

        {/* Row 2 */}
        <Stat label="Rate" value={formatRatio(ratio)} />
        <Stat label="Fee" value={formatPercent(poolState.baseRewardFee)} />

        {/* Status */}
        <div className="flex items-center gap-2" role="status" aria-label={`Pool: ${poolState.paused ? "Paused" : "Active"}`}>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Status</span>
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              poolState.paused ? "bg-red-500" : "bg-emerald-500 animate-pulse"
            }`}
            aria-hidden="true"
          />
          <span className={`text-sm font-medium ${poolState.paused ? "text-red-400" : "text-emerald-400"}`}>
            {poolState.paused ? "Paused" : "Active"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  logo,
  highlight
}: {
  label: string;
  value: string;
  unit?: string;
  logo?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <span className={`mono text-sm font-medium ${highlight ? "text-[var(--accent-secondary)]" : "text-[var(--text-primary)]"}`}>
        {value}
      </span>
      {logo && <img src={logo} alt="" className="w-3.5 h-3.5 rounded-full" aria-hidden="true" />}
      {unit && <span className="text-xs text-[var(--text-muted)]">{unit}</span>}
    </div>
  );
}
