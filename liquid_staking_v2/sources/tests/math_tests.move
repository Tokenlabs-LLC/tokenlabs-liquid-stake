// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Math Tests

#[test_only]
module tokenlabs_liquid_stake::math_tests {
    use tokenlabs_liquid_stake::math;

    // Constants from math.move
    const RATIO_MAX: u256 = 1_000_000_000_000_000_000; // 1e18
    const ONE_IOTA: u64 = 1_000_000_000; // 1 IOTA = 1e9 nanos

    // ============================================
    // mul_div tests
    // ============================================

    #[test]
    fun test_mul_div_basic() {
        // 10 * 5 / 2 = 25
        assert!(math::mul_div(10, 5, 2) == 25, 0);

        // 100 * 50 / 100 = 50
        assert!(math::mul_div(100, 50, 100) == 50, 1);

        // 1000 * 1 / 1 = 1000
        assert!(math::mul_div(1000, 1, 1) == 1000, 2);
    }

    #[test]
    fun test_mul_div_large_numbers() {
        // Test with IOTA amounts
        let one_million_iota = 1_000_000 * ONE_IOTA;
        let fee_percent = 800; // 8%
        let max_percent = 10000;

        // Calculate 8% fee on 1M IOTA
        let fee = math::mul_div(one_million_iota, fee_percent, max_percent);
        assert!(fee == 80_000 * ONE_IOTA, 0); // 80,000 IOTA
    }

    #[test]
    #[expected_failure(abort_code = 500)] // E_DIVIDE_BY_ZERO
    fun test_mul_div_divide_by_zero() {
        math::mul_div(100, 50, 0);
    }

    #[test]
    fun test_mul_div_zero_numerator() {
        // 0 * 100 / 50 = 0
        assert!(math::mul_div(0, 100, 50) == 0, 0);
    }

    // ============================================
    // ratio tests
    // ============================================

    #[test]
    fun test_ratio_one_to_one() {
        // When supply == tvl, ratio should be 1e18 (1:1)
        let supply = 1000 * ONE_IOTA;
        let tvl = 1000 * ONE_IOTA;
        let ratio = math::ratio(supply, tvl);
        assert!(ratio == RATIO_MAX, 0); // 1:1 ratio
    }

    #[test]
    fun test_ratio_zero_tvl() {
        // When tvl is 0, should return RATIO_MAX
        let ratio = math::ratio(1000, 0);
        assert!(ratio == RATIO_MAX, 0);
    }

    #[test]
    fun test_ratio_with_rewards() {
        // supply = 1000 tIOTA, tvl = 1100 IOTA (100 rewards)
        // ratio = 1000/1100 * 1e18 = 0.909... * 1e18
        let supply = 1000 * ONE_IOTA;
        let tvl = 1100 * ONE_IOTA; // +10% rewards
        let ratio = math::ratio(supply, tvl);

        // ratio should be less than 1e18 (rewards accumulated)
        assert!(ratio < RATIO_MAX, 0);

        // Expected: ~909090909090909090 (0.909... * 1e18)
        let expected_approx = 909_090_909_090_909_090u256;
        let diff = if (ratio > expected_approx) { ratio - expected_approx } else { expected_approx - ratio };
        assert!(diff < 1_000_000_000u256, 1); // Allow small rounding error
    }

    // ============================================
    // to_shares tests
    // ============================================

    #[test]
    fun test_to_shares_one_to_one() {
        // With 1:1 ratio, 100 IOTA = 100 tIOTA
        let ratio = RATIO_MAX; // 1:1
        let amount = 100 * ONE_IOTA;
        let shares = math::to_shares(ratio, amount);
        assert!(shares == amount, 0);
    }

    #[test]
    fun test_to_shares_with_rewards() {
        // If ratio < 1 (rewards accumulated), user gets fewer shares
        // ratio = 0.9 (supply/tvl = 900/1000)
        let ratio = 900_000_000_000_000_000u256; // 0.9 * 1e18
        let amount = 100 * ONE_IOTA;
        let shares = math::to_shares(ratio, amount);

        // Should get ~90 tIOTA for 100 IOTA
        let expected = 90 * ONE_IOTA;
        assert!(shares == expected, 0);
    }

    #[test]
    fun test_to_shares_minimum_one() {
        // Even very small amounts should get at least 1 share
        let ratio = RATIO_MAX;
        let tiny_amount = 1u64; // 1 nano-IOTA
        let shares = math::to_shares(ratio, tiny_amount);
        assert!(shares >= 1, 0);
    }

    #[test]
    fun test_to_shares_zero_amount() {
        let ratio = RATIO_MAX;
        let shares = math::to_shares(ratio, 0);
        assert!(shares == 0, 0);
    }

    // ============================================
    // from_shares tests
    // ============================================

    #[test]
    fun test_from_shares_one_to_one() {
        // With 1:1 ratio, 100 tIOTA = 100 IOTA
        let ratio = RATIO_MAX;
        let shares = 100 * ONE_IOTA;
        let amount = math::from_shares(ratio, shares);
        assert!(amount == shares, 0);
    }

    #[test]
    fun test_from_shares_with_rewards() {
        // If ratio < 1, each share is worth more IOTA
        // ratio = 0.9 means 90 tIOTA represents 100 IOTA
        let ratio = 900_000_000_000_000_000u256; // 0.9 * 1e18
        let shares = 90 * ONE_IOTA;
        let amount = math::from_shares(ratio, shares);

        // Should get ~100 IOTA for 90 tIOTA
        let expected = 100 * ONE_IOTA;
        assert!(amount == expected, 0);
    }

    #[test]
    #[expected_failure(abort_code = 500)] // E_DIVIDE_BY_ZERO
    fun test_from_shares_zero_ratio() {
        math::from_shares(0, 1000);
    }

    // ============================================
    // Round-trip tests (to_shares -> from_shares)
    // ============================================

    #[test]
    fun test_roundtrip_one_to_one() {
        let ratio = RATIO_MAX;
        let original_amount = 1000 * ONE_IOTA;

        let shares = math::to_shares(ratio, original_amount);
        let recovered_amount = math::from_shares(ratio, shares);

        assert!(recovered_amount == original_amount, 0);
    }

    #[test]
    fun test_roundtrip_with_rewards() {
        // Test roundtrip with rewards (ratio < 1)
        // Note: There may be small rounding errors
        let supply = 1000 * ONE_IOTA;
        let tvl = 1100 * ONE_IOTA;
        let ratio = math::ratio(supply, tvl);

        let original_amount = 100 * ONE_IOTA;
        let shares = math::to_shares(ratio, original_amount);
        let recovered_amount = math::from_shares(ratio, shares);

        // Allow 1 nano-IOTA rounding error
        let diff = if (recovered_amount > original_amount) {
            recovered_amount - original_amount
        } else {
            original_amount - recovered_amount
        };
        assert!(diff <= 1, 0);
    }

    // ============================================
    // Simulation: Staking scenario
    // ============================================

    #[test]
    fun test_simulation_staking_scenario() {
        // Initial state: Pool empty
        let mut total_supply = 0u64;
        let mut total_staked = 0u64;
        let total_rewards = 0u64;

        // User A stakes 1000 IOTA
        let user_a_deposit = 1000 * ONE_IOTA;
        let ratio_a = math::ratio(total_supply, total_staked + total_rewards);
        // First stake with empty pool gets 1:1
        let user_a_shares = if (total_supply == 0) { user_a_deposit } else { math::to_shares(ratio_a, user_a_deposit) };

        total_supply = total_supply + user_a_shares;
        total_staked = total_staked + user_a_deposit;

        assert!(user_a_shares == 1000 * ONE_IOTA, 0);
        assert!(total_supply == 1000 * ONE_IOTA, 1);

        // Rewards accrue: +100 IOTA (10%)
        let total_rewards = 100 * ONE_IOTA;

        // User B stakes 1000 IOTA
        let user_b_deposit = 1000 * ONE_IOTA;
        let ratio_b = math::ratio(total_supply, total_staked + total_rewards);
        let user_b_shares = math::to_shares(ratio_b, user_b_deposit);

        total_supply = total_supply + user_b_shares;
        total_staked = total_staked + user_b_deposit;

        // User B should get fewer shares because of accumulated rewards
        // ratio = 1000 / 1100 = 0.909...
        // shares = 1000 * 0.909... = ~909 tIOTA
        assert!(user_b_shares < user_a_shares, 2);

        // User A unstakes all
        let ratio_unstake = math::ratio(total_supply, total_staked + total_rewards);
        let user_a_receives = math::from_shares(ratio_unstake, user_a_shares);

        // User A should receive more than deposited (has share of rewards)
        assert!(user_a_receives > user_a_deposit, 3);
    }

    // ============================================
    // Edge cases
    // ============================================

    #[test]
    fun test_large_amounts() {
        // Test with very large amounts (100M IOTA)
        let large_amount = 100_000_000 * ONE_IOTA;
        let ratio = RATIO_MAX;

        let shares = math::to_shares(ratio, large_amount);
        let recovered = math::from_shares(ratio, shares);

        assert!(shares == large_amount, 0);
        assert!(recovered == large_amount, 1);
    }

    #[test]
    fun test_precision_small_rewards() {
        // Test with 0.01% rewards
        let supply = 1_000_000 * ONE_IOTA;
        let tvl = 1_000_100 * ONE_IOTA; // +0.01%
        let ratio = math::ratio(supply, tvl);

        // Ratio should be slightly less than 1e18
        assert!(ratio < RATIO_MAX, 0);
        assert!(ratio > RATIO_MAX - RATIO_MAX / 100, 1); // Within 1%
    }
}
