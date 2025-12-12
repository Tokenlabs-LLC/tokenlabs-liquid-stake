import { ONE_IOTA, DECIMALS, MAX_PERCENT } from "./constants";

// ============================================
// Constants
// ============================================

/** Maximum u64 value for overflow protection */
export const MAX_U64 = 18_446_744_073_709_551_615n;

/** Ratio denominator (1e18 for 18 decimal precision) */
export const RATIO_MAX = 1_000_000_000_000_000_000n;

// ============================================
// Parse Result Type for Better Error Handling
// ============================================

export type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

// ============================================
// Formatting Functions
// ============================================

/**
 * Format IOTA amount from nanos to human readable
 * @param nanos - Amount in nanos (bigint, number, or string)
 * @returns Formatted string (e.g., "1.5" for 1.5 IOTA)
 */
export function formatIota(nanos: bigint | number | string): string {
  try {
    const value = BigInt(nanos);

    // Handle negative values gracefully (indicates bug elsewhere)
    if (value < 0n) {
      console.warn("[formatIota] Received negative value:", value.toString());
      return "0";
    }

    const whole = value / ONE_IOTA;
    const fraction = value % ONE_IOTA;

    if (fraction === 0n) {
      return whole.toString();
    }

    const fractionStr = fraction.toString().padStart(DECIMALS, "0");
    // Remove trailing zeros
    const trimmed = fractionStr.replace(/0+$/, "");
    return `${whole}.${trimmed}`;
  } catch (e) {
    console.warn("[formatIota] Failed to parse:", nanos, e);
    return "0";
  }
}

/**
 * Format percentage from basis points
 * @param basisPoints - Fee in basis points (e.g., 500 = 5%)
 * @returns Formatted string with % symbol
 */
export function formatPercent(basisPoints: number): string {
  // Clamp to valid range
  const clamped = Math.max(0, Math.min(basisPoints, MAX_PERCENT));
  if (clamped !== basisPoints) {
    console.warn("[formatPercent] Clamped value:", basisPoints, "->", clamped);
  }
  return `${(clamped / 100).toFixed(2)}%`;
}

/**
 * Format ratio to human readable exchange rate
 * Uses BigInt arithmetic to prevent precision loss
 * @param ratio - The ratio value (supply * 1e18 / tvl)
 * @returns Exchange rate string (e.g., "1 tIOTA = 1.0526 IOTA")
 */
export function formatRatio(ratio: bigint): string {
  if (ratio === 0n) return "1:1";

  // ratio = supply * 1e18 / tvl
  // 1 tIOTA = tvl/supply IOTA = 1e18/ratio IOTA
  // Use BigInt arithmetic with 4 decimal places precision (multiply by 10000)
  const PRECISION = 10000n;
  const exchangeRateBigInt = (RATIO_MAX * PRECISION) / ratio;

  const whole = exchangeRateBigInt / PRECISION;
  const fractional = exchangeRateBigInt % PRECISION;

  // Format with 4 decimal places
  const fractionalStr = fractional.toString().padStart(4, "0");
  return `1 tIOTA = ${whole}.${fractionalStr} IOTA`;
}

// ============================================
// Parsing Functions with Result Type
// ============================================

/**
 * Parse IOTA amount with explicit error handling
 * @param amount - User input string
 * @returns ParseResult with value or error message
 */
export function tryParseIota(amount: string): ParseResult<bigint> {
  try {
    const trimmed = amount.trim();

    if (!trimmed) {
      return { success: false, error: "Amount is required" };
    }

    // Validate format: only digits and at most one decimal point
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      return { success: false, error: "Invalid format. Use numbers only (e.g., 1.5)" };
    }

    const parts = trimmed.split(".");

    if (parts.length > 2) {
      return { success: false, error: "Invalid format: multiple decimal points" };
    }

    const whole = BigInt(parts[0] || "0");

    if (parts.length === 1) {
      const result = whole * ONE_IOTA;
      if (result > MAX_U64) {
        return { success: false, error: "Amount too large" };
      }
      return { success: true, value: result };
    }

    // Handle decimals - truncate to 9 places
    const fractionStr = (parts[1] || "").slice(0, DECIMALS).padEnd(DECIMALS, "0");
    const fraction = BigInt(fractionStr);

    const result = whole * ONE_IOTA + fraction;

    if (result > MAX_U64) {
      return { success: false, error: "Amount too large" };
    }

    return { success: true, value: result };
  } catch (e) {
    return { success: false, error: "Invalid amount" };
  }
}

/**
 * Parse IOTA amount from human readable to nanos
 * Returns 0n for invalid input (safe default for backward compatibility)
 * Use tryParseIota() for explicit error handling
 */
export function parseIota(amount: string): bigint {
  const result = tryParseIota(amount);
  if (result.success) {
    return result.value;
  }
  // Log warning for debugging but return safe default
  if (amount.trim()) {
    console.warn("[parseIota]", result.error, "- input:", amount);
  }
  return 0n;
}

/**
 * Parse percentage to basis points with explicit error handling
 * @param percent - User input string (e.g., "5.5" for 5.5%)
 * @returns ParseResult with value or error message
 */
export function tryParsePercent(percent: string): ParseResult<number> {
  const trimmed = percent.trim();

  if (!trimmed) {
    return { success: false, error: "Percentage is required" };
  }

  const value = parseFloat(trimmed);

  if (isNaN(value) || !isFinite(value)) {
    return { success: false, error: "Invalid percentage" };
  }

  if (value < 0) {
    return { success: false, error: "Percentage cannot be negative" };
  }

  if (value > 100) {
    return { success: false, error: "Percentage cannot exceed 100%" };
  }

  const result = Math.round(value * 100);
  return { success: true, value: result };
}

/**
 * Parse percentage to basis points
 * Returns 0 for invalid input (safe default)
 */
export function parsePercent(percent: string): number {
  const result = tryParsePercent(percent);
  if (result.success) {
    return result.value;
  }
  if (percent.trim()) {
    console.warn("[parsePercent]", result.error, "- input:", percent);
  }
  return 0;
}

// ============================================
// Calculation Functions
// ============================================

/**
 * Calculate tIOTA shares from IOTA amount using ratio
 * @param iotaAmount - Amount of IOTA in nanos
 * @param ratio - Current ratio (supply * 1e18 / tvl)
 * @returns Amount of tIOTA shares
 */
export function calculateShares(iotaAmount: bigint, ratio: bigint): bigint {
  if (ratio === 0n) return iotaAmount;
  return (iotaAmount * ratio) / RATIO_MAX;
}

/**
 * Calculate IOTA amount from tIOTA shares using ratio
 * @param shares - Amount of tIOTA shares
 * @param ratio - Current ratio (supply * 1e18 / tvl)
 * @returns Amount of IOTA in nanos
 */
export function calculateIota(shares: bigint, ratio: bigint): bigint {
  if (ratio === 0n) return shares;
  return (shares * RATIO_MAX) / ratio;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Truncate address for display
 * @param address - Full address string
 * @param chars - Number of characters to show at start/end (default: 6)
 * @returns Truncated address (e.g., "0x1234...5678")
 */
export function truncateAddress(address: string, chars = 6): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format timestamp to relative time
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2h ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 0) return "just now";

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 0) return `${seconds}s ago`;
  return "just now";
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Check if a string is a valid IOTA address format
 * @param address - Address string to validate
 * @returns true if valid format
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return /^0x[0-9a-fA-F]{64}$/.test(address);
}

/**
 * Check if a bigint is within valid u64 range
 * @param value - Value to check
 * @returns true if valid
 */
export function isValidU64(value: bigint): boolean {
  return value >= 0n && value <= MAX_U64;
}

/**
 * Validate and clamp a number to a range
 * @param value - Value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
