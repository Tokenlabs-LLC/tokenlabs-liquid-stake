// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - CERT (tIOTA) Token Tests

#[test_only]
module tokenlabs_liquid_stake::cert_tests {
    use iota::test_scenario::{Self as ts, Scenario};
    use iota::coin::{Self};
    use tokenlabs_liquid_stake::cert::{Self, CERT, Metadata};

    // Test addresses
    const ADMIN: address = @0xAD;

    const ONE_IOTA: u64 = 1_000_000_000;

    // ============================================
    // Helper functions
    // ============================================

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN);
        {
            cert::test_init(ts::ctx(&mut scenario));
        };
        scenario
    }

    // ============================================
    // Init tests
    // ============================================

    #[test]
    fun test_init_creates_metadata() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            // Metadata should be a shared object
            assert!(ts::has_most_recent_shared<Metadata<CERT>>(), 0);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_initial_supply_is_zero() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let metadata = ts::take_shared<Metadata<CERT>>(&scenario);
            assert!(cert::get_total_supply_value(&metadata) == 0, 0);
            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    // ============================================
    // Mint tests
    // ============================================

    #[test]
    fun test_mint_increases_supply() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 1000 tIOTA
            let mint_amount = 1000 * ONE_IOTA;
            let cert_coin = cert::mint(&mut metadata, mint_amount, ts::ctx(&mut scenario));

            // Verify supply increased
            assert!(cert::get_total_supply_value(&metadata) == mint_amount, 0);

            // Verify coin value
            assert!(coin::value(&cert_coin) == mint_amount, 1);

            // Clean up - burn the coin
            let burned = cert::burn_coin(&mut metadata, cert_coin);
            assert!(burned == mint_amount, 2);

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_multiple_mints() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // First mint: 500 tIOTA
            let coin1 = cert::mint(&mut metadata, 500 * ONE_IOTA, ts::ctx(&mut scenario));
            assert!(cert::get_total_supply_value(&metadata) == 500 * ONE_IOTA, 0);

            // Second mint: 300 tIOTA
            let coin2 = cert::mint(&mut metadata, 300 * ONE_IOTA, ts::ctx(&mut scenario));
            assert!(cert::get_total_supply_value(&metadata) == 800 * ONE_IOTA, 1);

            // Third mint: 200 tIOTA
            let coin3 = cert::mint(&mut metadata, 200 * ONE_IOTA, ts::ctx(&mut scenario));
            assert!(cert::get_total_supply_value(&metadata) == 1000 * ONE_IOTA, 2);

            // Clean up
            cert::burn_coin(&mut metadata, coin1);
            cert::burn_coin(&mut metadata, coin2);
            cert::burn_coin(&mut metadata, coin3);

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    // ============================================
    // Burn tests
    // ============================================

    #[test]
    fun test_burn_coin_decreases_supply() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 1000 tIOTA
            let cert_coin = cert::mint(&mut metadata, 1000 * ONE_IOTA, ts::ctx(&mut scenario));
            assert!(cert::get_total_supply_value(&metadata) == 1000 * ONE_IOTA, 0);

            // Burn it
            let burned = cert::burn_coin(&mut metadata, cert_coin);

            // Verify supply decreased
            assert!(cert::get_total_supply_value(&metadata) == 0, 1);
            assert!(burned == 1000 * ONE_IOTA, 2);

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_partial_burn() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 1000 tIOTA
            let mut cert_coin = cert::mint(&mut metadata, 1000 * ONE_IOTA, ts::ctx(&mut scenario));

            // Split and burn only 400
            let to_burn = coin::split(&mut cert_coin, 400 * ONE_IOTA, ts::ctx(&mut scenario));
            let burned = cert::burn_coin(&mut metadata, to_burn);

            assert!(burned == 400 * ONE_IOTA, 0);
            assert!(cert::get_total_supply_value(&metadata) == 600 * ONE_IOTA, 1);
            assert!(coin::value(&cert_coin) == 600 * ONE_IOTA, 2);

            // Clean up remaining
            cert::burn_coin(&mut metadata, cert_coin);

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    // ============================================
    // Simulation: Full staking cycle
    // ============================================

    #[test]
    fun test_simulation_staking_cycle() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // === User A stakes 1000 IOTA ===
            // (In real scenario, native_pool would call this)
            let user_a_shares = 1000 * ONE_IOTA;
            let user_a_cert = cert::mint(&mut metadata, user_a_shares, ts::ctx(&mut scenario));

            assert!(cert::get_total_supply_value(&metadata) == 1000 * ONE_IOTA, 0);

            // === User B stakes 500 IOTA ===
            let user_b_shares = 500 * ONE_IOTA;
            let user_b_cert = cert::mint(&mut metadata, user_b_shares, ts::ctx(&mut scenario));

            assert!(cert::get_total_supply_value(&metadata) == 1500 * ONE_IOTA, 1);

            // === User A unstakes all ===
            let user_a_burned = cert::burn_coin(&mut metadata, user_a_cert);
            assert!(user_a_burned == 1000 * ONE_IOTA, 2);
            assert!(cert::get_total_supply_value(&metadata) == 500 * ONE_IOTA, 3);

            // === User B unstakes all ===
            let user_b_burned = cert::burn_coin(&mut metadata, user_b_cert);
            assert!(user_b_burned == 500 * ONE_IOTA, 4);
            assert!(cert::get_total_supply_value(&metadata) == 0, 5);

            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    // ============================================
    // Edge cases
    // ============================================

    #[test]
    fun test_mint_minimum_amount() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 1 nano-tIOTA (smallest unit)
            let cert_coin = cert::mint(&mut metadata, 1, ts::ctx(&mut scenario));
            assert!(cert::get_total_supply_value(&metadata) == 1, 0);
            assert!(coin::value(&cert_coin) == 1, 1);

            cert::burn_coin(&mut metadata, cert_coin);
            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_large_supply() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut metadata = ts::take_shared<Metadata<CERT>>(&scenario);

            // Mint 100 million tIOTA
            let large_amount = 100_000_000 * ONE_IOTA;
            let cert_coin = cert::mint(&mut metadata, large_amount, ts::ctx(&mut scenario));

            assert!(cert::get_total_supply_value(&metadata) == large_amount, 0);

            cert::burn_coin(&mut metadata, cert_coin);
            ts::return_shared(metadata);
        };

        ts::end(scenario);
    }
}
