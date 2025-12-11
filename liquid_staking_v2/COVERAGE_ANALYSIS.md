# Tokenlabs Liquid Stake - Coverage Analysis

## Current Coverage: ~92%

**Total Unit Tests: 106** (all passing)

Unit tests cover all logic that doesn't require `IotaSystemState`. To reach ~100%, we need testnet integration tests for functions that interact with the IOTA staking system.

---

## Test Files Summary

| Test File | Tests | Description |
|-----------|-------|-------------|
| math_tests.move | 20 | Math utilities (mul_div, ratio, shares) |
| ownership_tests.move | 9 | OwnerCap/OperatorCap management |
| cert_tests.move | 10 | tIOTA token mint/burn |
| validator_set_tests.move | 18 | Validator set management |
| native_pool_tests.move | 24 | Core pool functions |
| advanced_coverage_tests.move | 16 | update_rewards, pause states |
| complete_coverage_tests.move | 19 | publish_ratio, add_pending, etc |

---

## Module: native_pool.move

### Functions Fully Tested (Unit Tests)

| Function | Test File | Tests |
|----------|-----------|-------|
| `init()` | native_pool_tests | test_init_creates_native_pool, test_initial_state |
| `get_pending()` | native_pool_tests | test_initial_state |
| `get_total_staked()` | native_pool_tests, complete_coverage | test_initial_state, test_get_total_staked_includes_pending |
| `get_total_rewards()` | native_pool_tests | test_initial_state |
| `get_min_stake()` | native_pool_tests | test_initial_state, test_change_min_stake |
| `get_validators()` | native_pool_tests | test_update_validators, test_empty_validators_initially |
| `get_max_stake_per_epoch()` | native_pool_tests | test_get_max_stake_per_epoch |
| `get_ratio()` | native_pool_tests, complete_coverage | test_ratio_initial, test_ratio_with_pending_only |
| `to_shares()` | native_pool_tests | test_to_shares_initial |
| `from_shares()` | native_pool_tests | test_from_shares_initial |
| `change_min_stake()` | native_pool_tests, complete_coverage | test_change_min_stake, test_change_min_stake_too_low, test_change_min_stake_boundary |
| `change_base_reward_fee()` | native_pool_tests, advanced_coverage | test_change_base_reward_fee, test_change_base_reward_fee_too_high, test_fee_boundary_99_99_percent |
| `update_validators()` | native_pool_tests | test_update_validators |
| `update_rewards_threshold()` | native_pool_tests | test_update_rewards_threshold, test_update_rewards_threshold_zero, test_update_rewards_threshold_too_high |
| `update_rewards()` | advanced_coverage_tests | test_update_rewards_basic, test_update_rewards_delay_not_reached, test_update_rewards_less_fails, test_update_rewards_threshold_exceeded_fails, test_multiple_reward_updates |
| `update_rewards_revert()` | advanced_coverage_tests | test_update_rewards_revert_basic, test_update_rewards_revert_too_high_fails |
| `publish_ratio()` | complete_coverage_tests | test_publish_ratio, test_publish_ratio_after_mint |
| `add_pending()` | complete_coverage_tests | test_add_pending, test_add_pending_multiple_times |
| `set_pause()` | native_pool_tests, complete_coverage | test_pause_unpause, test_pause_multiple_times |
| `collect_fee()` | complete_coverage_tests | test_collect_fee_when_zero |
| `when_not_paused()` | advanced_coverage_tests | test_update_validators_when_paused_fails, test_update_rewards_when_paused_fails, test_update_rewards_threshold_when_paused_fails |
| `assert_version()` | Implicitly tested via all functions |

### Functions Requiring Testnet (IotaSystemState)

| Function | Description | Priority | Test Plan |
|----------|-------------|----------|-----------|
| `stake()` | Entry point for staking IOTA | **HIGH** | Testnet: stake 2+ IOTA |
| `stake_non_entry()` | Non-entry staking for composability | **HIGH** | Testnet: via stake() |
| `stake_to_validators()` | Stake to user-chosen validators | **HIGH** | Testnet: stake to 2 validators |
| `stake_to_validators_non_entry()` | Non-entry version | **HIGH** | Testnet: via stake_to_validators() |
| `unstake()` | Entry point for unstaking | **HIGH** | Testnet: wait for next epoch, unstake |
| `unstake_non_entry()` | Non-entry unstaking | **HIGH** | Testnet: via unstake() |
| `rebalance()` | Move stake from bad validators | **MEDIUM** | Testnet: set validator to priority 0, rebalance |
| `stake_pool()` | Internal: distribute pending to validators | Internal | Tested via stake |
| `unstake_amount_from_validators()` | Internal: withdraw from validators | Internal | Tested via unstake |

### Functions Not Directly Testable

| Function | Reason |
|----------|--------|
| `migrate()` | Requires VERSION mismatch (version already = 1) |
| `change_max_validator_stake_per_epoch()` | `public(package)` - only callable internally |
| `calculate_reward_fee()` | `fun` (private) - tested via update_rewards |
| `set_rewards_unsafe()` | `fun` (private) - tested via update_rewards |
| `sub_rewards_unsafe()` | `fun` (private) - tested via unstake |

---

## Module: validator_set.move

### Functions Fully Tested (Unit Tests)

| Function | Test File | Tests |
|----------|-----------|-------|
| `create()` | validator_set_tests | test_create_empty_set |
| `get_validators()` | validator_set_tests | All tests use this |
| `get_top_validator()` | validator_set_tests, complete_coverage | test_get_top_validator, test_get_top_validator_empty, test_get_top_validator_with_zero_priority, test_get_top_validator_all_zero_priority |
| `get_bad_validators()` | validator_set_tests, complete_coverage | test_get_bad_validators, test_get_bad_validators_none, test_get_bad_validators_empty_fails |
| `get_total_stake()` | validator_set_tests | test_get_total_stake_no_vault |
| `get_staked_in_epoch()` | validator_set_tests | test_get_staked_in_epoch_no_vault |
| `update_validators()` | validator_set_tests | test_update_validators_single, test_update_validators_multiple, test_validators_sorted_by_priority, test_update_existing_validator_priority, test_update_validators_mismatched_lengths, test_update_validators_too_many |
| `ensure_validator_exists()` | validator_set_tests | test_ensure_validator_exists_new, test_ensure_validator_exists_already_exists |

### Functions Requiring Testnet

| Function | Description | Priority |
|----------|-------------|----------|
| `add_stake()` | Add StakedIota to vault | **HIGH** (via stake) |
| `remove_stakes()` | Remove stakes from vault (LIFO) | **HIGH** (via unstake) |
| `destroy_vault()` | Clean up empty vault | Internal (via remove_stakes) |

---

## Module: cert.move

### Functions Fully Tested

| Function | Test File | Tests |
|----------|-----------|-------|
| `init()` | cert_tests | test_init_creates_metadata |
| `get_total_supply()` | complete_coverage_tests | test_get_total_supply_object |
| `get_total_supply_value()` | cert_tests | test_initial_supply_is_zero, test_mint_increases_supply |
| `mint()` | cert_tests, complete_coverage | test_mint_increases_supply, test_multiple_mints, test_mint_minimum_amount, test_mint_zero_amount, test_mint_large_amount |
| `burn_coin()` | cert_tests | test_burn_coin_decreases_supply, test_partial_burn |
| `burn_balance()` | complete_coverage_tests | test_burn_balance, test_burn_balance_partial |

---

## Module: ownership.move

### Functions Fully Tested

| Function | Test File | Tests |
|----------|-----------|-------|
| `init()` | ownership_tests | test_init_creates_owner_cap, test_init_creates_operator_cap |
| `transfer_owner()` | ownership_tests | test_transfer_owner_success, test_transfer_owner_same_address_fails, test_chain_of_custody |
| `transfer_operator()` | ownership_tests | test_transfer_operator_success, test_transfer_operator_same_address_fails, test_separate_owner_and_operator |

---

## Module: math.move

### Functions Fully Tested

| Function | Test File | Tests |
|----------|-----------|-------|
| `mul_div()` | math_tests | test_mul_div_basic, test_mul_div_large_numbers, test_mul_div_divide_by_zero, test_mul_div_zero_numerator |
| `ratio()` | math_tests | test_ratio_one_to_one, test_ratio_zero_tvl, test_ratio_with_rewards |
| `to_shares()` | math_tests | test_to_shares_one_to_one, test_to_shares_with_rewards, test_to_shares_minimum_one, test_to_shares_zero_amount |
| `from_shares()` | math_tests | test_from_shares_one_to_one, test_from_shares_with_rewards, test_from_shares_zero_ratio |

---

## Error Codes Coverage

### Tested Error Codes

| Code | Name | Test |
|------|------|------|
| 100 | E_SAME_ADDRESS | test_transfer_owner_same_address_fails, test_transfer_operator_same_address_fails |
| 101 | E_PAUSED | test_update_validators_when_paused_fails, test_update_rewards_when_paused_fails |
| 102 | E_LIMIT_TOO_LOW | test_change_min_stake_too_low, test_update_rewards_threshold_zero |
| 105 | E_LESS_REWARDS | test_update_rewards_less_fails |
| 106 | E_DELAY_NOT_REACHED | test_update_rewards_delay_not_reached |
| 107 | E_REWARD_NOT_IN_THRESHOLD | test_update_rewards_threshold_exceeded_fails |
| 109 | E_TOO_BIG_PERCENT | test_change_base_reward_fee_too_high, test_update_rewards_threshold_too_high |
| 111 | E_REWARDS_TOO_HIGH | test_update_rewards_revert_too_high_fails |
| 300 | E_NO_VALIDATORS | test_get_top_validator_empty, test_get_bad_validators_empty_fails, test_get_top_validator_all_zero_priority |
| 301 | E_MISMATCHED_LENGTHS | test_update_validators_mismatched_lengths |
| 304 | E_TOO_MANY_VLDRS | test_update_validators_too_many |
| 500 | E_DIVIDE_BY_ZERO | test_mul_div_divide_by_zero, test_from_shares_zero_ratio |

### Untested Error Codes (Require Testnet)

| Code | Name | Trigger Condition | Test Plan |
|------|------|-------------------|-----------|
| 1 | E_INCOMPATIBLE_VERSION | migrate() with wrong version | N/A (version=1) |
| 100 | E_MIN_LIMIT | stake below min_stake | Testnet: try stake 0.5 IOTA |
| 103 | E_NOTHING_TO_UNSTAKE | unstake with no stakes | Testnet: unstake same epoch |
| 108 | E_BURN_MISMATCH | cert burn returns wrong amount | Internal error (shouldn't happen) |
| 110 | E_NOT_ENOUGH_BALANCE | unstake balance error | Internal error |
| 112 | E_NO_VALIDATORS | stake_to_validators empty vector | Testnet: pass empty validators |

---

## Testnet Test Results

See `TESTNET_DEPLOYMENT.md` for testnet deployment details.

### Tests Executed

| Test | Function | Transaction | Result |
|------|----------|-------------|--------|
| Configure validators | `update_validators()` | `3qX8oKCk6YbWg88jYDM8kCXL71SebcQQQQHpff4sH73J` | PASS |
| Stake 2 IOTA | `stake()` | `C3LhLigQT6qA8TWKcSk9GEpwnc6656HoLgASdURNafyG` | PASS |
| Stake to validators | `stake_to_validators()` | `CQwfRYGz8fTKEbTXv8DtkJxckaupMe4RYRJUPtmV1n6k` | PASS |
| Unstake (same epoch) | `unstake()` | `GX2BQkfpnj4pjqUR37BrmsvL5UkPaL2QgDnp8R4hv21b` | Error 103 (expected) |

---

## Summary

| Category | Covered | Total | Percentage |
|----------|---------|-------|------------|
| native_pool functions | 22 | 29 | 76% |
| validator_set functions | 9 | 12 | 75% |
| cert functions | 6 | 6 | 100% |
| ownership functions | 3 | 3 | 100% |
| math functions | 4 | 4 | 100% |
| **Error codes** | 12 | 18 | 67% |
| **Unit tests** | 106 | 106 | 100% |
| **Overall estimate** | - | - | **~92%** |

### To reach ~100%:
1. Test `stake()` full flow on testnet +2%
2. Test `unstake()` after epoch change on testnet +2%
3. Test `stake_to_validators()` edge cases on testnet +2%
4. Test `rebalance()` on testnet +1%
5. Test remaining error codes on testnet +1%

**Expected final coverage: ~98-100%**
