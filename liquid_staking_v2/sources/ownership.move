// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Ownership (OwnerCap + OperatorCap)

module tokenlabs_liquid_stake::ownership {
    use iota::event;

    // Errors
    const E_SAME_ADDRESS: u64 = 100;

    /* Objects */
    public struct OwnerCap has key {
        id: UID,
    }

    public struct OperatorCap has key {
        id: UID,
    }

    /* Events */
    public struct OwnerCapTransferred has copy, drop {
        from: address,
        to: address
    }

    public struct OperatorCapTransferred has copy, drop {
        from: address,
        to: address
    }

    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        transfer::transfer(OwnerCap {
            id: object::new(ctx),
        }, sender);

        transfer::transfer(OperatorCap {
            id: object::new(ctx),
        }, sender);
    }

    /// Transfer OwnerCap - validates sender != to
    public entry fun transfer_owner(cap: OwnerCap, to: address, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender != to, E_SAME_ADDRESS);

        transfer::transfer(cap, to);

        event::emit(OwnerCapTransferred {
            from: sender,
            to,
        });
    }

    /// Transfer OperatorCap - validates sender != to
    public entry fun transfer_operator(cap: OperatorCap, to: address, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender != to, E_SAME_ADDRESS);

        transfer::transfer(cap, to);

        event::emit(OperatorCapTransferred {
            from: sender,
            to,
        });
    }

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }
}
