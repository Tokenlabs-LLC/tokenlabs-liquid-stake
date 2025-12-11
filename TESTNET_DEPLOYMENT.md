# Tokenlabs Liquid Stake - Testnet Deployment

## Deployment Information

| Field | Value |
|-------|-------|
| **Network** | IOTA Testnet |
| **Transaction Digest** | `AjkYfvXD8dct8oumjeWZKZhRNDSWwkYz4rKqfng1FFnn` |
| **Deployed At** | 2025-12-11 |
| **Epoch** | 388 |
| **Gas Cost** | ~0.113 IOTA |

## Package & Object IDs

### Package
| Field | Value |
|-------|-------|
| **Package ID** | `0xba81891eeff123b0d3272d71b8acf63498330977c79392e8935d4387d27c5e2b` |
| **Version** | 1 |
| **Modules** | cert, math, native_pool, ownership, validator_set |

### Shared Objects (Used by all users)
| Object | ID | Description |
|--------|-----|-------------|
| **NativePool** | `0x837a7836002846d5d62ed9594d9daf69604cf3ee89e2bd0016b5438691f0fc6f` | Main staking pool |
| **Metadata<CERT>** | `0xa3dce3a6281d486ebab3695b5bdb3aabf584bad15e0a655df419b57e70124b53` | tIOTA token metadata & supply |

### Admin Objects (Owner wallet only)
| Object | ID | Description |
|--------|-----|-------------|
| **OwnerCap** | `0x54ee5a58eb325bc02559f5258a9d3c946f98ca4ebd6ee43cdcbe7b90c70a2891` | Admin capability |
| **OperatorCap** | `0xe84406ca09529447efa584a14260df48f50c9998a2ed642d7f2683473cd5b02b` | Operator capability |
| **UpgradeCap** | `0x1602716d94431052cbc442f17bb21c76e89b85c026ddbbf76a3b9df5cf744b9c` | Package upgrade capability |

### Immutable Objects
| Object | ID | Description |
|--------|-----|-------------|
| **CoinMetadata** | `0x21130a4173ea9f17303913020599df9098432512e0f946db8936647f27b37757` | CERT token metadata |

## Wallet Information

| Field | Value |
|-------|-------|
| **Address** | `0x9bd84e617831511634d8aca9120e90b07ba9e4fd920029e1fe4c887fc8599841` |
| **Alias** | pedantic-jet |

> **Note**: Testnet wallet for development purposes.

## Explorer Links

- **Package**: https://explorer.rebased.iota.org/object/0xba81891eeff123b0d3272d71b8acf63498330977c79392e8935d4387d27c5e2b?network=testnet
- **NativePool**: https://explorer.rebased.iota.org/object/0x837a7836002846d5d62ed9594d9daf69604cf3ee89e2bd0016b5438691f0fc6f?network=testnet
- **Transaction**: https://explorer.rebased.iota.org/txblock/AjkYfvXD8dct8oumjeWZKZhRNDSWwkYz4rKqfng1FFnn?network=testnet

## CLI Commands for Testing

### Environment Variables (for convenience)
```bash
export PACKAGE=0xba81891eeff123b0d3272d71b8acf63498330977c79392e8935d4387d27c5e2b
export POOL=0x837a7836002846d5d62ed9594d9daf69604cf3ee89e2bd0016b5438691f0fc6f
export METADATA=0xa3dce3a6281d486ebab3695b5bdb3aabf584bad15e0a655df419b57e70124b53
export OWNER_CAP=0x54ee5a58eb325bc02559f5258a9d3c946f98ca4ebd6ee43cdcbe7b90c70a2891
export OPERATOR_CAP=0xe84406ca09529447efa584a14260df48f50c9998a2ed642d7f2683473cd5b02b
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
