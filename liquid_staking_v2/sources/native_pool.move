// SPDX-License-Identifier: MIT
// Tokenlabs Liquid Stake - Native Pool

module tokenlabs_liquid_stake::native_pool {
    use iota::balance::{Self, Balance};
    use iota::clock::{Self, Clock};
    use iota::coin::{Self, Coin};
    use iota::event;
    use iota::iota::{IOTA};
    use iota::object::{Self, UID};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use iota_system::iota_system::{Self, IotaSystemState};
    use tokenlabs_liquid_stake::cert::{Self, CERT, Metadata};
    use tokenlabs_liquid_stake::math;
    use tokenlabs_liquid_stake::ownership::{OwnerCap, OperatorCap};
    use tokenlabs_liquid_stake::validator_set::{Self, ValidatorSet};

    // Constants
    const VERSION: u64 = 1;
    const ONE_IOTA: u64 = 1_000_000_000;
    const MAX_PERCENT: u64 = 10000; // 100.00%
    const REWARD_UPDATE_DELAY: u64 = 43_200_000; // 12h in ms
    const MAX_U64: u64 = 18_446_744_073_709_551_615;
    // 50M IOTA per validator per epoch (default)
    const DEFAULT_MAX_VALIDATOR_STAKE_PER_EPOCH: u64 = 50_000_000_000_000_000;

    // Errors
    const E_INCOMPATIBLE_VERSION: u64 = 1;
    const E_MIN_LIMIT: u64 = 100;
    const E_PAUSED: u64 = 101;
    const E_LIMIT_TOO_LOW: u64 = 102;
    const E_NOTHING_TO_UNSTAKE: u64 = 103;
    const E_LESS_REWARDS: u64 = 105;
    const E_DELAY_NOT_REACHED: u64 = 106;
    const E_REWARD_NOT_IN_THRESHOLD: u64 = 107;
    const E_BURN_MISMATCH: u64 = 108;
    const E_TOO_BIG_PERCENT: u64 = 109;
    const E_NOT_ENOUGH_BALANCE: u64 = 110;
    const E_REWARDS_TOO_HIGH: u64 = 111;
    const E_NO_VALIDATORS: u64 = 112;       // Empty validators vector in stake_to_validators

    /* Events */
    public struct StakedEvent has copy, drop {
        staker: address,
        iota_amount: u64,
        cert_amount: u64
    }

    public struct UnstakedEvent has copy, drop {
        staker: address,
        cert_amount: u64,
        iota_amount: u64
    }

    public struct MinStakeChangedEvent has copy, drop {
        prev_value: u64,
        new_value: u64
    }

    public struct BaseRewardFeeChangedEvent has copy, drop {
        prev_value: u64,
        new_value: u64
    }

    public struct RewardsThresholdChangedEvent has copy, drop {
        prev_value: u64,
        new_value: u64
    }

    public struct RewardsUpdated has copy, drop {
        value: u64
    }

    public struct FeeCollectedEvent has copy, drop {
        to: address,
        value: u64
    }

    public struct PausedEvent has copy, drop {
        paused: bool
    }

    public struct MigratedEvent has copy, drop {
        prev_version: u64,
        new_version: u64
    }

    public struct RatioUpdatedEvent has copy, drop {
        ratio: u256
    }

    public struct PendingValueAddedEvent has copy, drop {
        prev_value: u64,
        new_value: u64
    }

    // Event for max_validator_stake_per_epoch changes
    public struct MaxValidatorStakePerEpochChangedEvent has copy, drop {
        prev_value: u64,
        new_value: u64
    }

    // Tokenlabs event for stake_to_validators (user-chosen validators)
    public struct StakedToValidatorsEvent has copy, drop {
        staker: address,
        validators: vector<address>,
        iota_amount: u64,
        cert_amount: u64
    }

    /* Objects */
    public struct NativePool has key {
        id: UID,
        pending: Balance<IOTA>,
        collectable_fee: Balance<IOTA>,
        validator_set: ValidatorSet,
        total_staked: u64,
        staked_update_epoch: u64,
        base_reward_fee: u64,
        version: u64,
        paused: bool,
        min_stake: u64,
        total_rewards: u64,
        collected_rewards: u64,
        rewards_threshold: u64,
        rewards_update_ts: u64,
        max_validator_stake_per_epoch: u64, // 50M IOTA default
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(NativePool {
            id: object::new(ctx),
            pending: balance::zero<IOTA>(),
            collectable_fee: balance::zero<IOTA>(),
            validator_set: validator_set::create(ctx),
            total_staked: 0,
            staked_update_epoch: 0,
            base_reward_fee: 1000, // 10.00%
            version: VERSION,
            paused: false,
            min_stake: ONE_IOTA,
            total_rewards: 0,
            collected_rewards: 0,
            rewards_threshold: 100, // 1.00%
            rewards_update_ts: 0,
            max_validator_stake_per_epoch: DEFAULT_MAX_VALIDATOR_STAKE_PER_EPOCH,
        });
    }

    /* Read methods */

    public fun get_pending(self: &NativePool): u64 {
        balance::value(&self.pending)
    }

    public fun get_total_staked(self: &NativePool): u64 {
        let pending = get_pending(self);
        self.total_staked + pending
    }

    public fun get_total_rewards(self: &NativePool): u64 {
        self.total_rewards - self.collected_rewards
    }

    fun calculate_reward_fee(self: &NativePool, value: u64): u64 {
        math::mul_div(value, self.base_reward_fee, MAX_PERCENT)
    }

    public fun get_min_stake(self: &NativePool): u64 {
        self.min_stake
    }

    public fun get_validators(self: &NativePool): vector<address> {
        validator_set::get_validators(&self.validator_set)
    }

    // Getter for max_validator_stake_per_epoch
    public fun get_max_stake_per_epoch(self: &NativePool): u64 {
        self.max_validator_stake_per_epoch
    }

    /* Update methods */

    public entry fun change_min_stake(self: &mut NativePool, _owner_cap: &OwnerCap, value: u64) {
        assert_version(self);
        assert!(value > 1000, E_LIMIT_TOO_LOW);

        event::emit(MinStakeChangedEvent {
            prev_value: self.min_stake,
            new_value: value,
        });

        self.min_stake = value;
    }

    public entry fun change_base_reward_fee(self: &mut NativePool, _owner_cap: &OwnerCap, value: u64) {
        assert_version(self);
        assert!(value < MAX_PERCENT, E_TOO_BIG_PERCENT);

        event::emit(BaseRewardFeeChangedEvent {
            prev_value: self.base_reward_fee,
            new_value: value,
        });

        self.base_reward_fee = value;
    }

    // Function to change max_validator_stake_per_epoch
    public(package) fun change_max_validator_stake_per_epoch(self: &mut NativePool, _owner_cap: &OwnerCap, value: u64) {
        event::emit(MaxValidatorStakePerEpochChangedEvent {
            prev_value: self.max_validator_stake_per_epoch,
            new_value: value,
        });

        self.max_validator_stake_per_epoch = value;
    }

    public entry fun update_validators(self: &mut NativePool, validators: vector<address>, priorities: vector<u64>, _operator_cap: &OperatorCap) {
        assert_version(self);
        when_not_paused(self);

        validator_set::update_validators(&mut self.validator_set, validators, priorities);
    }

    public entry fun update_rewards_threshold(self: &mut NativePool, _owner_cap: &OwnerCap, value: u64) {
        assert_version(self);
        when_not_paused(self);

        assert!(value > 0, E_LIMIT_TOO_LOW);
        assert!(value <= MAX_PERCENT, E_TOO_BIG_PERCENT);

        event::emit(RewardsThresholdChangedEvent {
            prev_value: self.rewards_threshold,
            new_value: value,
        });

        self.rewards_threshold = value;
    }

    public entry fun update_rewards_revert(self: &mut NativePool, value: u64, _owner_cap: &OwnerCap) {
        assert!(value < self.total_rewards, E_REWARDS_TOO_HIGH);

        let reward_diff = self.total_rewards - value;
        let reward_fee = calculate_reward_fee(self, reward_diff);
        self.collected_rewards = self.collected_rewards - reward_fee;

        set_rewards_unsafe(self, value);
    }

    public entry fun update_rewards(self: &mut NativePool, clock: &Clock, value: u64, _operator_cap: &OperatorCap) {
        assert_version(self);
        when_not_paused(self);

        assert!(value > self.total_rewards, E_LESS_REWARDS);

        let ts_now = clock::timestamp_ms(clock);
        assert!(ts_now - self.rewards_update_ts > REWARD_UPDATE_DELAY, E_DELAY_NOT_REACHED);
        self.rewards_update_ts = ts_now;

        let threshold = math::mul_div(get_total_staked(self), self.rewards_threshold, MAX_PERCENT);
        assert!(value <= self.total_rewards + threshold, E_REWARD_NOT_IN_THRESHOLD);

        let reward_diff = value - self.total_rewards;
        let reward_fee = calculate_reward_fee(self, reward_diff);
        self.collected_rewards = self.collected_rewards + reward_fee;

        set_rewards_unsafe(self, value);
    }

    public entry fun publish_ratio(self: &NativePool, metadata: &Metadata<CERT>) {
        event::emit(RatioUpdatedEvent {
            ratio: get_ratio(self, metadata),
        });
    }

    fun set_rewards_unsafe(self: &mut NativePool, value: u64) {
        self.total_rewards = value;
        event::emit(RewardsUpdated {
            value: self.total_rewards,
        });
    }

    fun sub_rewards_unsafe(self: &mut NativePool, value: u64) {
        if (value > self.total_rewards) {
            self.total_rewards = 0;
        } else {
            self.total_rewards = self.total_rewards - value;
        };
        event::emit(RewardsUpdated {
            value: self.total_rewards,
        });
    }

    /* Staking logic */

    public entry fun stake(self: &mut NativePool, metadata: &mut Metadata<CERT>, wrapper: &mut IotaSystemState, coin: Coin<IOTA>, ctx: &mut TxContext) {
        let cert_coin = stake_non_entry(self, metadata, wrapper, coin, ctx);
        transfer::public_transfer(cert_coin, tx_context::sender(ctx));
    }

    public fun stake_non_entry(self: &mut NativePool, metadata: &mut Metadata<CERT>, wrapper: &mut IotaSystemState, coin: Coin<IOTA>, ctx: &mut TxContext): Coin<CERT> {
        assert_version(self);
        when_not_paused(self);

        let coin_value = coin::value(&coin);
        assert!(coin_value >= self.min_stake, E_MIN_LIMIT);

        let shares = to_shares(self, metadata, coin_value);
        let minted = cert::mint(metadata, shares, ctx);

        // Join coin to pending (Balance)
        let coin_balance = coin::into_balance(coin);
        balance::join(&mut self.pending, coin_balance);

        event::emit(StakedEvent {
            staker: tx_context::sender(ctx),
            iota_amount: coin_value,
            cert_amount: shares,
        });

        stake_pool(self, wrapper, ctx);

        minted
    }

    /// Stake IOTA to user-chosen validators (Tokenlabs feature)
    /// Distributes stake equally among provided validators.
    /// New validators are added with PRIORITY_USER_CHOSEN (50).
    /// If validator already exists, its priority is NOT changed.
    public entry fun stake_to_validators(
        self: &mut NativePool,
        metadata: &mut Metadata<CERT>,
        wrapper: &mut IotaSystemState,
        validators: vector<address>,
        coin: Coin<IOTA>,
        ctx: &mut TxContext
    ) {
        let cert_coin = stake_to_validators_non_entry(self, metadata, wrapper, validators, coin, ctx);
        transfer::public_transfer(cert_coin, tx_context::sender(ctx));
    }

    /// Non-entry version of stake_to_validators for composability
    public fun stake_to_validators_non_entry(
        self: &mut NativePool,
        metadata: &mut Metadata<CERT>,
        wrapper: &mut IotaSystemState,
        validators: vector<address>,
        coin: Coin<IOTA>,
        ctx: &mut TxContext
    ): Coin<CERT> {
        assert_version(self);
        when_not_paused(self);

        let len = vector::length(&validators);
        assert!(len > 0, E_NO_VALIDATORS);

        let coin_value = coin::value(&coin);
        let per_amount = coin_value / (len as u64);
        assert!(per_amount >= self.min_stake, E_MIN_LIMIT);

        // Calculate shares and mint tIOTA (same ratio calculation as stake())
        let shares = to_shares(self, metadata, coin_value);
        let minted = cert::mint(metadata, shares, ctx);

        // Convert coin to balance for splitting
        let mut coin_balance = coin::into_balance(coin);
        let mut j = 0;

        // Stake to each validator equally
        while (j < len) {
            let validator = *vector::borrow(&validators, j);
            let stake_balance = balance::split(&mut coin_balance, per_amount);
            let stake_coin = coin::from_balance(stake_balance, ctx);

            // Stake directly to the chosen validator
            let staked = iota_system::request_add_stake_non_entry(wrapper, stake_coin, validator, ctx);

            // Ensure validator exists in our set (adds with priority 50 if new)
            validator_set::ensure_validator_exists(&mut self.validator_set, validator, 50);

            // Record the stake
            validator_set::add_stake(&mut self.validator_set, validator, staked, ctx);
            self.total_staked = self.total_staked + per_amount;

            j = j + 1;
        };

        // Remainder goes to pending (will be staked on next stake_pool call)
        if (balance::value(&coin_balance) > 0) {
            balance::join(&mut self.pending, coin_balance);
        } else {
            balance::destroy_zero(coin_balance);
        };

        event::emit(StakedToValidatorsEvent {
            staker: tx_context::sender(ctx),
            validators,
            iota_amount: coin_value,
            cert_amount: shares,
        });

        minted
    }

    public entry fun add_pending(self: &mut NativePool, coin: Coin<IOTA>, _operator_cap: &OperatorCap) {
        let prev_value = balance::value(&self.pending);

        let coin_balance = coin::into_balance(coin);
        balance::join(&mut self.pending, coin_balance);

        event::emit(PendingValueAddedEvent {
            prev_value,
            new_value: balance::value(&self.pending),
        });
    }

    // Stake pending to validators - WITH max_validator_stake_per_epoch limit
    fun stake_pool(self: &mut NativePool, wrapper: &mut IotaSystemState, ctx: &mut TxContext) {
        let mut pending_value = balance::value(&self.pending);

        if (pending_value < ONE_IOTA) {
            return
        };

        let current_epoch = tx_context::epoch(ctx);
        let validators = validator_set::get_validators(&self.validator_set);
        let validators_len = vector::length(&validators);
        let mut i = 0;

        // Iterate over validators by priority (sorted_validators is already sorted by priority desc)
        while (pending_value >= ONE_IOTA && i < validators_len) {
            let validator = *vector::borrow(&validators, i);

            // Check how much this validator has already received this epoch
            let staked_in_epoch = validator_set::get_staked_in_epoch(&self.validator_set, validator, current_epoch);

            // Skip if validator has reached max stake for this epoch
            if (staked_in_epoch >= self.max_validator_stake_per_epoch) {
                i = i + 1;
                continue
            };

            // Calculate how much we can stake to this validator
            let available_for_validator = self.max_validator_stake_per_epoch - staked_in_epoch;
            let stake_amount = if (pending_value > available_for_validator) {
                available_for_validator
            } else {
                pending_value
            };

            // Ensure minimum stake
            if (stake_amount < ONE_IOTA) {
                i = i + 1;
                continue
            };

            // Stake to this validator
            let stake_balance = balance::split(&mut self.pending, stake_amount);
            let stake_coin = coin::from_balance(stake_balance, ctx);

            let staked_iota = iota_system::request_add_stake_non_entry(wrapper, stake_coin, validator, ctx);
            validator_set::add_stake(&mut self.validator_set, validator, staked_iota, ctx);

            self.total_staked = self.total_staked + stake_amount;
            pending_value = pending_value - stake_amount;

            i = i + 1;
        };
    }

    /* Unstaking logic */

    public entry fun unstake(self: &mut NativePool, wrapper: &mut IotaSystemState, metadata: &mut Metadata<CERT>, cert_coin: Coin<CERT>, ctx: &mut TxContext) {
        let unstaked_iota = unstake_non_entry(self, wrapper, metadata, cert_coin, ctx);
        transfer::public_transfer(unstaked_iota, tx_context::sender(ctx));
    }

    public fun unstake_non_entry(self: &mut NativePool, wrapper: &mut IotaSystemState, metadata: &mut Metadata<CERT>, cert_coin: Coin<CERT>, ctx: &mut TxContext): Coin<IOTA> {
        assert_version(self);
        when_not_paused(self);

        let shares = coin::value(&cert_coin);
        let unstake_amount = from_shares(self, metadata, shares);

        assert!(unstake_amount >= ONE_IOTA, E_MIN_LIMIT);

        // Burn shares
        let burned = cert::burn_coin(metadata, cert_coin);
        assert!(burned == shares, E_BURN_MISMATCH);

        let staker = tx_context::sender(ctx);
        event::emit(UnstakedEvent {
            staker,
            cert_amount: shares,
            iota_amount: unstake_amount,
        });

        let validators = validator_set::get_validators(&self.validator_set);
        let unstaked_iota = unstake_amount_from_validators(self, wrapper, unstake_amount, validators, ctx);

        assert!(coin::value(&unstaked_iota) == unstake_amount, E_NOTHING_TO_UNSTAKE);

        unstaked_iota
    }

    fun unstake_amount_from_validators(
        self: &mut NativePool,
        wrapper: &mut IotaSystemState,
        amount_to_unstake: u64,
        validators: vector<address>,
        ctx: &mut TxContext
    ): Coin<IOTA> {
        assert!(vector::length(&validators) > 0, E_NOTHING_TO_UNSTAKE);

        let mut i = vector::length(&validators) - 1;
        let mut total_removed_value = balance::value(&self.pending);

        // Take from pending first
        let take_from_pending = if (total_removed_value < amount_to_unstake) {
            total_removed_value
        } else {
            amount_to_unstake
        };

        let mut total_removed_balance = balance::split(&mut self.pending, take_from_pending);
        total_removed_value = take_from_pending;

        let mut collectable_reward: u64 = 0;

        while (total_removed_value < amount_to_unstake) {
            let vldr_address = *vector::borrow(&validators, i);

            let (removed_balance, principals, rewards) = validator_set::remove_stakes(
                &mut self.validator_set,
                wrapper,
                vldr_address,
                amount_to_unstake - total_removed_value,
                ctx,
            );

            self.total_staked = self.total_staked - principals;
            let reward_fee = calculate_reward_fee(self, rewards);
            collectable_reward = collectable_reward + reward_fee;
            sub_rewards_unsafe(self, rewards);

            balance::join(&mut total_removed_balance, removed_balance);
            total_removed_value = balance::value(&total_removed_balance) - collectable_reward;

            if (i == 0) {
                break
            };
            i = i - 1;
        };

        // Limit collectable_reward
        if (collectable_reward > self.collected_rewards) {
            collectable_reward = self.collected_rewards;
            self.collected_rewards = 0;
        } else {
            self.collected_rewards = self.collected_rewards - collectable_reward;
        };

        // Extract fees
        assert!(balance::value(&total_removed_balance) >= collectable_reward, E_NOT_ENOUGH_BALANCE);
        let fee_balance = balance::split(&mut total_removed_balance, collectable_reward);
        balance::join(&mut self.collectable_fee, fee_balance);

        // Restake excess
        if (total_removed_value > amount_to_unstake) {
            let excess = total_removed_value - amount_to_unstake;
            let excess_balance = balance::split(&mut total_removed_balance, excess);
            let excess_coin = coin::from_balance(excess_balance, ctx);
            let excess_back = coin::into_balance(excess_coin);
            balance::join(&mut self.pending, excess_back);

            stake_pool(self, wrapper, ctx);
        };

        coin::from_balance(total_removed_balance, ctx)
    }

    public entry fun rebalance(self: &mut NativePool, wrapper: &mut IotaSystemState, ctx: &mut TxContext) {
        assert_version(self);
        when_not_paused(self);

        let validators = validator_set::get_bad_validators(&self.validator_set);
        let unstaked_iota = unstake_amount_from_validators(self, wrapper, MAX_U64, validators, ctx);

        let unstaked_balance = coin::into_balance(unstaked_iota);
        balance::join(&mut self.pending, unstaked_balance);

        stake_pool(self, wrapper, ctx);
    }

    /* Ratio */

    public fun get_ratio(self: &NativePool, metadata: &Metadata<CERT>): u256 {
        math::ratio(cert::get_total_supply_value(metadata), get_total_staked(self) + get_total_rewards(self))
    }

    public fun to_shares(self: &NativePool, metadata: &Metadata<CERT>, amount: u64): u64 {
        math::to_shares(get_ratio(self, metadata), amount)
    }

    public fun from_shares(self: &NativePool, metadata: &Metadata<CERT>, shares: u64): u64 {
        math::from_shares(get_ratio(self, metadata), shares)
    }

    /* Fee collection */

    public entry fun collect_fee(self: &mut NativePool, to: address, _owner_cap: &OwnerCap, ctx: &mut TxContext) {
        let value = balance::value(&self.collectable_fee);
        let fee_balance = balance::split(&mut self.collectable_fee, value);
        let fee_coin = coin::from_balance(fee_balance, ctx);
        transfer::public_transfer(fee_coin, to);

        event::emit(FeeCollectedEvent {
            to,
            value,
        });
    }

    /* Pause */

    public entry fun set_pause(self: &mut NativePool, _owner_cap: &OwnerCap, val: bool) {
        self.paused = val;
        event::emit(PausedEvent { paused: val });
    }

    fun when_not_paused(self: &NativePool) {
        assert!(!self.paused, E_PAUSED);
    }

    /* Migration */

    entry fun migrate(self: &mut NativePool, _owner_cap: &OwnerCap) {
        assert!(self.version < VERSION, E_INCOMPATIBLE_VERSION);

        event::emit(MigratedEvent {
            prev_version: self.version,
            new_version: VERSION,
        });

        self.version = VERSION;
    }

    fun assert_version(self: &NativePool) {
        assert!(self.version == VERSION - 1 || self.version == VERSION, E_INCOMPATIBLE_VERSION);
    }

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }
}
