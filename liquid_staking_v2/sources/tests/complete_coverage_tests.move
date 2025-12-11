// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Complete Coverage Tests
// Tests for publish_ratio, add_pending, collect_fee, burn_balance, and remaining functions

#[test_only]
module tokenlabs_liquid_stake::complete_coverage_tests {
    use iota::test_scenario::{Self as ts, Scenario};
    use iota::coin::{Self};
    use iota::iota::IOTA;
    use iota::balance;
    use tokenlabs_liquid_stake::native_pool::{Self, NativePool};
    use tokenlabs_liquid_stake::cert::{Self, CERT, Metadata};
    use tokenlabs_liquid_stake::ownership::{Self, OwnerCap, OperatorCap};
    use tokenlabs_liquid_stake::validator_set::{Self, ValidatorSet};

    // Test addresses
    const ADMIN: address = @0xAD;
    const USER_A: address = @0xA;
    const VALIDATOR_A: address = @0xA1;
    const VALIDATOR_B: address = @0xB2;

    const ONE_IOTA: u64 = 1_000_000_000;

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

    // ============================================
    // publish_ratio tests
    // ============================================

    #[test]
    fun test_publish_ratio() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Should emit RatioUpdatedEvent
            native_pool::publish_ratio(&pool, &metadata);

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_publish_ratio_after_mint() {
        let mut scenario = setup_test();

        // Mint some tIOTA
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);
            let cert_coin = cert::mint(&mut metadata, 1000 * ONE_IOTA, ts::ctx(&mut scenario));
            transfer::public_transfer(cert_coin, ADMIN);
            ts::return_shared(metadata);
        };

        // Publish ratio
        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            native_pool::publish_ratio(&pool, &metadata);

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // add_pending tests
    // ============================================

    #[test]
    fun test_add_pending() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Initial pending should be 0
            assert!(native_pool::get_pending(&pool) == 0, 0);

            // Create IOTA coin to add
            let coin = coin::mint_for_testing<IOTA>(100 * ONE_IOTA, ts::ctx(&mut scenario));

            // Add to pending
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            // Verify pending increased
            assert!(native_pool::get_pending(&pool) == 100 * ONE_IOTA, 1);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_add_pending_multiple_times() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // First add
            let coin1 = coin::mint_for_testing<IOTA>(50 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin1, &operator_cap);
            assert!(native_pool::get_pending(&pool) == 50 * ONE_IOTA, 0);

            // Second add
            let coin2 = coin::mint_for_testing<IOTA>(30 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin2, &operator_cap);
            assert!(native_pool::get_pending(&pool) == 80 * ONE_IOTA, 1);

            // Third add
            let coin3 = coin::mint_for_testing<IOTA>(20 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin3, &operator_cap);
            assert!(native_pool::get_pending(&pool) == 100 * ONE_IOTA, 2);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // collect_fee tests
    // ============================================

    #[test]
    fun test_collect_fee_when_zero() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Collect fee (should create 0 coin when no fees)
            native_pool::collect_fee(&mut pool, USER_A, &owner_cap, ts::ctx(&mut scenario));

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // burn_balance tests
    // ============================================

    #[test]
    fun test_burn_balance() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 1000 tIOTA
            let cert_coin = cert::mint(&mut metadata, 1000 * ONE_IOTA, ts::ctx(&mut scenario));
            assert!(cert::get_total_supply_value(&metadata) == 1000 * ONE_IOTA, 0);

            // Convert to balance
            let cert_balance = coin::into_balance(cert_coin);

            // Burn balance (instead of coin)
            let burned = cert::burn_balance(&mut metadata, cert_balance);
            assert!(burned == 1000 * ONE_IOTA, 1);
            assert!(cert::get_total_supply_value(&metadata) == 0, 2);

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_burn_balance_partial() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 1000 tIOTA
            let cert_coin = cert::mint(&mut metadata, 1000 * ONE_IOTA, ts::ctx(&mut scenario));

            // Convert to balance and split
            let mut cert_balance = coin::into_balance(cert_coin);
            let to_burn = balance::split(&mut cert_balance, 400 * ONE_IOTA);

            // Burn partial
            let burned = cert::burn_balance(&mut metadata, to_burn);
            assert!(burned == 400 * ONE_IOTA, 0);
            assert!(cert::get_total_supply_value(&metadata) == 600 * ONE_IOTA, 1);

            // Clean up remaining
            cert::burn_balance(&mut metadata, cert_balance);

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    // ============================================
    // get_total_supply tests
    // ============================================

    #[test]
    fun test_get_total_supply_object() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Get supply object reference
            let supply = cert::get_total_supply(&metadata);
            // Just verify it returns something (can't compare directly)

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    // ============================================
    // validator_set additional tests
    // ============================================

    #[test]
    fun test_get_top_validator_with_zero_priority() {
        let mut scenario = ts::begin(ADMIN);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Add validator with priority 100
            let validators = vector[VALIDATOR_A, VALIDATOR_B];
            let priorities = vector[100u64, 0u64]; // B has 0 priority
            validator_set::update_validators(&mut validator_set, validators, priorities);

            // Top validator should be A (highest priority > 0)
            let top = validator_set::get_top_validator(&validator_set);
            assert!(top == VALIDATOR_A, 0);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 300)] // E_NO_VALIDATORS (top has priority 0)
    fun test_get_top_validator_all_zero_priority() {
        let mut scenario = ts::begin(ADMIN);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Add validators with priority 0
            let validators = vector[VALIDATOR_A, VALIDATOR_B];
            let priorities = vector[0u64, 0u64]; // Both have 0 priority
            validator_set::update_validators(&mut validator_set, validators, priorities);

            // This should fail - top validator has priority 0
            let _top = validator_set::get_top_validator(&validator_set);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 300)] // E_NO_VALIDATORS
    fun test_get_bad_validators_empty_fails() {
        let mut scenario = ts::begin(ADMIN);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Should fail - no validators
            let _bad = validator_set::get_bad_validators(&validator_set);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_validator_priority_update_reorder() {
        let mut scenario = ts::begin(ADMIN);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Initial: A=100, B=50
            validator_set::update_validators(
                &mut validator_set,
                vector[VALIDATOR_A, VALIDATOR_B],
                vector[100u64, 50u64]
            );

            let top1 = validator_set::get_top_validator(&validator_set);
            assert!(top1 == VALIDATOR_A, 0); // A is top

            // Update: B=200 (now higher than A)
            validator_set::update_validators(
                &mut validator_set,
                vector[VALIDATOR_B],
                vector[200u64]
            );

            let top2 = validator_set::get_top_validator(&validator_set);
            assert!(top2 == VALIDATOR_B, 1); // B is now top

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // Additional native_pool tests
    // ============================================

    #[test]
    fun test_get_total_staked_includes_pending() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Initial total should be 0
            assert!(native_pool::get_total_staked(&pool) == 0, 0);

            // Add pending
            let coin = coin::mint_for_testing<IOTA>(100 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            // Total staked should now include pending
            assert!(native_pool::get_total_staked(&pool) == 100 * ONE_IOTA, 1);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_pause_multiple_times() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Pause
            native_pool::set_pause(&mut pool, &owner_cap, true);

            // Pause again (should be idempotent)
            native_pool::set_pause(&mut pool, &owner_cap, true);

            // Unpause
            native_pool::set_pause(&mut pool, &owner_cap, false);

            // Unpause again
            native_pool::set_pause(&mut pool, &owner_cap, false);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_change_min_stake_boundary() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Set to minimum valid (1001)
            native_pool::change_min_stake(&mut pool, &owner_cap, 1001);
            assert!(native_pool::get_min_stake(&pool) == 1001, 0);

            // Set to a large value
            native_pool::change_min_stake(&mut pool, &owner_cap, 1000 * ONE_IOTA);
            assert!(native_pool::get_min_stake(&pool) == 1000 * ONE_IOTA, 1);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Ratio calculation edge cases
    // ============================================

    #[test]
    fun test_ratio_with_pending_only() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            // Add pending (no supply yet)
            let coin = coin::mint_for_testing<IOTA>(100 * ONE_IOTA, ts::ctx(&mut scenario));
            native_pool::add_pending(&mut pool, coin, &operator_cap);

            // With supply = 0 and TVL > 0, ratio = 0 (supply/tvl * 1e18)
            // This is correct behavior - first staker gets shares based on 1:1 via to_shares function
            let ratio = native_pool::get_ratio(&pool, &metadata);
            assert!(ratio == 0, 0); // 0 supply / 100 TVL = 0

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_to_from_shares_roundtrip() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // With 1:1 ratio, roundtrip should be exact
            let amount = 12345 * ONE_IOTA;
            let shares = native_pool::to_shares(&pool, &metadata, amount);
            let recovered = native_pool::from_shares(&pool, &metadata, shares);

            assert!(recovered == amount, 0);

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // Simulation: Full workflow without IotaSystem
    // ============================================

    #[test]
    fun test_simulation_admin_operations_workflow() {
        let mut scenario = setup_test();

        // 1. Configure pool settings
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);

            // Set min stake to 2 IOTA
            native_pool::change_min_stake(&mut pool, &owner_cap, 2 * ONE_IOTA);

            // Set fee to 5%
            native_pool::change_base_reward_fee(&mut pool, &owner_cap, 500);

            // Set threshold to 2%
            native_pool::update_rewards_threshold(&mut pool, &owner_cap, 200);

            ts::return_to_sender(&scenario, owner_cap);
            ts::return_shared(pool);
        };

        // 2. Configure validators
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<NativePool>(&scenario);
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);

            native_pool::update_validators(
                &mut pool,
                vector[VALIDATOR_A, VALIDATOR_B],
                vector[100u64, 80u64],
                &operator_cap
            );

            let validators = native_pool::get_validators(&pool);
            assert!(vector::length(&validators) == 2, 0);

            ts::return_to_sender(&scenario, operator_cap);
            ts::return_shared(pool);
        };

        // 3. Verify configuration
        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<NativePool>(&scenario);
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            assert!(native_pool::get_min_stake(&pool) == 2 * ONE_IOTA, 0);
            assert!(native_pool::get_max_stake_per_epoch(&pool) == 50_000_000_000_000_000u64, 1);

            // Publish ratio
            native_pool::publish_ratio(&pool, &metadata);

            ts::return_shared(metadata);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    // ============================================
    // cert.move additional tests
    // ============================================

    #[test]
    fun test_mint_zero_amount() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 0 (edge case)
            let cert_coin = cert::mint(&mut metadata, 0, ts::ctx(&mut scenario));
            assert!(coin::value(&cert_coin) == 0, 0);
            assert!(cert::get_total_supply_value(&metadata) == 0, 1);

            // Clean up
            coin::destroy_zero(cert_coin);
            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_mint_large_amount() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 1 billion IOTA worth
            let large_amount = 1_000_000_000 * ONE_IOTA;
            let cert_coin = cert::mint(&mut metadata, large_amount, ts::ctx(&mut scenario));

            assert!(coin::value(&cert_coin) == large_amount, 0);
            assert!(cert::get_total_supply_value(&metadata) == large_amount, 1);

            cert::burn_coin(&mut metadata, cert_coin);
            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }
}
