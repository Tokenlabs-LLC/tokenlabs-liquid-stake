import { ONE_IOTA, DECIMALS, MAX_PERCENT } from "./constants";

/**
 * Format IOTA amount from nanos to human readable
 */
export function formatIota(nanos: bigint | number | string): string {
  const value = BigInt(nanos);
  const whole = value / ONE_IOTA;
  const fraction = value % ONE_IOTA;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(DECIMALS, '0');
  // Remove trailing zeros
  const trimmed = fractionStr.replace(/0+$/, '');
  return `${whole}.${trimmed}`;
}

/**
 * Parse IOTA amount from human readable to nanos
 */
export function parseIota(amount: string): bigint {
  const parts = amount.split('.');
  const whole = BigInt(parts[0] || '0');

  if (parts.length === 1) {
    return whole * ONE_IOTA;
  }

  const fractionStr = (parts[1] || '').slice(0, DECIMALS).padEnd(DECIMALS, '0');
  const fraction = BigInt(fractionStr);

  return whole * ONE_IOTA + fraction;
}

/**
 * Format percentage from basis points (e.g., 500 = 5.00%)
 */
export function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

/**
 * Parse percentage to basis points
 */
export function parsePercent(percent: string): number {
  return Math.round(parseFloat(percent) * 100);
}

/**
 * Format ratio (u256) to human readable exchange rate
 */
export function formatRatio(ratio: bigint): string {
  const RATIO_MAX = 1_000_000_000_000_000_000n;
  if (ratio === 0n) return "1:1";

  // ratio = supply * 1e18 / tvl
  // 1 tIOTA = tvl/supply IOTA = 1e18/ratio IOTA
  const exchangeRate = Number(RATIO_MAX) / Number(ratio);
  return `1 tIOTA = ${exchangeRate.toFixed(4)} IOTA`;
}

/**
 * Calculate tIOTA amount from IOTA using ratio
 */
export function calculateShares(iotaAmount: bigint, ratio: bigint): bigint {
  const RATIO_MAX = 1_000_000_000_000_000_000n;
  if (ratio === 0n) return iotaAmount;
  return (iotaAmount * ratio) / RATIO_MAX;
}

/**
 * Calculate IOTA amount from tIOTA using ratio
 */
export function calculateIota(shares: bigint, ratio: bigint): bigint {
  const RATIO_MAX = 1_000_000_000_000_000_000n;
  if (ratio === 0n) return shares;
  return (shares * RATIO_MAX) / ratio;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}
