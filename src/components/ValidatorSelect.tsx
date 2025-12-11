"use client";

import { useState, useMemo, useRef } from "react";
import { useValidators } from "@/hooks/useValidators";
import { DEFAULT_VALIDATORS } from "@/lib/constants";
import { truncateAddress } from "@/lib/utils";

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

const MAX_VALIDATORS = 10;

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

  const toggleValidator = (address: string) => {
    if (selectedValidators.includes(address)) {
      onSelectionChange(selectedValidators.filter((v) => v !== address));
    } else {
      // Don't allow more than MAX_VALIDATORS
      if (selectedValidators.length >= MAX_VALIDATORS) return;
      onSelectionChange([...selectedValidators, address]);
    }
  };

  const isAtLimit = selectedValidators.length >= MAX_VALIDATORS;

  // Sort validators: default validators first, then rest shuffled (only once)
  const sortedValidators = useMemo(() => {
    if (validators.length === 0) return [];

    const defaultAddresses = DEFAULT_VALIDATORS.map((v) => v.address.toLowerCase());
    const defaultVals = validators.filter((v) =>
      defaultAddresses.includes(v.address.toLowerCase())
    );
    const otherVals = validators.filter(
      (v) => !defaultAddresses.includes(v.address.toLowerCase())
    );

    // Sort default validators in the order they appear in DEFAULT_VALIDATORS
    defaultVals.sort((a, b) => {
      const indexA = defaultAddresses.indexOf(a.address.toLowerCase());
      const indexB = defaultAddresses.indexOf(b.address.toLowerCase());
      return indexA - indexB;
    });

    // Only shuffle once and store the order
    if (!shuffledOrderRef.current || shuffledOrderRef.current.length !== otherVals.length) {
      const shuffled = shuffleArray(otherVals);
      shuffledOrderRef.current = shuffled.map(v => v.address);
    }

    // Sort otherVals by the stored shuffled order
    const orderMap = new Map(shuffledOrderRef.current.map((addr, idx) => [addr, idx]));
    otherVals.sort((a, b) => {
      const orderA = orderMap.get(a.address) ?? 999;
      const orderB = orderMap.get(b.address) ?? 999;
      return orderA - orderB;
    });

    return [...defaultVals, ...otherVals];
  }, [validators]);

  const filteredValidators = sortedValidators.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                  const isSelected = selectedValidators.includes(validator.address);
                  const isDefault = isDefaultValidator(validator.address);
                  const isDisabled = !isSelected && isAtLimit;

                  return (
                    <button
                      key={validator.address}
                      type="button"
                      onClick={() => toggleValidator(validator.address)}
                      disabled={isDisabled}
                      className={`validator-card-compact flex items-center gap-1.5 ${
                        isSelected ? "selected" : ""
                      } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-3 h-3 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                          isSelected
                            ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
                            : "border-[var(--text-muted)]"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-2 h-2 text-[var(--bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {/* Validator Icon */}
                      <ValidatorAvatar imageUrl={validator.imageUrl} name={validator.name} />
                      {/* Name */}
                      <span className="font-medium text-[var(--text-primary)] text-xs truncate flex-1">
                        {validator.name}
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
        </div>
      )}
    </div>
  );
}
