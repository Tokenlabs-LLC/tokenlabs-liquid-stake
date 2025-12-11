// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Ownership Tests

#[test_only]
module tokenlabs_liquid_stake::ownership_tests {
    use iota::test_scenario::{Self as ts, Scenario};
    use tokenlabs_liquid_stake::ownership::{Self, OwnerCap, OperatorCap};

    // Test addresses
    const ADMIN: address = @0xAD;
    const USER_A: address = @0xA;
    const USER_B: address = @0xB;

    // ============================================
    // Helper functions
    // ============================================

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN);
        {
            ownership::test_init(ts::ctx(&mut scenario));
        };
        scenario
    }

    // ============================================
    // Init tests
    // ============================================

    #[test]
    fun test_init_creates_owner_cap() {
        let mut scenario = setup_test();

        // Next transaction: ADMIN should have OwnerCap
        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(ts::has_most_recent_for_sender<OwnerCap>(&scenario), 0);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_init_creates_operator_cap() {
        let mut scenario = setup_test();

        // Next transaction: ADMIN should have OperatorCap
        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(ts::has_most_recent_for_sender<OperatorCap>(&scenario), 0);
        };

        ts::end(scenario);
    }

    // ============================================
    // Transfer OwnerCap tests
    // ============================================

    #[test]
    fun test_transfer_owner_success() {
        let mut scenario = setup_test();

        // ADMIN transfers OwnerCap to USER_A
        ts::next_tx(&mut scenario, ADMIN);
        {
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);
            ownership::transfer_owner(owner_cap, USER_A, ts::ctx(&mut scenario));
        };

        // USER_A should now have OwnerCap
        ts::next_tx(&mut scenario, USER_A);
        {
            assert!(ts::has_most_recent_for_sender<OwnerCap>(&scenario), 0);
        };

        // ADMIN should no longer have OwnerCap
        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(!ts::has_most_recent_for_sender<OwnerCap>(&scenario), 1);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 100)] // E_SAME_ADDRESS
    fun test_transfer_owner_same_address_fails() {
        let mut scenario = setup_test();

        // ADMIN tries to transfer OwnerCap to self
        ts::next_tx(&mut scenario, ADMIN);
        {
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);
            ownership::transfer_owner(owner_cap, ADMIN, ts::ctx(&mut scenario));
        };

        ts::end(scenario);
    }

    // ============================================
    // Transfer OperatorCap tests
    // ============================================

    #[test]
    fun test_transfer_operator_success() {
        let mut scenario = setup_test();

        // ADMIN transfers OperatorCap to USER_A
        ts::next_tx(&mut scenario, ADMIN);
        {
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);
            ownership::transfer_operator(operator_cap, USER_A, ts::ctx(&mut scenario));
        };

        // USER_A should now have OperatorCap
        ts::next_tx(&mut scenario, USER_A);
        {
            assert!(ts::has_most_recent_for_sender<OperatorCap>(&scenario), 0);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 100)] // E_SAME_ADDRESS
    fun test_transfer_operator_same_address_fails() {
        let mut scenario = setup_test();

        // ADMIN tries to transfer OperatorCap to self
        ts::next_tx(&mut scenario, ADMIN);
        {
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);
            ownership::transfer_operator(operator_cap, ADMIN, ts::ctx(&mut scenario));
        };

        ts::end(scenario);
    }

    // ============================================
    // Chain of custody test
    // ============================================

    #[test]
    fun test_chain_of_custody() {
        let mut scenario = setup_test();

        // ADMIN -> USER_A
        ts::next_tx(&mut scenario, ADMIN);
        {
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);
            ownership::transfer_owner(owner_cap, USER_A, ts::ctx(&mut scenario));
        };

        // USER_A -> USER_B
        ts::next_tx(&mut scenario, USER_A);
        {
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);
            ownership::transfer_owner(owner_cap, USER_B, ts::ctx(&mut scenario));
        };

        // USER_B should have OwnerCap
        ts::next_tx(&mut scenario, USER_B);
        {
            assert!(ts::has_most_recent_for_sender<OwnerCap>(&scenario), 0);
        };

        // Neither ADMIN nor USER_A should have it
        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(!ts::has_most_recent_for_sender<OwnerCap>(&scenario), 1);
        };

        ts::next_tx(&mut scenario, USER_A);
        {
            assert!(!ts::has_most_recent_for_sender<OwnerCap>(&scenario), 2);
        };

        ts::end(scenario);
    }

    // ============================================
    // Separation of concerns test
    // ============================================

    #[test]
    fun test_separate_owner_and_operator() {
        let mut scenario = setup_test();

        // Transfer OwnerCap to USER_A
        ts::next_tx(&mut scenario, ADMIN);
        {
            let owner_cap = ts::take_from_sender<OwnerCap>(&scenario);
            ownership::transfer_owner(owner_cap, USER_A, ts::ctx(&mut scenario));
        };

        // Transfer OperatorCap to USER_B
        ts::next_tx(&mut scenario, ADMIN);
        {
            let operator_cap = ts::take_from_sender<OperatorCap>(&scenario);
            ownership::transfer_operator(operator_cap, USER_B, ts::ctx(&mut scenario));
        };

        // USER_A has OwnerCap only
        ts::next_tx(&mut scenario, USER_A);
        {
            assert!(ts::has_most_recent_for_sender<OwnerCap>(&scenario), 0);
            assert!(!ts::has_most_recent_for_sender<OperatorCap>(&scenario), 1);
        };

        // USER_B has OperatorCap only
        ts::next_tx(&mut scenario, USER_B);
        {
            assert!(!ts::has_most_recent_for_sender<OwnerCap>(&scenario), 2);
            assert!(ts::has_most_recent_for_sender<OperatorCap>(&scenario), 3);
        };

        ts::end(scenario);
    }
}
