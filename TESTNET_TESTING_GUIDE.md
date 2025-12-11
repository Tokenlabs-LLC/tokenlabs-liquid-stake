# Tokenlabs Liquid Stake - Testnet Testing Guide

## Prerequisites

1. Docker container running: `./setup-iota-dev.sh`
2. Inside container, wallet configured with testnet tokens
3. Contract deployed (see TESTNET_DEPLOYMENT.md)

## Environment Setup

Run these inside the Docker container:

```bash
# Set environment variables
export PACKAGE=0xba81891eeff123b0d3272d71b8acf63498330977c79392e8935d4387d27c5e2b
export POOL=0x837a7836002846d5d62ed9594d9daf69604cf3ee89e2bd0016b5438691f0fc6f
export METADATA=0xa3dce3a6281d486ebab3695b5bdb3aabf584bad15e0a655df419b57e70124b53
export OWNER_CAP=0x54ee5a58eb325bc02559f5258a9d3c946f98ca4ebd6ee43cdcbe7b90c70a2891
export OPERATOR_CAP=0xe84406ca09529447efa584a14260df48f50c9998a2ed642d7f2683473cd5b02b
export SYSTEM=0x5
export CLOCK=0x6
```

---

## Test 1: Get Active Validators

First, we need to find active validators on testnet:

```bash
# List active validators
iota client call \
  --package 0x3 \
  --module iota_system \
  --function active_validator_addresses \
  --args 0x5 \
  --gas-budget 10000000
```

Or check the explorer: https://explorer.rebased.iota.org/validators?network=testnet

---

## Test 2: Update Validators (Required First!)

```bash
# Replace <VALIDATOR_ADDRESS> with a real testnet validator
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function update_validators \
  --args $POOL '["<VALIDATOR_ADDRESS>"]' '[100]' $OPERATOR_CAP \
  --gas-budget 10000000
```

**Expected:** Transaction succeeds, ValidatorPriorUpdated event emitted.

**Verify:**
```bash
iota client object $POOL
```

---

## Test 3: Stake IOTA → Receive tIOTA

### 3.1 Check your gas coins
```bash
iota client gas
```

### 3.2 Stake 2 IOTA
```bash
# Replace <COIN_ID> with one of your gas coin IDs
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function stake \
  --args $POOL $METADATA $SYSTEM <COIN_ID> \
  --gas-budget 50000000
```

**Expected:**
- StakedEvent emitted with iota_amount and cert_amount
- You receive a CERT coin (tIOTA)
- Pool's pending or total_staked increases

**Verify:**
```bash
# Check your new tIOTA balance
iota client objects --filter "StructType(0xba81891eeff123b0d3272d71b8acf63498330977c79392e8935d4387d27c5e2b::cert::CERT)"

# Check pool state
iota client object $POOL
```

---

## Test 4: Stake Below Minimum (Error 100)

```bash
# First split a small coin (0.5 IOTA = 500_000_000 nanos)
iota client split-coin --coin-id <COIN_ID> --amounts 500000000 --gas-budget 10000000

# Then try to stake the small coin
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function stake \
  --args $POOL $METADATA $SYSTEM <SMALL_COIN_ID> \
  --gas-budget 50000000
```

**Expected:** Transaction fails with error code 100 (E_MIN_LIMIT)

---

## Test 5: Stake to Specific Validators

```bash
# Stake to 2 validators equally
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function stake_to_validators \
  --args $POOL $METADATA $SYSTEM '["<VALIDATOR_1>", "<VALIDATOR_2>"]' <COIN_ID> \
  --gas-budget 50000000
```

**Expected:**
- StakedToValidatorsEvent emitted
- Stake distributed equally between validators
- New validators added to validator_set if not present

---

## Test 6: Stake to Empty Validators (Error 112)

```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function stake_to_validators \
  --args $POOL $METADATA $SYSTEM '[]' <COIN_ID> \
  --gas-budget 50000000
```

**Expected:** Transaction fails with error code 112 (E_NO_VALIDATORS)

---

## Test 7: Unstake tIOTA → Receive IOTA

```bash
# Get your CERT coin ID
iota client objects --filter "StructType(0xba81891eeff123b0d3272d71b8acf63498330977c79392e8935d4387d27c5e2b::cert::CERT)"

# Unstake
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function unstake \
  --args $POOL $SYSTEM $METADATA <CERT_COIN_ID> \
  --gas-budget 50000000
```

**Expected:**
- UnstakedEvent emitted
- CERT coin burned
- IOTA returned to your address
- Pool's total_staked decreases

---

## Test 8: Rebalance (After Setting Bad Validator)

### 8.1 Set a validator to priority 0 (bad)
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function update_validators \
  --args $POOL '["<VALIDATOR_TO_REMOVE>"]' '[0]' $OPERATOR_CAP \
  --gas-budget 10000000
```

### 8.2 Call rebalance
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function rebalance \
  --args $POOL $SYSTEM \
  --gas-budget 100000000
```

**Expected:**
- Stakes from bad validators (priority 0) are withdrawn
- Funds moved to pending, then re-staked to good validators

---

## Test 9: Update Rewards (After 12h Delay)

**Note:** This test requires waiting 12 hours after deployment or previous update.

```bash
# Calculate new rewards value (must be > current total_rewards)
# Get current value first:
iota client object $POOL

# Update rewards (value must be within threshold)
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function update_rewards \
  --args $POOL $CLOCK <NEW_REWARDS_VALUE> $OPERATOR_CAP \
  --gas-budget 10000000
```

**Expected:** RewardsUpdated event emitted

---

## Test 10: Collect Fees

```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function collect_fee \
  --args $POOL 0x9bd84e617831511634d8aca9120e90b07ba9e4fd920029e1fe4c887fc8599841 $OWNER_CAP \
  --gas-budget 10000000
```

**Expected:** FeeCollectedEvent emitted, fees transferred to recipient

---

## Test 11: Pause and Test Blocked Operations

### 11.1 Pause the pool
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function set_pause \
  --args $POOL $OWNER_CAP true \
  --gas-budget 10000000
```

### 11.2 Try to stake (should fail with error 101)
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function stake \
  --args $POOL $METADATA $SYSTEM <COIN_ID> \
  --gas-budget 50000000
```

**Expected:** Transaction fails with error code 101 (E_PAUSED)

### 11.3 Unpause
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function set_pause \
  --args $POOL $OWNER_CAP false \
  --gas-budget 10000000
```

---

## Test Checklist

| Test | Function | Error Code | Status |
|------|----------|------------|--------|
| 1 | Get validators | - | ⬜ |
| 2 | update_validators | - | ⬜ |
| 3 | stake | - | ⬜ |
| 4 | stake (below min) | 100 | ⬜ |
| 5 | stake_to_validators | - | ⬜ |
| 6 | stake_to_validators (empty) | 112 | ⬜ |
| 7 | unstake | - | ⬜ |
| 8 | rebalance | - | ⬜ |
| 9 | update_rewards | - | ⬜ |
| 10 | collect_fee | - | ⬜ |
| 11 | Pause/unpause | 101 | ⬜ |

---

## Troubleshooting

### "Object not found"
- Ensure you're using the correct object IDs from TESTNET_DEPLOYMENT.md
- Check that the object exists: `iota client object <ID>`

### "Insufficient gas"
- Request more tokens: `iota client faucet`
- Increase gas budget

### "Version mismatch"
- Update IOTA CLI: https://docs.iota.org/developer/references/cli

### "E_NO_VALIDATORS" when staking
- Run Test 2 first to configure validators

### Transaction pending too long
- Check network status
- Try again with higher gas budget
