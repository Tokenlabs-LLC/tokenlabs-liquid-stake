// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Math utilities

module tokenlabs_liquid_stake::math {

    // Errors
    const E_DIVIDE_BY_ZERO: u64 = 500;
    const E_U64_OVERFLOW: u64 = 501;
    const E_RATIO_OVERFLOW: u64 = 502;

    // Constants
    const RATIO_MAX: u256 = 1_000_000_000_000_000_000; // 1e18
    const U64_MAX: u128 = 18_446_744_073_709_551_615;

    /// Overflow-safe multiplication and division: x * y / z
    public fun mul_div(x: u64, y: u64, z: u64): u64 {
        assert!(z != 0, E_DIVIDE_BY_ZERO);
        let result = ((x as u128) * (y as u128)) / (z as u128);
        assert!(result <= U64_MAX, E_U64_OVERFLOW);
        (result as u64)
    }

    /// Calculate ratio: supply * 1e18 / tvl
    public fun ratio(supply: u64, tvl: u64): u256 {
        if (tvl == 0) {
            return RATIO_MAX
        };
        let ratio = ((supply as u256) * RATIO_MAX) / (tvl as u256);
        assert!(ratio <= RATIO_MAX, E_RATIO_OVERFLOW);
        ratio
    }

    /// Convert IOTA to tIOTA shares
    public fun to_shares(ratio: u256, amount: u64): u64 {
        let mut shares = ((amount as u256) * ratio) / RATIO_MAX;
        assert!(shares <= (U64_MAX as u256), E_U64_OVERFLOW);

        // Ensure at least 1 share if amount > 0
        if (amount > 0 && shares == 0) {
            shares = 1;
        };

        (shares as u64)
    }

    /// Convert tIOTA shares to IOTA
    public fun from_shares(ratio: u256, shares: u64): u64 {
        assert!(ratio != 0, E_DIVIDE_BY_ZERO);
        let amount = ((shares as u256) * RATIO_MAX) / ratio;
        assert!(amount <= (U64_MAX as u256), E_U64_OVERFLOW);
        (amount as u64)
    }
}
