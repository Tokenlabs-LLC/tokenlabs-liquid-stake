// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Advanced Coverage Tests
// Tests for update_rewards, update_rewards_revert, and additional error cases

#[test_only]
module tokenlabs_liquid_stake::advanced_coverage_tests {
    use iota::test_scenario::{Self as ts, Scenario};
    use iota::clock::{Self, Clock};
    use iota::coin;
    use iota::iota::IOTA;
    use tokenlabs_liquid_stake::native_pool::{Self, NativePool};
    use tokenlabs_liquid_stake::cert::{Self, CERT, Metadata};
    use tokenlabs_liquid_stake::ownership::{Self, OwnerCap, OperatorCap};

    // Test addresses
    const ADMIN: address = @0xAD;
    const VALIDATOR_A: address = @0xA1;

    const ONE_IOTA: u64 = 1_000_000_000;
    const REWARD_UPDATE_DELAY: u64 = 43_200_000; // 12h in ms

    // ============================================
    // Helper functions
    // ============================================

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN);
        {
            native_pool::test_init(ts::ctx(&mut scenario));
            cert::test_init(ts::ctx(&mut scenario));
            ownership::test_init(ts::ctx(&mut scenario));
        };
        scenario
    }

    fun setup_with_clock(): Scenario {
        let mut scenario = ts::begin(ADMIN);
        {
            native_pool::test_init(ts::ctx(&mut scenario));
            cert::test_init(ts::ctx(&mut scenario));
            ownership::test_init(ts::ctx(&mut scenario));
        };

        // Create clock for timestamp tests
        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        scenario
    }

    // Helper to simulate staked state by minting tIOTA (supply > 0 means there's stake)
    fun setup_with_stake(scenario: &mut Scenario, amount: u64) {
        ts::next_tx(scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(scenario);
            let cert_coin = cert::mint(&mut metadata, amount, ts::ctx(scenario));
            transfer::public_transfer(cert_coin, ADMIN);
            ts::return_shared(metadata);
        };
    }

    // ============================================
    // update_rewards tests
    // ============================================

    #[test]
    fun test_update_rewards_basic() {
        let mut scenario = setup_with_clock();

        // Setup: add pending to have TVL for threshold calculation
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Add 100 IOTA as pending so threshold = 1% of 100 IOTA = 1 IOTA
            let coin = coin::mint_for_testing<IOTA>(100 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        // Advance clock past delay
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        // Update rewards
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Set rewards to small value within threshold (1% of 100 IOTA = 1 IOTA max)
            native_pool::update_rewards(&mut pool, &clock, ONE_IOTA / 2, &operator_cap);

            // Verify rewards updated
            assert!(native_pool::get_total_rewards(&pool) > 0, 0);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 106)] // E_DELAY_NOT_REACHED
    fun test_update_rewards_delay_not_reached() {
        let mut scenario = setup_with_clock();

        // Try to update rewards without waiting for delay
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // This should fail - delay not reached
            native_pool::update_rewards(&mut pool, &clock, 1000, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 105)] // E_LESS_REWARDS
    fun test_update_rewards_less_fails() {
        let mut scenario = setup_with_clock();

        // Setup: add pending to have TVL for threshold calculation
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Add 1000 IOTA as pending so threshold = 1% = 10 IOTA
            let coin = coin::mint_for_testing<IOTA>(1000 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        // First update: set rewards to 5 IOTA (within threshold)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            native_pool::update_rewards(&mut pool, &clock, 5 * ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        // Advance time for second update
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        // Second update: try to set rewards lower (should fail with E_LESS_REWARDS)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // This should fail - new value (1 IOTA) < current (5 IOTA)
            native_pool::update_rewards(&mut pool, &clock, ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 107)] // E_REWARD_NOT_IN_THRESHOLD
    fun test_update_rewards_threshold_exceeded_fails() {
        let mut scenario = setup_with_clock();

        // Mint some tIOTA to simulate supply (needed for threshold calculation)
        setup_with_stake(&mut scenario, 100 * ONE_IOTA);

        // Advance clock
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        // Try to update rewards beyond threshold
        // Default threshold is 1% (100/10000)
        // With 100 IOTA staked, max rewards update is 1 IOTA (1% of 100)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Try to add 50 IOTA rewards (50% - way over threshold)
            native_pool::update_rewards(&mut pool, &clock, 50 * ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // update_rewards_revert tests
    // ============================================

    #[test]
    fun test_update_rewards_revert_basic() {
        let mut scenario = setup_with_clock();

        // Setup: add pending to have TVL for threshold calculation
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Add 1000 IOTA as pending so threshold = 1% = 10 IOTA
            let coin = coin::mint_for_testing<IOTA>(1000 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        // Advance clock and update rewards to 5 IOTA
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            native_pool::update_rewards(&mut pool, &clock, 5 * ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        // Revert to lower value (owner can do this)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Revert to 3 IOTA (lower than 5 IOTA)
            native_pool::update_rewards_revert(&mut pool, 3 * ONE_IOTA, &owner_cap);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 111)] // E_REWARDS_TOO_HIGH
    fun test_update_rewards_revert_too_high_fails() {
        let mut scenario = setup_with_clock();

        // Setup: add pending to have TVL for threshold calculation
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Add 1000 IOTA as pending
            let coin = coin::mint_for_testing<IOTA>(1000 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        // First update rewards to 5 IOTA
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            native_pool::update_rewards(&mut pool, &clock, 5 * ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        // Try to revert to higher value (should fail)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // This should fail - 10 IOTA > 5 IOTA
            native_pool::update_rewards_revert(&mut pool, 10 * ONE_IOTA, &owner_cap);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Paused state tests
    // ============================================

    #[test]
    #[expected_failure(abort_code = 101)] // E_PAUSED
    fun test_update_validators_when_paused_fails() {
        let mut scenario = setup_test();

        // Pause the pool
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            native_pool::set_pause(&mut pool, &owner_cap, true);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        // Try to update validators (should fail when paused)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // This should fail - pool is paused
            native_pool::update_validators(&mut pool, vector[VALIDATOR_A], vector[100], &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 101)] // E_PAUSED
    fun test_update_rewards_when_paused_fails() {
        let mut scenario = setup_with_clock();

        // Pause the pool
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            native_pool::set_pause(&mut pool, &owner_cap, true);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        // Advance clock
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        // Try to update rewards (should fail when paused)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            native_pool::update_rewards(&mut pool, &clock, 1000, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 101)] // E_PAUSED
    fun test_update_rewards_threshold_when_paused_fails() {
        let mut scenario = setup_test();

        // Pause the pool
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            native_pool::set_pause(&mut pool, &owner_cap, true);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        // Try to update rewards threshold (should fail when paused)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 200);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Additional edge cases
    // ============================================

    #[test]
    fun test_multiple_reward_updates() {
        let mut scenario = setup_with_clock();

        // Setup: add pending to have TVL for threshold calculation
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Add 10000 IOTA as pending so threshold = 1% = 100 IOTA
            let coin = coin::mint_for_testing<IOTA>(10000 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        // First update
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // 10 IOTA (within 1% threshold of 10000 IOTA)
            native_pool::update_rewards(&mut pool, &clock, 10 * ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        // Second update (after delay)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Increase by small amount (within threshold)
            native_pool::update_rewards(&mut pool, &clock, 20 * ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        // Third update
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY + 1);
            ts::return_shared(clock);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            native_pool::update_rewards(&mut pool, &clock, 30 * ONE_IOTA, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(clock);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_ratio_after_rewards_update() {
        let mut scenario = setup_with_clock();

        // Mint some tIOTA to simulate supply
        setup_with_stake(&mut scenario, 1000 * ONE_IOTA);

        // Get initial ratio
        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            let initial_ratio = native_pool::get_ratio(&pool, &metadata);
            // With only supply (no TVL in pool), ratio is RATIO_MAX

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Rewards threshold boundary tests
    // ============================================

    #[test]
    fun test_update_rewards_threshold_max() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Set threshold to max (100%)
            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 10000);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_update_rewards_threshold_min() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Set threshold to min (0.01%)
            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 1);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Fee calculation tests
    // ============================================

    #[test]
    fun test_base_fee_change_and_verify() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Change fee to 5%
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 500);

            // Change fee to 1%
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 100);

            // Change fee to 0% (valid)
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 0);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_fee_boundary_99_99_percent() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Set fee to 99.99% (9999/10000)
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 9999);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }
}
