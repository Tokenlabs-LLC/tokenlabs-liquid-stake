"use client";

import { useState, useMemo, useRef } from "react";
import { useValidators } from "@/hooks/useValidators";
import { DEFAULT_VALIDATORS } from "@/lib/constants";

// IOTA validator names to check for group voting power
const IOTA_VALIDATOR_NAMES = ["IOTA 1", "IOTA 2", "IOTA 3", "IOTA 4"];
const IOTA_VALIDATOR_ADDRESSES = [
  "0xb64051fe5048486c0a215ff1ec48dc63214528bcc4d00c27d151404dbd717ba4", // IOTA 4
];

// Check if validator is part of IOTA group
function isIotaValidator(name: string, address: string): boolean {
  if (IOTA_VALIDATOR_NAMES.includes(name)) return true;
  if (IOTA_VALIDATOR_ADDRESSES.some(addr => addr.toLowerCase() === address.toLowerCase())) return true;
  if (/^IOTA \d+$/i.test(name)) return true;
  return false;
}

// Avatar component with fallback
function ValidatorAvatar({
  imageUrl,
  name,
  size = "md"
}: {
  imageUrl?: string;
  name: string;
  size?: "sm" | "md";
}) {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = size === "sm" ? "w-4 h-4 text-[8px]" : "w-4 h-4 text-[8px]";

  if (!imageUrl || hasError) {
    return (
      <div className={`${sizeClasses} rounded-full bg-[var(--accent-primary)]/30 flex items-center justify-center flex-shrink-0`}>
        <span className="font-bold text-[var(--accent-primary)]">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className={`${sizeClasses} rounded-full object-cover flex-shrink-0`}
      onError={() => setHasError(true)}
    />
  );
}

interface ValidatorSelectProps {
  selectedValidators: string[];
  onSelectionChange: (validators: string[]) => void;
  mode: "auto" | "manual";
  onModeChange: (mode: "auto" | "manual") => void;
}

// Display validator type
interface DisplayValidator {
  id: string;
  name: string;
  address: string;
  imageUrl?: string;
  votingPower: number;
  isIotaGroup: boolean; // Part of IOTA 1-4 group
  groupVotingPower: number; // Combined voting power if part of IOTA group
}

const MAX_VALIDATORS = 10;
const MAX_VOTING_POWER_PERCENT = 8; // 8% max for decentralization

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function ValidatorSelect({
  selectedValidators,
  onSelectionChange,
  mode,
  onModeChange,
}: ValidatorSelectProps) {
  const { validators, isLoading, isDefaultValidator } = useValidators();
  const [searchQuery, setSearchQuery] = useState("");

  // Store the shuffled order once, don't reshuffle on re-renders
  const shuffledOrderRef = useRef<string[] | null>(null);

  const handleModeChange = (newMode: "auto" | "manual") => {
    onModeChange(newMode);
    if (newMode === "auto") {
      onSelectionChange(DEFAULT_VALIDATORS.map((v) => v.address));
    }
  };

  // Process validators: sort by voting power and shuffle low-power ones
  const displayValidators = useMemo((): DisplayValidator[] => {
    if (validators.length === 0) return [];

    // First, calculate combined IOTA group voting power
    const iotaGroupVotingPower = validators
      .filter((v) => isIotaValidator(v.name, v.address))
      .reduce((sum, v) => sum + (v.votingPower || 0), 0);

    // Map all validators to display format
    const result: DisplayValidator[] = validators.map((v) => {
      const isIota = isIotaValidator(v.name, v.address);
      return {
        id: v.address,
        name: v.name,
        address: v.address,
        imageUrl: v.imageUrl,
        votingPower: v.votingPower || 0,
        isIotaGroup: isIota,
        groupVotingPower: isIota ? iotaGroupVotingPower : v.votingPower || 0,
      };
    });

    // Sort by voting power (descending)
    result.sort((a, b) => b.votingPower - a.votingPower);

    // Shuffle non-top validators to avoid bias (keep high voting power at top)
    // Use groupVotingPower for determining "top" validators
    if (!shuffledOrderRef.current || shuffledOrderRef.current.length !== result.length) {
      const topValidators = result.filter(
        (v) => v.groupVotingPower / 100 >= MAX_VOTING_POWER_PERCENT
      );
      const restValidators = result.filter(
        (v) => v.groupVotingPower / 100 < MAX_VOTING_POWER_PERCENT
      );
      const shuffled = shuffleArray(restValidators);
      shuffledOrderRef.current = [...topValidators, ...shuffled].map((v) => v.id);
    }

    // Apply stored order
    const orderMap = new Map(shuffledOrderRef.current.map((id, idx) => [id, idx]));
    result.sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? 999;
      const orderB = orderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });

    return result;
  }, [validators]);

  const toggleValidator = (displayValidator: DisplayValidator) => {
    const address = displayValidator.address;
    const isCurrentlySelected = selectedValidators.includes(address);

    if (isCurrentlySelected) {
      onSelectionChange(selectedValidators.filter((v) => v !== address));
    } else {
      if (selectedValidators.length >= MAX_VALIDATORS) return;
      onSelectionChange([...selectedValidators, address]);
    }
  };

  const isValidatorSelected = (displayValidator: DisplayValidator) => {
    return selectedValidators.includes(displayValidator.address);
  };

  const isAtLimit = selectedValidators.length >= MAX_VALIDATORS;

  const filteredValidators = displayValidators.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count disabled validators due to voting power (using group voting power for IOTA validators)
  const disabledByVotingPower = displayValidators.filter(
    (v) => v.groupVotingPower / 100 >= MAX_VOTING_POWER_PERCENT
  ).length;

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          type="button"
          onClick={() => handleModeChange("auto")}
          className={mode === "auto" ? "active" : ""}
        >
          Auto
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("manual")}
          className={mode === "manual" ? "active" : ""}
        >
          Manual
        </button>
      </div>

      {/* Auto Mode */}
      {mode === "auto" && (
        <div className="flex flex-wrap gap-2">
          {DEFAULT_VALIDATORS.map((v) => {
            const validatorData = validators.find(
              (val) => val.address.toLowerCase() === v.address.toLowerCase()
            );
            return (
              <div key={v.address} className="stat-chip">
                <ValidatorAvatar imageUrl={validatorData?.imageUrl} name={v.name} />
                <span className="value">{v.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Mode */}
      {mode === "manual" && (
        <div className="space-y-2.5">
          {/* Decentralization Notice */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-200/80">
              <span className="font-medium text-amber-300">Decentralization:</span>{" "}
              Validators exceeding {MAX_VOTING_POWER_PERCENT}% voting power (individually or as a group like IOTA 1-4) are disabled to promote network decentralization.
            </p>
          </div>

          {/* Search + Selected count */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-glass text-sm !py-2.5 !px-3 flex-1"
            />
            <span className={`text-xs whitespace-nowrap ${isAtLimit ? "text-amber-400" : "text-[var(--text-muted)]"}`}>
              {selectedValidators.length}/{MAX_VALIDATORS}
            </span>
            {selectedValidators.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectionChange([])}
                className="text-red-400 hover:text-red-300 transition-colors text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Validator grid */}
          <div className="max-h-52 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="text-center py-4 text-[var(--text-muted)] text-sm">
                Loading validators...
              </div>
            ) : filteredValidators.length === 0 ? (
              <div className="text-center py-4 text-[var(--text-muted)] text-sm">
                No validators found
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {filteredValidators.map((validator) => {
                  const isSelected = isValidatorSelected(validator);
                  const isDefault = isDefaultValidator(validator.address);
                  const votingPowerPercent = validator.votingPower / 100;
                  const groupVotingPowerPercent = validator.groupVotingPower / 100;
                  // Use group voting power for IOTA validators, individual for others
                  const isTooMuchPower = groupVotingPowerPercent >= MAX_VOTING_POWER_PERCENT;
                  const isDisabledByLimit = !isSelected && isAtLimit;
                  const isDisabled = isDisabledByLimit || isTooMuchPower;

                  // Build tooltip message
                  const tooltipMessage = isTooMuchPower
                    ? validator.isIotaGroup
                      ? `Disabled: IOTA group combined voting power (${groupVotingPowerPercent.toFixed(1)}%) exceeds ${MAX_VOTING_POWER_PERCENT}% limit`
                      : `Disabled: ${votingPowerPercent.toFixed(1)}% voting power exceeds ${MAX_VOTING_POWER_PERCENT}% limit`
                    : undefined;

                  return (
                    <button
                      key={validator.id}
                      type="button"
                      onClick={() => !isTooMuchPower && toggleValidator(validator)}
                      disabled={isDisabled}
                      className={`validator-card-compact flex items-center gap-1.5 ${
                        isSelected ? "selected" : ""
                      } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""} ${
                        isTooMuchPower ? "!border-red-500/30 !bg-red-900/10" : ""
                      }`}
                      title={tooltipMessage}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-3 h-3 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                          isSelected
                            ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
                            : isTooMuchPower
                            ? "border-red-500/50"
                            : "border-[var(--text-muted)]"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-2 h-2 text-[var(--bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isTooMuchPower && !isSelected && (
                          <svg className="w-2 h-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      {/* Validator Icon */}
                      <ValidatorAvatar imageUrl={validator.imageUrl} name={validator.name} />
                      {/* Name */}
                      <span className={`font-medium text-xs truncate flex-1 ${
                        isTooMuchPower ? "text-red-400/70" : "text-[var(--text-primary)]"
                      }`}>
                        {validator.name}
                      </span>
                      {/* Voting Power Badge */}
                      <span className={`text-[7px] px-1 py-0.5 rounded font-medium flex-shrink-0 mono ${
                        isTooMuchPower
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {votingPowerPercent.toFixed(1)}%
                      </span>
                      {/* Default badge */}
                      {isDefault && (
                        <span className="text-[7px] px-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] font-medium flex-shrink-0">
                          ★
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info about disabled validators */}
          {disabledByVotingPower > 0 && (
            <p className="text-[10px] text-[var(--text-muted)] text-center">
              {disabledByVotingPower} validator{disabledByVotingPower > 1 ? "s" : ""} disabled due to high voting power (&gt;{MAX_VOTING_POWER_PERCENT}% individual or group)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
