// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Validator Set Management

module tokenlabs_liquid_stake::validator_set {
    use std::vector;
    use iota::object::{Self, UID};
    use iota::vec_map::{Self, VecMap};
    use iota::tx_context::{Self, TxContext};
    use iota::object_table::{Self, ObjectTable};
    use iota::table::{Self, Table};
    use iota::iota::{IOTA};
    use iota_system::iota_system::{Self, IotaSystemState};
    use iota::event;
    use iota::balance::{Self, Balance};
    use iota_system::staking_pool::{Self, StakedIota};

    // Constants
    const MAX_VLDRS_UPDATE: u64 = 16;

    // Errors
    const E_NO_VALIDATORS: u64 = 300;
    const E_MISMATCHED_LENGTHS: u64 = 301;
    const E_NO_PRIORITY: u64 = 302;
    const E_TOO_MANY_VLDRS: u64 = 304;

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
    /// Used by stake_to_validators() to add user-chosen validators with priority 50.
    public(package) fun ensure_validator_exists(
        self: &mut ValidatorSet,
        validator: address,
        default_priority: u64
    ) {
        if (!vec_map::contains(&self.validators, &validator)) {
            vec_map::insert(&mut self.validators, validator, default_priority);
            vector::push_back(&mut self.sorted_validators, validator);
            sort_validators_internal(self);

            event::emit(ValidatorPriorUpdated { validator, priority: default_priority });
        };
        // If validator already exists, do NOT change its priority
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

    public(package) fun add_stake(self: &mut ValidatorSet, validator: address, staked: StakedIota, ctx: &mut TxContext) {
        let stake_value = staking_pool::staked_iota_amount(&staked);
        let current_epoch = tx_context::epoch(ctx);

        if (!table::contains(&self.vaults, validator)) {
            let vault = Vault {
                id: object::new(ctx),
                stakes: object_table::new<u64, StakedIota>(ctx),
                total_staked: 0,
                stake_epoch: current_epoch,
                staked_in_epoch: 0,
            };
            table::add(&mut self.vaults, validator, vault);
        };

        let vault = table::borrow_mut(&mut self.vaults, validator);

        // Track staked in epoch
        if (vault.stake_epoch != current_epoch) {
            vault.stake_epoch = current_epoch;
            vault.staked_in_epoch = 0;
        };
        vault.staked_in_epoch = vault.staked_in_epoch + stake_value;
        vault.total_staked = vault.total_staked + stake_value;

        // Add to stakes table using activation epoch as key
        let activation_epoch = staking_pool::stake_activation_epoch(&staked);
        if (object_table::contains(&vault.stakes, activation_epoch)) {
            // Merge stakes from same epoch
            let existing = object_table::remove(&mut vault.stakes, activation_epoch);
            let merged = merge_staked_iota(existing, staked, ctx);
            object_table::add(&mut vault.stakes, activation_epoch, merged);
        } else {
            object_table::add(&mut vault.stakes, activation_epoch, staked);
        };
    }

    fun merge_staked_iota(mut a: StakedIota, b: StakedIota, _ctx: &mut TxContext): StakedIota {
        // Use the framework's join function to merge staked IOTA
        staking_pool::join_staked_iota(&mut a, b);
        a
    }

    public(package) fun remove_stakes(
        self: &mut ValidatorSet,
        wrapper: &mut IotaSystemState,
        validator: address,
        amount: u64,
        ctx: &mut TxContext
    ): (Balance<IOTA>, u64, u64) {
        if (!table::contains(&self.vaults, validator)) {
            return (balance::zero<IOTA>(), 0, 0)
        };

        let vault = table::borrow_mut(&mut self.vaults, validator);
        let mut total_removed = balance::zero<IOTA>();
        let mut total_principals: u64 = 0;
        let mut total_rewards: u64 = 0;
        let mut removed_amount: u64 = 0;

        // Get all epochs from the stake table
        let current_epoch = tx_context::epoch(ctx);

        // Iterate over stakes and remove until we have enough
        // Since we can't iterate ObjectTable directly, we try epochs from 0 to current
        let mut epoch = 0;
        while (removed_amount < amount && epoch <= current_epoch) {
            if (object_table::contains(&vault.stakes, epoch)) {
                let staked = object_table::remove(&mut vault.stakes, epoch);
                let principal = staking_pool::staked_iota_amount(&staked);

                let withdrawn = iota_system::request_withdraw_stake_non_entry(wrapper, staked, ctx);
                let withdrawn_value = balance::value(&withdrawn);

                let rewards = if (withdrawn_value > principal) {
                    withdrawn_value - principal
                } else {
                    0
                };

                total_principals = total_principals + principal;
                total_rewards = total_rewards + rewards;
                removed_amount = removed_amount + withdrawn_value;

                balance::join(&mut total_removed, withdrawn);

                if (removed_amount >= amount) {
                    break
                };
            };
            epoch = epoch + 1;
        };

        vault.total_staked = if (vault.total_staked >= total_principals) {
            vault.total_staked - total_principals
        } else {
            0
        };

        (total_removed, total_principals, total_rewards)
    }

    #[test_only]
    public fun test_create(ctx: &mut TxContext): ValidatorSet {
        create(ctx)
    }
}
