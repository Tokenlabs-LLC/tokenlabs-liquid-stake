"use client";

import { useProtocolStakes } from "@/hooks/useProtocolStakes";
import { useValidators } from "@/hooks/useValidators";
import { formatIota, truncateAddress } from "@/lib/utils";
import { DEFAULT_VALIDATORS, IOTA_LOGO } from "@/lib/constants";

export function ProtocolStakes() {
  const { stakes, totalProtocolStake, isLoading, error } = useProtocolStakes();
  const { validators: allValidators } = useValidators();

  // Create a map of validator addresses to names
  const validatorNames = new Map<string, string>();

  // Add default validators
  for (const v of DEFAULT_VALIDATORS) {
    validatorNames.set(v.address.toLowerCase(), v.name);
  }

  // Add from system validators
  for (const v of allValidators) {
    if (!validatorNames.has(v.address.toLowerCase())) {
      validatorNames.set(v.address.toLowerCase(), v.name);
    }
  }

  const getValidatorName = (address: string) => {
    return validatorNames.get(address.toLowerCase()) || truncateAddress(address, 6);
  };

  const isDefaultValidator = (address: string) => {
    return DEFAULT_VALIDATORS.some(
      (v) => v.address.toLowerCase() === address.toLowerCase()
    );
  };

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
  const validatorsWithStake = stakes.filter((s) => s.totalStaked > 0n);
  const validatorsWithoutStake = stakes.filter((s) => s.totalStaked === 0n);

  return (
    <div className="glass-card p-5 h-full flex flex-col">
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

            return (
              <div
                key={stake.address}
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
                    <span className="font-medium text-sm text-[var(--text-primary)]">
                      {getValidatorName(stake.address)}
                    </span>
                    {isDefaultValidator(stake.address) && (
                      <span className="text-[8px] px-1 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] font-medium">
                        ★
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mono text-sm font-semibold text-[var(--accent-secondary)]">
                      {formatIota(stake.totalStaked)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] w-10 text-right">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
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
                  key={stake.address}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-[var(--bg-card-solid)]/30 text-[var(--text-muted)]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">
                      {getValidatorName(stake.address)}
                    </span>
                    {isDefaultValidator(stake.address) && (
                      <span className="text-[7px] px-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                        ★
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mono">0 IOTA</span>
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
