# Tokenlabs Liquid Stake - Testnet Deployment

## Deployment Information

| Field | Value |
|-------|-------|
| **Network** | IOTA Testnet |
| **Deployed At** | 2025-12-11 |
| **Version** | v3 (tIOTA name) |

## Package & Object IDs

### Package
| Field | Value |
|-------|-------|
| **Package ID** | `0xfb784a42f5a09475a72df201b6d0053911c7639bfc073b5895e2875ec6c156d4` |
| **Version** | 3 |
| **Modules** | cert, math, native_pool, ownership, validator_set |

### Shared Objects (Used by all users)
| Object | ID | Description |
|--------|-----|-------------|
| **NativePool** | `0x8f0cf942f3dd1cfa14288ac6a1b81f94bbb87ee77ace13c762b0dc770dfcafe6` | Main staking pool |
| **Metadata<CERT>** | `0x19286e9d5eaee1a434e9dbe2e349165e1b73d3e8e7afb77aac89f8c7fb317f78` | tIOTA token metadata & supply |

### Admin Objects (Owner wallet only)
| Object | ID | Description |
|--------|-----|-------------|
| **OwnerCap** | `0x5b449bf4653a379e10774800d1d7e4217297536973dc7df6a03b288f655b74d3` | Admin capability |
| **OperatorCap** | `0xc60ee47357fa37374e3876e3e7f3636c80db72a1e1eea8a048dd9e1b7bf98915` | Operator capability |

## Wallet Information

| Field | Value |
|-------|-------|
| **Address** | `0x9bd84e617831511634d8aca9120e90b07ba9e4fd920029e1fe4c887fc8599841` |
| **Alias** | pedantic-jet |

> **Note**: Testnet wallet for development purposes.

## Explorer Links

- **Package**: https://explorer.rebased.iota.org/object/0xfb784a42f5a09475a72df201b6d0053911c7639bfc073b5895e2875ec6c156d4?network=testnet
- **NativePool**: https://explorer.rebased.iota.org/object/0x8f0cf942f3dd1cfa14288ac6a1b81f94bbb87ee77ace13c762b0dc770dfcafe6?network=testnet

## CLI Commands for Testing

### Environment Variables (for convenience)
```bash
export PACKAGE=0xfb784a42f5a09475a72df201b6d0053911c7639bfc073b5895e2875ec6c156d4
export POOL=0x8f0cf942f3dd1cfa14288ac6a1b81f94bbb87ee77ace13c762b0dc770dfcafe6
export METADATA=0x19286e9d5eaee1a434e9dbe2e349165e1b73d3e8e7afb77aac89f8c7fb317f78
export OWNER_CAP=0x5b449bf4653a379e10774800d1d7e4217297536973dc7df6a03b288f655b74d3
export OPERATOR_CAP=0xc60ee47357fa37374e3876e3e7f3636c80db72a1e1eea8a048dd9e1b7bf98915
export SYSTEM=0x5
export CLOCK=0x6
```

### 1. Update Validators (Required before staking)
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function update_validators \
  --args $POOL '["<VALIDATOR_ADDRESS>"]' '[100]' $OPERATOR_CAP \
  --gas-budget 10000000
```

### 2. Stake IOTA
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function stake \
  --args $POOL $METADATA $SYSTEM <COIN_OBJECT_ID> \
  --gas-budget 50000000
```

### 3. Stake to Specific Validators
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function stake_to_validators \
  --args $POOL $METADATA $SYSTEM '["<VALIDATOR_1>", "<VALIDATOR_2>"]' <COIN_OBJECT_ID> \
  --gas-budget 50000000
```

### 4. Unstake
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function unstake \
  --args $POOL $SYSTEM $METADATA <CERT_COIN_OBJECT_ID> \
  --gas-budget 50000000
```

### 5. Update Rewards (Operator only, after 12h delay)
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function update_rewards \
  --args $POOL $CLOCK <NEW_REWARDS_VALUE> $OPERATOR_CAP \
  --gas-budget 10000000
```

### 6. Rebalance (Move stake from bad validators)
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function rebalance \
  --args $POOL $SYSTEM \
  --gas-budget 100000000
```

### 7. Collect Fees (Owner only)
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function collect_fee \
  --args $POOL <RECIPIENT_ADDRESS> $OWNER_CAP \
  --gas-budget 10000000
```

### 8. Pause/Unpause (Owner only)
```bash
iota client call \
  --package $PACKAGE \
  --module native_pool \
  --function set_pause \
  --args $POOL $OWNER_CAP true \
  --gas-budget 10000000
```

## Initial Configuration

Default values after deployment:
- **min_stake**: 1 IOTA (1_000_000_000 nanos)
- **base_reward_fee**: 8% (800/10000)
- **rewards_threshold**: 1% (100/10000)
- **max_validator_stake_per_epoch**: 50M IOTA
- **paused**: false
- **version**: 1

---

## Test Results (2025-12-11)

### Tests Executed

| Test | Function | Transaction | Result |
|------|----------|-------------|--------|
| Configure validators | `update_validators()` | `3qX8oKCk6YbWg88jYDM8kCXL71SebcQQQQHpff4sH73J` | ✅ PASS |
| Stake 2 IOTA | `stake()` | `C3LhLigQT6qA8TWKcSk9GEpwnc6656HoLgASdURNafyG` | ✅ PASS |
| Stake to validators | `stake_to_validators()` | `CQwfRYGz8fTKEbTXv8DtkJxckaupMe4RYRJUPtmV1n6k` | ✅ PASS |
| Unstake (same epoch) | `unstake()` | `GX2BQkfpnj4pjqUR37BrmsvL5UkPaL2QgDnp8R4hv21b` | ✅ Error 103 (expected) |

### Validators Configured

| Validator | Address | Priority |
|-----------|---------|----------|
| TokenLabs.Network | `0xd20c0b7ab20ac195bc5fac68388fc2be75145059cbbdefe651ca986d8760c136` | 100 |
| Cryptech-Hacken | `0x6ea3feabfa03750e44046e6cd9f49a255bc5f7c9909ed16d4d0e10ac58c98073` | 90 |
| IOTA 2 | `0xa276b4c076fff55588255630e9ee35cf0d07e8d80c78991cfd58b43b687b4206` | 80 |

### Pool State After Tests

| Field | Value |
|-------|-------|
| **total_staked** | 6,000,000,000 (6 IOTA) |
| **pending** | 0 |
| **total_rewards** | 0 |
| **tIOTA supply** | 6,000,000,000 (6 tIOTA) |
| **vaults** | 3 (one per validator with stake) |

### tIOTA Tokens Created

| Test | Amount | Object ID |
|------|--------|-----------|
| stake() | 2 tIOTA | `0x132888003e5c6d871eeaf49bd284b425888a6dc59e576aeb3ddbb02f1a32107c` |
| stake_to_validators() | 4 tIOTA | `0x7bb40b0c22f9321ef5aed7ecf11e42452904ea7c5670f3814154311a3cd7935c` |

### Notes

1. **Unstake requires next epoch**: Stakes made in epoch N activate in epoch N+1. Attempting to unstake in the same epoch returns error 103 (E_NOTHING_TO_UNSTAKE). This is correct behavior.

2. **Stake distribution**:
   - `stake()` sends to highest priority validator (TokenLabs.Network)
   - `stake_to_validators()` splits equally among specified validators

3. **Ratio**: Initially 1:1 (1 IOTA = 1 tIOTA). Will change as rewards accrue.
