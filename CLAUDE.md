# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tokenlabs Liquid Stake is a Move smart contract for liquid staking on the IOTA blockchain. Users stake IOTA and receive tIOTA (CERT tokens) representing their staked position. The tIOTA token is a reward-bearing synthetic token that accrues staking rewards over time.

## Development Environment

The project uses a Docker-based dev environment. All IOTA CLI commands must be run inside the container.

```bash
# Enter the development container (first time installs everything, ~15-25 min)
./setup-iota-dev.sh

# Once inside the container:
iota move build                              # Build the Move package
iota move test                               # Run tests
iota client publish --gas-budget 100000000   # Publish to network
```

Other setup script options:
- `./setup-iota-dev.sh --status` - Check environment state
- `./setup-iota-dev.sh --rebuild` - Rebuild container from scratch
- `./setup-iota-dev.sh --stop` - Stop the container

## Architecture

### Module Dependency Graph
```
ownership.move (OwnerCap, OperatorCap)
       ↓
    math.move (ratio calculations)
       ↓
   cert.move (tIOTA token) ← validator_set.move (stake tracking)
       ↓                            ↓
              native_pool.move (main staking logic)
```

### Key Modules

**native_pool.move** - Core staking pool managing:
- `stake()` / `unstake()` - Main user entry points
- `stake_to_validators()` - User-chosen validator staking (distributes equally)
- `stake_pool()` - Internal function to distribute pending balance to validators (respects per-epoch limits)
- Ratio-based share conversion using `math.move` utilities
- Fee collection (10% default on rewards)

**cert.move** - tIOTA token (CERT):
- Package-visibility `mint()` / `burn_coin()` / `burn_balance()` - only native_pool can mint/burn
- Stores supply in shared `Metadata<CERT>` object
- 9 decimals matching IOTA

**validator_set.move** - Validator management:
- Priority-sorted validator list (highest priority first for staking)
- Per-validator `Vault` tracking `StakedIota` objects by activation epoch
- Tracks `staked_in_epoch` to enforce max stake per validator per epoch
- `get_bad_validators()` returns validators with priority 0 for rebalancing

**ownership.move** - Access control:
- `OwnerCap` - Admin functions (fees, thresholds, pause, migration)
- `OperatorCap` - Operational functions (update validators, update rewards)

### Share/Ratio System

The ratio is calculated as: `supply * 1e18 / tvl` where TVL = total_staked + total_rewards - collected_rewards

- `to_shares(ratio, iota_amount)` - Convert IOTA to tIOTA shares when staking
- `from_shares(ratio, shares)` - Convert tIOTA shares to IOTA when unstaking

As rewards accrue, the ratio decreases, meaning each tIOTA becomes worth more IOTA.

## Key Constants

- `ONE_IOTA = 1_000_000_000` (9 decimals)
- `MAX_PERCENT = 10000` (100.00% with 2 decimal precision)
- `REWARD_UPDATE_DELAY = 43_200_000` (12 hours in ms)
- `DEFAULT_MAX_VALIDATOR_STAKE_PER_EPOCH = 50_000_000_000_000_000` (50M IOTA)

## Error Codes

- `100-111`: native_pool errors (E_MIN_LIMIT, E_PAUSED, E_LESS_REWARDS, etc.)
- `300-304`: validator_set errors (E_NO_VALIDATORS, E_MISMATCHED_LENGTHS, etc.)
- `500-502`: math errors (E_DIVIDE_BY_ZERO, E_U64_OVERFLOW, E_RATIO_OVERFLOW)
