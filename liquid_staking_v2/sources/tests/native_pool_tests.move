// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Native Pool Tests

#[test_only]
module tokenlabs_liquid_stake::native_pool_tests {
    use iota::test_scenario::{Self as ts, Scenario};
    use iota::coin::{Self};
    use iota::iota::IOTA;
    use tokenlabs_liquid_stake::native_pool::{Self, NativePool};
    use tokenlabs_liquid_stake::cert::{Self, CERT, Metadata};
    use tokenlabs_liquid_stake::ownership::{Self, OwnerCap, OperatorCap};

    // Test addresses
    const ADMIN: address = @0xAD;
    const USER_A: address = @0xA;
    const USER_B: address = @0xB;
    const VALIDATOR_A: address = @0xA1;
    const VALIDATOR_B: address = @0xB2;

    const ONE_IOTA: u64 = 1_000_000_000;

    // ============================================
    // Helper functions
    // ============================================

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN);

        // Initialize all modules
        {
            native_pool::test_init(ts::ctx(&mut scenario));
            cert::test_init(ts::ctx(&mut scenario));
            ownership::test_init(ts::ctx(&mut scenario));
        };

        scenario
    }

    // ============================================
    // Init tests
    // ============================================

    #[test]
    fun test_init_creates_native_pool() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(ts::has_most_recent_shared<NativePool>(), 0);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_initial_state() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);

            // Check initial values
            assert!(native_pool::get_pending(&pool) == 0, 0);
            assert!(native_pool::get_total_staked(&pool) == 0, 1);
            assert!(native_pool::get_total_rewards(&pool) == 0, 2);
            assert!(native_pool::get_min_stake(&pool) == ONE_IOTA, 3);

            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Admin functions tests
    // ============================================

    #[test]
    fun test_change_min_stake() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Initial min_stake is 1 IOTA
            assert!(native_pool::get_min_stake(&pool) == ONE_IOTA, 0);

            // Change to 2 IOTA
            native_pool::change_min_stake(&mut pool, &owner_cap, 2 * ONE_IOTA);
            assert!(native_pool::get_min_stake(&pool) == 2 * ONE_IOTA, 1);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 102)] // E_LIMIT_TOO_LOW
    fun test_change_min_stake_too_low() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Try to set min_stake to 1000 (must be > 1000)
            native_pool::change_min_stake(&mut pool, &owner_cap, 1000);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_change_base_reward_fee() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Change to 5% (500/10000)
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 500);

            // Verify (no getter, but it should emit event)
            // The fee change is internal, we trust the function works

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 109)] // E_TOO_BIG_PERCENT
    fun test_change_base_reward_fee_too_high() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Try to set 100% fee (must be < 10000)
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 10000);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Pause tests
    // ============================================

    #[test]
    fun test_pause_unpause() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Pause
            native_pool::set_pause(&mut pool, &owner_cap, true);

            // Unpause
            native_pool::set_pause(&mut pool, &owner_cap, false);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Update validators tests
    // ============================================

    #[test]
    fun test_update_validators() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Add validators
            let validators = vector[VALIDATOR_A, VALIDATOR_B];
            let priorities = vector[100u64, 200u64];
            native_pool::update_validators(&mut pool, validators, priorities, &operator_cap);

            // Verify
            let result = native_pool::get_validators(&pool);
            assert!(vector::length(&result) == 2, 0);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Ratio tests
    // ============================================

    #[test]
    fun test_ratio_initial() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // With empty pool, ratio should be max (1:1)
            let ratio = native_pool::get_ratio(&pool, &metadata);
            assert!(ratio == 1_000_000_000_000_000_000u256, 0); // RATIO_MAX

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // to_shares / from_shares tests
    // ============================================

    #[test]
    fun test_to_shares_initial() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // With 1:1 ratio, 100 IOTA = 100 tIOTA
            let shares = native_pool::to_shares(&pool, &metadata, 100 * ONE_IOTA);
            assert!(shares == 100 * ONE_IOTA, 0);

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_from_shares_initial() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // With 1:1 ratio, 100 tIOTA = 100 IOTA
            let amount = native_pool::from_shares(&pool, &metadata, 100 * ONE_IOTA);
            assert!(amount == 100 * ONE_IOTA, 0);

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Rewards threshold tests
    // ============================================

    #[test]
    fun test_update_rewards_threshold() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Change threshold to 2% (200/10000)
            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 200);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 102)] // E_LIMIT_TOO_LOW
    fun test_update_rewards_threshold_zero() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Try to set threshold to 0 (must be > 0)
            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 0);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 109)] // E_TOO_BIG_PERCENT
    fun test_update_rewards_threshold_too_high() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Try to set threshold > 100%
            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 10001);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Max validator stake per epoch tests
    // ============================================

    #[test]
    fun test_get_max_stake_per_epoch() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);

            // Default is 50M IOTA
            let max = native_pool::get_max_stake_per_epoch(&pool);
            assert!(max == 50_000_000_000_000_000u64, 0);

            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Simulation: Full lifecycle without IotaSystem
    // (Testing what we can without actual staking)
    // ============================================

    #[test]
    fun test_simulation_ratio_calculation() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Simulate what would happen if we had:
            // - 1000 tIOTA supply
            // - 1100 IOTA TVL (1000 staked + 100 rewards)

            // Initial ratio (empty pool) is 1:1
            let initial_ratio = native_pool::get_ratio(&pool, &metadata);

            // User would stake 100 IOTA
            let stake_amount = 100 * ONE_IOTA;
            let shares = native_pool::to_shares(&pool, &metadata, stake_amount);

            // With 1:1 ratio, should get 100 tIOTA
            assert!(shares == stake_amount, 0);

            // If user unstakes immediately, should get same amount back
            let unstake_amount = native_pool::from_shares(&pool, &metadata, shares);
            assert!(unstake_amount == stake_amount, 1);

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Access control tests
    // ============================================

    // Note: These tests verify that functions require the right capability
    // The actual rejection of unauthorized callers is enforced by Move's
    // type system (you can't call a function without having the Cap)

    #[test]
    fun test_owner_cap_required_for_admin_functions() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // All these require OwnerCap
            native_pool::change_min_stake(&mut pool, &owner_cap, 2 * ONE_IOTA);
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 500);
            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 200);
            native_pool::set_pause(&mut pool, &owner_cap, false);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_operator_cap_required_for_operator_functions() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // update_validators requires OperatorCap
            let validators = vector[VALIDATOR_A];
            let priorities = vector[100u64];
            native_pool::update_validators(&mut pool, validators, priorities, &operator_cap);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Edge case: Empty validators
    // ============================================

    #[test]
    fun test_empty_validators_initially() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);

            let validators = native_pool::get_validators(&pool);
            assert!(vector::length(&validators) == 0, 0);

            ts::return_shared(pool);
        };

        ts::end(scenario);
    }
}
