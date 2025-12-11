// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Validator Set Tests

#[test_only]
module tokenlabs_liquid_stake::validator_set_tests {
    use std::vector;
    use iota::test_scenario::{Self as ts, Scenario};
    use tokenlabs_liquid_stake::validator_set::{Self, ValidatorSet};

    // Test addresses
    const ADMIN: address = @0xAD;
    const VALIDATOR_A: address = @0xA1;
    const VALIDATOR_B: address = @0xB2;
    const VALIDATOR_C: address = @0xC3;
    const VALIDATOR_D: address = @0xD4;

    // ============================================
    // Helper functions
    // ============================================

    fun setup_test(): Scenario {
        ts::begin(ADMIN)
    }

    // ============================================
    // Create tests
    // ============================================

    #[test]
    fun test_create_empty_set() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let validator_set = validator_set::test_create(ts::ctx(&mut scenario));
            let validators = validator_set::get_validators(&validator_set);

            // Should be empty initially
            assert!(vector::length(&validators) == 0, 0);

            // Clean up - transfer to make it droppable
            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // Update validators tests
    // ============================================

    #[test]
    fun test_update_validators_single() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Add single validator with priority 100
            let validators = vector[VALIDATOR_A];
            let priorities = vector[100u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            let result = validator_set::get_validators(&validator_set);
            assert!(vector::length(&result) == 1, 0);
            assert!(*vector::borrow(&result, 0) == VALIDATOR_A, 1);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_update_validators_multiple() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Add 3 validators
            let validators = vector[VALIDATOR_A, VALIDATOR_B, VALIDATOR_C];
            let priorities = vector[100u64, 200u64, 150u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            let result = validator_set::get_validators(&validator_set);
            assert!(vector::length(&result) == 3, 0);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_validators_sorted_by_priority() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Add validators with different priorities
            // A=100, B=300, C=200
            let validators = vector[VALIDATOR_A, VALIDATOR_B, VALIDATOR_C];
            let priorities = vector[100u64, 300u64, 200u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            let result = validator_set::get_validators(&validator_set);

            // Should be sorted: B(300), C(200), A(100)
            assert!(*vector::borrow(&result, 0) == VALIDATOR_B, 0); // Highest priority first
            assert!(*vector::borrow(&result, 1) == VALIDATOR_C, 1);
            assert!(*vector::borrow(&result, 2) == VALIDATOR_A, 2);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_update_existing_validator_priority() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Initial: A=100, B=200
            let validators = vector[VALIDATOR_A, VALIDATOR_B];
            let priorities = vector[100u64, 200u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            // Verify B is first (higher priority)
            let result1 = validator_set::get_validators(&validator_set);
            assert!(*vector::borrow(&result1, 0) == VALIDATOR_B, 0);

            // Update: A=300 (now higher than B)
            let validators2 = vector[VALIDATOR_A];
            let priorities2 = vector[300u64];
            validator_set::update_validators(&mut validator_set, validators2, priorities2);

            // Now A should be first
            let result2 = validator_set::get_validators(&validator_set);
            assert!(*vector::borrow(&result2, 0) == VALIDATOR_A, 1);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 301)] // E_MISMATCHED_LENGTHS
    fun test_update_validators_mismatched_lengths() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // 3 validators but only 2 priorities
            let validators = vector[VALIDATOR_A, VALIDATOR_B, VALIDATOR_C];
            let priorities = vector[100u64, 200u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 304)] // E_TOO_MANY_VLDRS
    fun test_update_validators_too_many() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Try to add 17 validators (max is 16)
            let mut validators = vector::empty<address>();
            let mut priorities = vector::empty<u64>();

            let mut i = 0u64;
            while (i < 17) {
                vector::push_back(&mut validators, @0x1); // Dummy addresses
                vector::push_back(&mut priorities, 100);
                i = i + 1;
            };

            validator_set::update_validators(&mut validator_set, validators, priorities);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // get_top_validator tests
    // ============================================

    #[test]
    fun test_get_top_validator() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // A=50, B=100, C=75
            let validators = vector[VALIDATOR_A, VALIDATOR_B, VALIDATOR_C];
            let priorities = vector[50u64, 100u64, 75u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            let top = validator_set::get_top_validator(&validator_set);
            assert!(top == VALIDATOR_B, 0); // B has highest priority

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 300)] // E_NO_VALIDATORS
    fun test_get_top_validator_empty() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Should fail - no validators
            let _top = validator_set::get_top_validator(&validator_set);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // get_bad_validators tests
    // ============================================

    #[test]
    fun test_get_bad_validators() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // First add all validators with priority > 0
            let validators = vector[VALIDATOR_A, VALIDATOR_B, VALIDATOR_C, VALIDATOR_D];
            let priorities = vector[100u64, 80u64, 50u64, 40u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            // Now update B and D to priority 0 (make them "bad")
            let bad_validators = vector[VALIDATOR_B, VALIDATOR_D];
            let bad_priorities = vector[0u64, 0u64];
            validator_set::update_validators(&mut validator_set, bad_validators, bad_priorities);

            let bad = validator_set::get_bad_validators(&validator_set);

            // B and D should be bad (priority 0)
            assert!(vector::length(&bad) == 2, 0);
            assert!(vector::contains(&bad, &VALIDATOR_B), 1);
            assert!(vector::contains(&bad, &VALIDATOR_D), 2);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_get_bad_validators_none() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // All have priority > 0
            let validators = vector[VALIDATOR_A, VALIDATOR_B];
            let priorities = vector[100u64, 50u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            let bad = validator_set::get_bad_validators(&validator_set);
            assert!(vector::length(&bad) == 0, 0);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // ensure_validator_exists tests
    // ============================================

    #[test]
    fun test_ensure_validator_exists_new() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Set starts empty
            assert!(vector::length(&validator_set::get_validators(&validator_set)) == 0, 0);

            // Ensure validator exists with default priority 50
            validator_set::ensure_validator_exists(&mut validator_set, VALIDATOR_A, 50);

            // Should now have 1 validator
            let validators = validator_set::get_validators(&validator_set);
            assert!(vector::length(&validators) == 1, 1);
            assert!(*vector::borrow(&validators, 0) == VALIDATOR_A, 2);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_ensure_validator_exists_already_exists() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Add validator with priority 100
            let validators = vector[VALIDATOR_A];
            let priorities = vector[100u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            // Try to ensure with different default priority
            validator_set::ensure_validator_exists(&mut validator_set, VALIDATOR_A, 50);

            // Priority should NOT change (still 100, not 50)
            // The validator should still be at the top since it's the only one
            let result = validator_set::get_validators(&validator_set);
            assert!(vector::length(&result) == 1, 0);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 305)] // E_VALIDATOR_BANNED
    fun test_ensure_validator_exists_banned_fails() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // First add validator with priority > 0
            let validators = vector[VALIDATOR_A];
            let priorities = vector[100u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            // Now ban the validator (set priority to 0)
            let ban_validators = vector[VALIDATOR_A];
            let ban_priorities = vector[0u64];
            validator_set::update_validators(&mut validator_set, ban_validators, ban_priorities);

            // Try to ensure_validator_exists on banned validator
            // This should FAIL with E_VALIDATOR_BANNED (305)
            validator_set::ensure_validator_exists(&mut validator_set, VALIDATOR_A, 50);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // get_total_stake tests
    // ============================================

    #[test]
    fun test_get_total_stake_no_vault() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // Validator not added yet, should return 0
            let stake = validator_set::get_total_stake(&validator_set, VALIDATOR_A);
            assert!(stake == 0, 0);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // get_staked_in_epoch tests
    // ============================================

    #[test]
    fun test_get_staked_in_epoch_no_vault() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // No vault for this validator
            let staked = validator_set::get_staked_in_epoch(&validator_set, VALIDATOR_A, 0);
            assert!(staked == 0, 0);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }

    // ============================================
    // Simulation: Validator rotation
    // ============================================

    #[test]
    fun test_simulation_validator_rotation() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut validator_set = validator_set::test_create(ts::ctx(&mut scenario));

            // === Initial setup: 3 validators ===
            let validators = vector[VALIDATOR_A, VALIDATOR_B, VALIDATOR_C];
            let priorities = vector[100u64, 100u64, 100u64];
            validator_set::update_validators(&mut validator_set, validators, priorities);

            assert!(vector::length(&validator_set::get_validators(&validator_set)) == 3, 0);

            // === Validator B underperforms: set priority to 0 ===
            let update_validators = vector[VALIDATOR_B];
            let update_priorities = vector[0u64];
            validator_set::update_validators(&mut validator_set, update_validators, update_priorities);

            // B should now be in bad validators
            let bad = validator_set::get_bad_validators(&validator_set);
            assert!(vector::length(&bad) == 1, 1);
            assert!(*vector::borrow(&bad, 0) == VALIDATOR_B, 2);

            // === Add new validator D to replace B ===
            let new_validators = vector[VALIDATOR_D];
            let new_priorities = vector[100u64];
            validator_set::update_validators(&mut validator_set, new_validators, new_priorities);

            // Now we have 4 validators (A, B with 0, C, D)
            // But B is "bad" and would be excluded from normal staking
            let all = validator_set::get_validators(&validator_set);
            assert!(vector::length(&all) == 4, 3);

            transfer::public_transfer(validator_set, ADMIN);
        };

        ts::end(scenario);
    }
}
