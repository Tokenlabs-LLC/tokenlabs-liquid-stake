// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - CERT Token (tIOTA)

module tokenlabs_liquid_stake::cert {
    use iota::url::{Self, Url};
    use iota::coin::{Self, Coin};
    use iota::balance::{Self, Supply, Balance};
    use iota::event;
    use tokenlabs_liquid_stake::ownership::OwnerCap;

    // Constants
    const VERSION: u64 = 1;
    const DECIMALS: u8 = 9;

    // Errors
    const E_INCOMPATIBLE_VERSION: u64 = 1;

    /* Events */
    public struct MigratedEvent has copy, drop {
        prev_version: u64,
        new_version: u64,
    }

    /// CERT token - Certificate of staked IOTA
    public struct CERT has drop {}

    /// Metadata of CERT token
    public struct Metadata<phantom T> has key, store {
        id: UID,
        version: u64,
        total_supply: Supply<T>,
    }

    fun init(witness: CERT, ctx: &mut TxContext) {
        // Create coin with metadata
        let (treasury_cap, metadata) = coin::create_currency<CERT>(
            witness,
            DECIMALS,
            b"tIOTA",
            b"tIOTA",
            b"Tokenlabs Liquid Stake - Reward-bearing staked IOTA token",
            option::some<Url>(url::new_unsafe_from_bytes(b"https://tokenlabs.network/tIOTA.png")),
            ctx
        );
        transfer::public_freeze_object(metadata);

        // Destroy treasury_cap and store supply in custom Metadata object
        let supply = coin::treasury_into_supply(treasury_cap);

        transfer::share_object(Metadata<CERT> {
            id: object::new(ctx),
            version: VERSION,
            total_supply: supply,
        });
    }

    /* Read methods */

    public fun get_total_supply(self: &Metadata<CERT>): &Supply<CERT> {
        &self.total_supply
    }

    public fun get_total_supply_value(self: &Metadata<CERT>): u64 {
        balance::supply_value(&self.total_supply)
    }

    /* Mint/Burn - package visibility */

    public(package) fun mint(self: &mut Metadata<CERT>, amount: u64, ctx: &mut TxContext): Coin<CERT> {
        assert_version(self);
        let balance = balance::increase_supply(&mut self.total_supply, amount);
        coin::from_balance(balance, ctx)
    }

    public(package) fun burn_coin(self: &mut Metadata<CERT>, coin: Coin<CERT>): u64 {
        assert_version(self);
        let balance = coin::into_balance(coin);
        balance::decrease_supply(&mut self.total_supply, balance)
    }

    public(package) fun burn_balance(self: &mut Metadata<CERT>, balance: Balance<CERT>): u64 {
        assert_version(self);
        balance::decrease_supply(&mut self.total_supply, balance)
    }

    /* Migration */

    entry fun migrate(self: &mut Metadata<CERT>, _owner_cap: &OwnerCap) {
        assert!(self.version < VERSION, E_INCOMPATIBLE_VERSION);

        event::emit(MigratedEvent {
            prev_version: self.version,
            new_version: VERSION,
        });

        self.version = VERSION;
    }

    fun assert_version(self: &Metadata<CERT>) {
        assert!(self.version == VERSION, E_INCOMPATIBLE_VERSION);
    }

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(CERT {}, ctx);
    }
}
