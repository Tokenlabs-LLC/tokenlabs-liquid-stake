// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Validator Set Management

module tokenlabs_liquid_stake::validator_set {
    use iota::vec_map::{Self, VecMap};
    use iota::object_table::{Self, ObjectTable};
    use iota::table::{Self, Table};
    use iota::iota::IOTA;
    use iota_system::iota_system::{Self as iota_system, IotaSystemState};
    use iota::event;
    use iota::balance::{Self, Balance};
    use iota_system::staking_pool::{Self, StakedIota};

    // Constants
    const MAX_VLDRS_UPDATE: u64 = 16;

    // Errors
    const E_NO_VALIDATORS: u64 = 300;
    const E_MISMATCHED_LENGTHS: u64 = 301;
    const E_VAULT_NOT_EMPTY: u64 = 302;
    const E_VALIDATOR_NOT_FOUND: u64 = 303;
    const E_TOO_MANY_VLDRS: u64 = 304;
    const E_VALIDATOR_BANNED: u64 = 305;

    /* Events */
    public struct ValidatorPriorUpdated has copy, drop {
        validator: address,
        priority: u64
    }

    /* Objects */
    // Vault structure: id, total_staked, stake_epoch, staked_in_epoch
    public struct Vault has store, key {
        id: UID,
        stakes: ObjectTable<u64, StakedIota>,
        total_staked: u64,
        stake_epoch: u64,
        staked_in_epoch: u64,
    }

    public struct ValidatorSet has store, key {
        id: UID,
        vaults: Table<address, Vault>,
        validators: VecMap<address, u64>,
        sorted_validators: vector<address>,
    }

    public(package) fun create(ctx: &mut TxContext): ValidatorSet {
        ValidatorSet {
            id: object::new(ctx),
            vaults: table::new<address, Vault>(ctx),
            validators: vec_map::empty<address, u64>(),
            sorted_validators: vector::empty<address>(),
        }
    }

    public fun get_validators(self: &ValidatorSet): vector<address> {
        self.sorted_validators
    }

    public fun get_top_validator(self: &ValidatorSet): address {
        assert!(vector::length(&self.sorted_validators) != 0, E_NO_VALIDATORS);

        let top = *vector::borrow(&self.sorted_validators, 0);

        // Verify top validator has priority > 0
        let priority = *vec_map::get(&self.validators, &top);
        assert!(priority > 0, E_NO_VALIDATORS);

        top
    }

    public fun get_bad_validators(self: &ValidatorSet): vector<address> {
        let len = vector::length(&self.sorted_validators);
        assert!(len != 0, E_NO_VALIDATORS);

        let mut bad = vector::empty<address>();
        let mut i = 0;

        while (i < len) {
            let addr = vector::borrow(&self.sorted_validators, i);
            let priority = *vec_map::get(&self.validators, addr);
            if (priority == 0) {
                vector::push_back(&mut bad, *addr);
            };
            i = i + 1;
        };

        bad
    }

    public fun get_total_stake(self: &ValidatorSet, validator: address): u64 {
        if (!table::contains(&self.vaults, validator)) {
            return 0
        };
        let vault = table::borrow(&self.vaults, validator);
        vault.total_staked
    }

    public fun get_staked_in_epoch(self: &ValidatorSet, validator: address, epoch: u64): u64 {
        if (!table::contains(&self.vaults, validator)) {
            return 0
        };
        let vault = table::borrow(&self.vaults, validator);
        if (vault.stake_epoch != epoch) {
            return 0
        };
        vault.staked_in_epoch
    }

    public(package) fun update_validators(self: &mut ValidatorSet, validators: vector<address>, priorities: vector<u64>) {
        let len = vector::length(&validators);
        assert!(len < MAX_VLDRS_UPDATE, E_TOO_MANY_VLDRS);
        assert!(len == vector::length(&priorities), E_MISMATCHED_LENGTHS);

        let mut i = 0;
        while (i < len) {
            let validator = *vector::borrow(&validators, i);
            let priority = *vector::borrow(&priorities, i);
            update_validator(self, validator, priority);

            // Update sorted position
            let sorted_len = vector::length(&self.sorted_validators);
            let mut j = 0;
            let mut found_idx = sorted_len;

            while (j < sorted_len) {
                if (*vector::borrow(&self.sorted_validators, j) == validator) {
                    found_idx = j;
                    break
                };
                j = j + 1;
            };

            // If not found and priority > 0, add
            if (found_idx == sorted_len && priority > 0) {
                vector::push_back(&mut self.sorted_validators, validator);
            };

            i = i + 1;
        };

        // Sort validators by priority (descending)
        sort_validators_internal(self);
    }

    fun update_validator(self: &mut ValidatorSet, validator: address, priority: u64) {
        if (vec_map::contains(&self.validators, &validator)) {
            let current = vec_map::get_mut(&mut self.validators, &validator);
            *current = priority;
        } else {
            vec_map::insert(&mut self.validators, validator, priority);
        };

        event::emit(ValidatorPriorUpdated {
            validator,
            priority,
        });
    }

    /// Ensures a validator exists in the set. If not, adds it with the given default priority.
    /// If the validator already exists, does NOT change its priority.
    /// If the validator exists with priority 0 (banned), aborts with E_VALIDATOR_BANNED.
    /// Used by stake_to_validators() to add user-chosen validators with priority 50.
    public(package) fun ensure_validator_exists(
        self: &mut ValidatorSet,
        validator: address,
        default_priority: u64
    ) {
        if (!vec_map::contains(&self.validators, &validator)) {
            // New validator: add with default priority
            vec_map::insert(&mut self.validators, validator, default_priority);
            vector::push_back(&mut self.sorted_validators, validator);
            sort_validators_internal(self);

            event::emit(ValidatorPriorUpdated { validator, priority: default_priority });
        } else {
            // Existing validator: check if banned (priority 0)
            let priority = *vec_map::get(&self.validators, &validator);
            assert!(priority > 0, E_VALIDATOR_BANNED);
        };
    }

    fun sort_validators_internal(self: &mut ValidatorSet) {
        let len = vector::length(&self.sorted_validators);
        if (len <= 1) {
            return
        };

        // Simple bubble sort (adequate for small validator sets)
        let mut i = 0;
        while (i < len) {
            let mut j = i + 1;
            while (j < len) {
                let addr_i = *vector::borrow(&self.sorted_validators, i);
                let addr_j = *vector::borrow(&self.sorted_validators, j);
                let pri_i = *vec_map::get(&self.validators, &addr_i);
                let pri_j = *vec_map::get(&self.validators, &addr_j);

                if (pri_j > pri_i) {
                    vector::swap(&mut self.sorted_validators, i, j);
                };
                j = j + 1;
            };
            i = i + 1;
        };
    }

    /// Add stake to validator vault using sequential index
    public(package) fun add_stake(self: &mut ValidatorSet, validator: address, staked: StakedIota, ctx: &mut TxContext) {
        let stake_value = staking_pool::staked_iota_amount(&staked);
        let current_epoch = tx_context::epoch(ctx);

        if (!table::contains(&self.vaults, validator)) {
            let mut vault = Vault {
                id: object::new(ctx),
                stakes: object_table::new<u64, StakedIota>(ctx),
                total_staked: stake_value,
                stake_epoch: current_epoch,
                staked_in_epoch: stake_value,
            };
            // Use sequential index (0) for first stake
            let idx = object_table::length(&vault.stakes);
            object_table::add(&mut vault.stakes, idx, staked);
            table::add(&mut self.vaults, validator, vault);
        } else {
            let vault = table::borrow_mut(&mut self.vaults, validator);

            // Track staked in epoch
            if (vault.stake_epoch != current_epoch) {
                vault.stake_epoch = current_epoch;
                vault.staked_in_epoch = stake_value;
            } else {
                vault.staked_in_epoch = vault.staked_in_epoch + stake_value;
            };
            vault.total_staked = vault.total_staked + stake_value;

            // Use sequential index for new stake
            let idx = object_table::length(&vault.stakes);
            object_table::add(&mut vault.stakes, idx, staked);
        };
    }

    /// Remove stakes from validator vault using LIFO order
    /// Iterates backwards from the last stake to first
    /// Includes cleanup logic: if vault is empty and validator has priority 0, destroys vault and removes validator
    public(package) fun remove_stakes(
        self: &mut ValidatorSet,
        wrapper: &mut IotaSystemState,
        validator: address,
        amount: u64,
        ctx: &mut TxContext
    ): (Balance<IOTA>, u64, u64) {
        let mut total_removed = balance::zero<IOTA>();
        let mut total_principals: u64 = 0;

        // Early check: if no vault exists
        if (!table::contains(&self.vaults, validator)) {
            // Cleanup: if validator has priority 0 and no vault, remove from lists
            if (vec_map::contains(&self.validators, &validator)) {
                let priority = *vec_map::get(&self.validators, &validator);
                if (priority == 0) {
                    remove_validator_from_lists(self, validator);
                };
            };
            return (total_removed, 0, 0)
        };

        // Scope for mutable vault borrow
        {
            let vault = table::borrow_mut(&mut self.vaults, validator);
            let mut stakes_len = object_table::length(&vault.stakes);

            // Iterate backwards (LIFO) until we have enough
            while (stakes_len > 0 && balance::value(&total_removed) < amount) {
                let idx = stakes_len - 1;
                let staked_ref = object_table::borrow_mut(&mut vault.stakes, idx);
                let principal = staking_pool::staked_iota_amount(staked_ref);

                // Calculate how much more we need
                let needed = amount - balance::value(&total_removed);
                // Minimum stake is 1 IOTA
                let min_stake = 1_000_000_000u64;
                let actual_needed = if (needed < min_stake) { min_stake } else { needed };

                // Check if we can split this stake
                let staked_to_withdraw = if (principal > actual_needed && (principal - actual_needed) >= min_stake) {
                    // Split: take only what we need, leave the rest
                    staking_pool::split(staked_ref, actual_needed, ctx)
                } else {
                    // Remove entire stake
                    let staked = object_table::remove(&mut vault.stakes, idx);
                    stakes_len = stakes_len - 1;
                    staked
                };

                let withdrawn_principal = staking_pool::staked_iota_amount(&staked_to_withdraw);
                let withdrawn = iota_system::request_withdraw_stake_non_entry(wrapper, staked_to_withdraw, ctx);

                total_principals = total_principals + withdrawn_principal;
                balance::join(&mut total_removed, withdrawn);
            };

            // Update vault total_staked
            vault.total_staked = if (vault.total_staked >= total_principals) {
                vault.total_staked - total_principals
            } else {
                0
            };
        }; // vault borrow ends here

        // Calculate rewards (withdrawn amount - principals)
        let total_rewards = if (balance::value(&total_removed) > total_principals) {
            balance::value(&total_removed) - total_principals
        } else {
            0
        };

        // Cleanup: if vault is empty and validator has priority 0, destroy vault and remove validator
        let needs_cleanup = {
            let vault = table::borrow(&self.vaults, validator);
            let stakes_empty = object_table::length(&vault.stakes) == 0;
            let no_total_staked = vault.total_staked == 0;
            stakes_empty && no_total_staked
        };

        if (needs_cleanup) {
            let priority = *vec_map::get(&self.validators, &validator);
            if (priority == 0) {
                let vault_to_destroy = table::remove(&mut self.vaults, validator);
                destroy_vault(vault_to_destroy);
                remove_validator_from_lists(self, validator);
            };
        };

        (total_removed, total_principals, total_rewards)
    }

    /// Destroys an empty vault
    fun destroy_vault(vault: Vault) {
        let Vault { id, stakes, total_staked: _, stake_epoch: _, staked_in_epoch: _ } = vault;
        object::delete(id);
        object_table::destroy_empty(stakes);
    }

    /// Removes a validator from the validators map and sorted_validators vector
    fun remove_validator_from_lists(self: &mut ValidatorSet, validator: address) {
        // Remove from validators map
        if (vec_map::contains(&self.validators, &validator)) {
            vec_map::remove(&mut self.validators, &validator);
        };

        // Remove from sorted_validators vector
        let len = vector::length(&self.sorted_validators);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(&self.sorted_validators, i) == validator) {
                vector::remove(&mut self.sorted_validators, i);
                break
            };
            i = i + 1;
        };
    }

    #[test_only]
    public fun test_create(ctx: &mut TxContext): ValidatorSet {
        create(ctx)
    }
}
