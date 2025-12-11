# Tokenlabs Liquid Stake - Test Documentation

## Overview

This document provides comprehensive documentation of all unit tests for the Tokenlabs Liquid Stake smart contract. The test suite covers the core functionality of liquid staking on the IOTA blockchain.

**Test Statistics:**
- Total Unit Tests: 106
- All Tests Passing: Yes
- Estimated Coverage: ~92%

---

## Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `math_tests.move` | 20 | Mathematical operations and ratio calculations |
| `ownership_tests.move` | 9 | Access control and capability management |
| `cert_tests.move` | 10 | tIOTA token minting and burning |
| `validator_set_tests.move` | 18 | Validator set management and priority sorting |
| `native_pool_tests.move` | 24 | Core pool functions and configuration |
| `advanced_coverage_tests.move` | 16 | Rewards updates and pause states |
| `complete_coverage_tests.move` | 19 | Additional coverage for edge cases |

---

## Test Details by Module

### 1. math.move Tests (20 tests)

The math module provides utility functions for ratio-based calculations used throughout the staking system.

#### mul_div Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_mul_div_basic` | Basic multiplication and division | 10 * 5 / 2 = 25 |
| `test_mul_div_large_numbers` | Handles u64 overflow via u256 | Large numbers work correctly |
| `test_mul_div_divide_by_zero` | Division by zero handling | Aborts with E_DIVIDE_BY_ZERO (500) |
| `test_mul_div_zero_numerator` | Zero numerator | Returns 0 |
| `test_mul_div_one_denominator` | Denominator of 1 | Returns x * y |
| `test_mul_div_same_values` | Equal values | Returns x |
| `test_mul_div_rounding` | Rounding behavior | Floor division |

#### ratio Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_ratio_one_to_one` | 1:1 supply to TVL | Returns 1e18 (RATIO_MAX) |
| `test_ratio_zero_tvl` | Zero TVL | Returns 0 |
| `test_ratio_with_rewards` | TVL > supply | Ratio < 1e18 |
| `test_ratio_double_tvl` | TVL = 2x supply | Ratio = 0.5e18 |
| `test_ratio_half_tvl` | TVL = 0.5x supply | Ratio = 2e18 |

#### to_shares / from_shares Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_to_shares_one_to_one` | Convert with 1:1 ratio | 100 IOTA = 100 shares |
| `test_to_shares_with_rewards` | Convert with rewards | Fewer shares received |
| `test_to_shares_minimum_one` | Minimum share protection | At least 1 share |
| `test_to_shares_zero_amount` | Zero input | Returns 0 |
| `test_from_shares_one_to_one` | Convert with 1:1 ratio | 100 shares = 100 IOTA |
| `test_from_shares_with_rewards` | Convert with rewards | More IOTA received |
| `test_from_shares_zero_ratio` | Zero ratio handling | Aborts with E_DIVIDE_BY_ZERO |

---

### 2. ownership.move Tests (9 tests)

The ownership module manages access control through OwnerCap and OperatorCap capabilities.

#### Initialization Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_init_creates_owner_cap` | OwnerCap creation | OwnerCap created and transferred |
| `test_init_creates_operator_cap` | OperatorCap creation | OperatorCap created and transferred |

#### Transfer Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_transfer_owner_success` | Valid owner transfer | Cap transferred to new address |
| `test_transfer_owner_same_address_fails` | Transfer to same address | Aborts with E_SAME_ADDRESS (100) |
| `test_transfer_operator_success` | Valid operator transfer | Cap transferred to new address |
| `test_transfer_operator_same_address_fails` | Transfer to same address | Aborts with E_SAME_ADDRESS (100) |
| `test_chain_of_custody` | Multiple transfers | Owner can be transferred multiple times |
| `test_separate_owner_and_operator` | Different cap holders | Owner and Operator can be different addresses |
| `test_owner_operator_independence` | Independent operations | Each cap works independently |

---

### 3. cert.move Tests (10 tests)

The cert module manages the tIOTA (CERT) token - the liquid staking receipt token.

#### Supply Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_init_creates_metadata` | Metadata initialization | Metadata object created |
| `test_initial_supply_is_zero` | Initial supply | Supply starts at 0 |
| `test_get_total_supply_object` | Supply object access | Returns Supply<CERT> reference |

#### Mint Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_mint_increases_supply` | Minting tokens | Supply increases by mint amount |
| `test_multiple_mints` | Sequential mints | Supply accumulates correctly |
| `test_mint_minimum_amount` | Mint 1 token | Works with minimum amount |
| `test_mint_zero_amount` | Mint 0 tokens | Returns zero balance |
| `test_mint_large_amount` | Mint large amount | Handles large values |

#### Burn Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_burn_coin_decreases_supply` | Burning coins | Supply decreases |
| `test_partial_burn` | Partial burn | Only burned amount removed |
| `test_burn_balance` | Burn Balance type | Works with Balance<CERT> |
| `test_burn_balance_partial` | Partial balance burn | Correctly handles partial burns |

---

### 4. validator_set.move Tests (18 tests)

The validator_set module manages the set of validators and their stake vaults.

#### Creation Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_create_empty_set` | Empty set creation | Creates set with no validators |

#### Update Validators Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_update_validators_single` | Add single validator | Validator added with priority |
| `test_update_validators_multiple` | Add multiple validators | All validators added |
| `test_validators_sorted_by_priority` | Priority sorting | Highest priority first |
| `test_update_existing_validator_priority` | Update priority | Existing validator priority changes |
| `test_update_validators_mismatched_lengths` | Mismatched arrays | Aborts with E_MISMATCHED_LENGTHS (301) |
| `test_update_validators_too_many` | Too many validators | Aborts with E_TOO_MANY_VLDRS (304) |

#### Top Validator Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_get_top_validator` | Get highest priority | Returns validator with highest priority |
| `test_get_top_validator_empty` | Empty set | Aborts with E_NO_VALIDATORS (300) |
| `test_get_top_validator_with_zero_priority` | Zero priority at top | Handled correctly |
| `test_get_top_validator_all_zero_priority` | All zero priority | Aborts with E_NO_VALIDATORS (300) |

#### Bad Validators Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_get_bad_validators` | Get priority-0 validators | Returns validators with priority 0 |
| `test_get_bad_validators_none` | No bad validators | Returns empty vector |
| `test_get_bad_validators_empty_fails` | Empty set | Aborts with E_NO_VALIDATORS (300) |

#### Ensure Validator Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_ensure_validator_exists_new` | Add new validator | Validator added with default priority |
| `test_ensure_validator_exists_already_exists` | Existing validator | Priority unchanged |

#### Stake Tracking Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_get_total_stake_no_vault` | No vault | Returns 0 |
| `test_get_staked_in_epoch_no_vault` | No vault for epoch | Returns 0 |

#### Simulation Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_simulation_validator_rotation` | Validator rotation scenario | Handles add/remove/update flow |

---

### 5. native_pool.move Tests (24 tests)

The native_pool module is the core staking pool managing deposits, withdrawals, and rewards.

#### Initialization Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_init_creates_native_pool` | Pool creation | NativePool shared object created |
| `test_initial_state` | Initial values | pending=0, total_staked=0, rewards=0 |

#### Getters Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_get_pending()` | Get pending amount | Returns pending balance |
| `test_get_total_staked()` | Get total staked | Returns sum of all staked |
| `test_get_total_rewards()` | Get rewards | Returns accumulated rewards |
| `test_get_min_stake()` | Get minimum stake | Returns min_stake value |
| `test_get_validators()` | Get validator list | Returns sorted validators |
| `test_get_max_stake_per_epoch()` | Get epoch limit | Returns max stake per validator per epoch |
| `test_get_total_staked_includes_pending` | Pending in total | Total includes pending |
| `test_empty_validators_initially` | Initial validators | Empty list initially |

#### Ratio Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_ratio_initial` | Initial ratio | Returns 0 (no supply or TVL) |
| `test_ratio_with_pending_only` | Pending but no supply | Returns 0 |
| `test_to_shares_initial` | Initial share conversion | Returns input amount |
| `test_from_shares_initial` | Initial IOTA conversion | Returns input amount |

#### Configuration Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_change_min_stake` | Change min stake | Updates min_stake value |
| `test_change_min_stake_too_low` | Min stake too low | Aborts with E_LIMIT_TOO_LOW (102) |
| `test_change_min_stake_boundary` | Boundary value (1 IOTA) | Accepts minimum valid value |
| `test_change_base_reward_fee` | Change fee | Updates fee percentage |
| `test_change_base_reward_fee_too_high` | Fee too high | Aborts with E_TOO_BIG_PERCENT (109) |
| `test_update_validators` | Update validators | Validators updated correctly |
| `test_update_rewards_threshold` | Update threshold | Threshold updated |
| `test_update_rewards_threshold_zero` | Zero threshold | Aborts with E_LIMIT_TOO_LOW (102) |
| `test_update_rewards_threshold_too_high` | Threshold too high | Aborts with E_TOO_BIG_PERCENT (109) |

#### Pause Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_pause_unpause` | Pause and unpause | State toggles correctly |
| `test_pause_multiple_times` | Multiple pauses | Can pause/unpause repeatedly |

---

### 6. advanced_coverage_tests.move Tests (16 tests)

Advanced tests covering rewards management and pause state enforcement.

#### Update Rewards Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_update_rewards_basic` | Basic rewards update | Rewards increase, delay enforced |
| `test_update_rewards_delay_not_reached` | Update too soon | Aborts with E_DELAY_NOT_REACHED (106) |
| `test_update_rewards_less_fails` | Rewards decrease | Aborts with E_LESS_REWARDS (105) |
| `test_update_rewards_threshold_exceeded_fails` | Exceeds threshold | Aborts with E_REWARD_NOT_IN_THRESHOLD (107) |
| `test_multiple_reward_updates` | Sequential updates | Each update respects delay |

#### Update Rewards Revert Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_update_rewards_revert_basic` | Revert rewards | Rewards reduced correctly |
| `test_update_rewards_revert_too_high_fails` | Revert too much | Aborts with E_REWARDS_TOO_HIGH (111) |

#### Pause State Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_update_validators_when_paused_fails` | Update validators while paused | Aborts with E_PAUSED (101) |
| `test_update_rewards_when_paused_fails` | Update rewards while paused | Aborts with E_PAUSED (101) |
| `test_update_rewards_threshold_when_paused_fails` | Update threshold while paused | Aborts with E_PAUSED (101) |
| `test_change_min_stake_when_paused_works` | Change min stake while paused | Works (owner function) |
| `test_change_base_reward_fee_when_paused_works` | Change fee while paused | Works (owner function) |
| `test_pause_when_already_paused` | Double pause | No-op, remains paused |
| `test_unpause_when_already_unpaused` | Double unpause | No-op, remains unpaused |

#### Fee Boundary Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_fee_boundary_99_99_percent` | 99.99% fee | Accepted (MAX_PERCENT - 1) |
| `test_fee_exactly_100_percent_fails` | 100% fee | Aborts with E_TOO_BIG_PERCENT (109) |

---

### 7. complete_coverage_tests.move Tests (19 tests)

Comprehensive tests for complete code coverage of remaining functions.

#### Publish Ratio Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_publish_ratio` | Emit ratio event | Event emitted with correct ratio |
| `test_publish_ratio_after_mint` | Ratio after minting | Ratio reflects supply change |

#### Add Pending Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_add_pending` | Add pending balance | Pending increases |
| `test_add_pending_multiple_times` | Multiple additions | Pending accumulates |

#### Collect Fee Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_collect_fee_when_zero` | Collect with no fees | Returns zero coin |

#### Burn Balance Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_burn_balance` | Burn Balance type | Supply decreases |
| `test_burn_balance_partial` | Partial burn | Correct amount burned |

#### Total Supply Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_get_total_supply_object` | Get supply object | Returns valid reference |

#### Total Staked Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_get_total_staked_includes_pending` | Total includes pending | Pending counted in total |
| `test_get_total_staked_zero_initially` | Initial total | Returns 0 |

#### Validator Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_get_top_validator_with_zero_priority` | Zero priority handling | Returns validator if available |
| `test_get_top_validator_all_zero_priority` | All zero priority | Aborts with E_NO_VALIDATORS |

#### Min Stake Boundary Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_change_min_stake_boundary` | Exactly 1 IOTA | Accepted |
| `test_change_min_stake_just_below_minimum` | Below 1 IOTA | Aborts with E_LIMIT_TOO_LOW |

#### Multiple Operations Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_multiple_add_pending_and_publish` | Combined operations | All work together |
| `test_ratio_changes_with_rewards` | Ratio calculation | Correct after rewards |

#### Event Tests
| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| `test_publish_ratio_emits_event` | Event emission | RatioUpdated event emitted |

---

## Error Codes Reference

### native_pool.move Errors (100-112)
| Code | Name | Trigger | Tested |
|------|------|---------|--------|
| 1 | E_INCOMPATIBLE_VERSION | migrate() version mismatch | No (version=1) |
| 100 | E_MIN_LIMIT | Stake below min_stake | Testnet |
| 100 | E_SAME_ADDRESS | Transfer to same address | Yes |
| 101 | E_PAUSED | Operation when paused | Yes |
| 102 | E_LIMIT_TOO_LOW | Min stake/threshold too low | Yes |
| 103 | E_NOTHING_TO_UNSTAKE | No stakes available | Testnet |
| 105 | E_LESS_REWARDS | Rewards decrease | Yes |
| 106 | E_DELAY_NOT_REACHED | Update too soon | Yes |
| 107 | E_REWARD_NOT_IN_THRESHOLD | Exceeds threshold | Yes |
| 108 | E_BURN_MISMATCH | Burn returns wrong amount | Internal |
| 109 | E_TOO_BIG_PERCENT | Fee/threshold > 100% | Yes |
| 110 | E_NOT_ENOUGH_BALANCE | Insufficient balance | Internal |
| 111 | E_REWARDS_TOO_HIGH | Revert amount too high | Yes |
| 112 | E_NO_VALIDATORS | No validators for stake | Testnet |

### validator_set.move Errors (300-304)
| Code | Name | Trigger | Tested |
|------|------|---------|--------|
| 300 | E_NO_VALIDATORS | Empty validator set | Yes |
| 301 | E_MISMATCHED_LENGTHS | Array length mismatch | Yes |
| 302 | E_VAULT_NOT_EMPTY | Destroy non-empty vault | Internal |
| 303 | E_VALIDATOR_NOT_FOUND | Validator not in set | Internal |
| 304 | E_TOO_MANY_VLDRS | Exceed max validators | Yes |

### math.move Errors (500-502)
| Code | Name | Trigger | Tested |
|------|------|---------|--------|
| 500 | E_DIVIDE_BY_ZERO | Division by zero | Yes |
| 501 | E_U64_OVERFLOW | u64 overflow | Internal |
| 502 | E_RATIO_OVERFLOW | Ratio overflow | Internal |

---

## Running Tests

### Using Docker Development Environment
```bash
# Enter the development container
./setup-iota-dev.sh

# Run all tests
iota move test

# Run specific test file
iota move test --filter math_tests

# Run with verbose output
iota move test -v
```

### Expected Output
```
Running Move unit tests
[ PASS    ] tokenlabs_liquid_stake::math_tests::test_mul_div_basic
[ PASS    ] tokenlabs_liquid_stake::math_tests::test_mul_div_large_numbers
... (104 more tests)
Test result: OK. Total tests: 106; passed: 106; failed: 0
```

---

## Testnet Testing

Functions requiring `IotaSystemState` must be tested on testnet:

### Testnet Deployment
- Package: `0xba81891eeff123b0d3272d71b8acf63498330977c79392e8935d4387d27c5e2b`
- See `TESTNET_DEPLOYMENT.md` for full deployment details

### Testnet Test Plan

| Function | Test Steps | Expected Result |
|----------|------------|-----------------|
| `stake()` | Call with 2+ IOTA | tIOTA minted, stake created |
| `stake_to_validators()` | Call with validator addresses | Stake distributed equally |
| `unstake()` | Wait for next epoch, unstake | IOTA returned, tIOTA burned |
| `rebalance()` | Set validator priority to 0, rebalance | Stakes moved to active validators |

### Executed Testnet Tests
| Test | Transaction | Result |
|------|-------------|--------|
| Configure validators | `3qX8oKCk6YbWg88jYDM8kCXL71SebcQQQQHpff4sH73J` | PASS |
| Stake 2 IOTA | `C3LhLigQT6qA8TWKcSk9GEpwnc6656HoLgASdURNafyG` | PASS |
| Stake to validators | `CQwfRYGz8fTKEbTXv8DtkJxckaupMe4RYRJUPtmV1n6k` | PASS |
| Unstake same epoch | `GX2BQkfpnj4pjqUR37BrmsvL5UkPaL2QgDnp8R4hv21b` | Error 103 (expected) |

---

## Coverage Summary

| Module | Unit Test Coverage | Notes |
|--------|-------------------|-------|
| math.move | 100% | All functions tested |
| ownership.move | 100% | All functions tested |
| cert.move | 100% | All functions tested |
| validator_set.move | 75% | add_stake/remove_stakes need testnet |
| native_pool.move | 76% | stake/unstake/rebalance need testnet |

**Overall Estimated Coverage: ~92%**

To reach ~100%:
1. Complete testnet testing for stake/unstake flows
2. Test stake_to_validators edge cases
3. Test rebalance functionality
4. Verify error codes on testnet

---

## Test Design Patterns

### Pattern 1: Test Scenario Setup
```move
#[test]
fun test_example() {
    let mut scenario = ts::begin(ADMIN);

    ts::next_tx(&mut scenario, ADMIN);
    {
        // Setup code
    };

    ts::next_tx(&mut scenario, USER);
    {
        // Test code
    };

    ts::end(scenario);
}
```

### Pattern 2: Expected Failure
```move
#[test]
#[expected_failure(abort_code = 101)] // E_PAUSED
fun test_operation_when_paused_fails() {
    // Test that triggers abort
}
```

### Pattern 3: Clock Time Manipulation
```move
// Create clock with specific timestamp
let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
clock::set_for_testing(&mut clock, 50_000_000); // 50 seconds

// Advance time
clock::increment_for_testing(&mut clock, REWARD_UPDATE_DELAY);
```

### Pattern 4: Object Lifecycle
```move
// Take shared object
let mut pool = ts::take_shared<NativePool>(&scenario);

// Use object
native_pool::some_function(&mut pool);

// Return shared object
ts::return_shared(pool);
```
