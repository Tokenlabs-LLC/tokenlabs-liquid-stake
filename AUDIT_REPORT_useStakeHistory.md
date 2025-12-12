# SECURITY AUDIT REPORT: useStakeHistory.ts

**File:** `/home/delar/Documentos/GitHub/tokenlabs-liquid-stake/src/hooks/useStakeHistory.ts`

**Date:** 2025-12-12

**Focus:** usePoolRewardsEstimate hook and reward calculation logic

---

## EXECUTIVE SUMMARY

The audit identified **5 CRITICAL ISSUES** and **3 MEDIUM ISSUES** in the reward calculation logic. The most severe issues include:

1. **CRITICAL**: Mathematical formula error in reward calculation (incorrect formula implementation)
2. **CRITICAL**: Division by zero vulnerability in exchange rate calculation
3. **CRITICAL**: Missing pagination for stakes table (can miss data)
4. **CRITICAL**: Integer overflow risk in BigInt multiplication
5. **CRITICAL**: Fallback estimation logic contains mathematical errors

---

## CRITICAL ISSUES

### CRITICAL-1: Incorrect Reward Calculation Formula

**Location:** Lines 354-377 (calculateRewardBigInt function)

**Severity:** CRITICAL

**Issue:**
The formula implementation is mathematically INCORRECT. The code attempts to calculate:
```
currentValue = principal * (current_rate / deposit_rate)
```

However, exchange rates are stored as `{ iotaAmount, poolTokenAmount }` where:
```
rate = iotaAmount / poolTokenAmount
```

**Current Implementation:**
```typescript
// Line 354-368: Current code
// Formula: currentValue = principal * currentIota * depositPoolToken / (currentPoolToken * depositIota)
const numerator = principal * currentRate.iotaAmount * depositRate.poolTokenAmount;
const denominator = currentRate.poolTokenAmount * depositRate.iotaAmount;
```

**The Problem:**
The formula is trying to compute:
```
currentValue = principal * (currentIota / currentPool) / (depositIota / depositPool)
             = principal * (currentIota * depositPool) / (currentPool * depositIota)
```

But this is WRONG! The correct formula should be:
```
currentValue = principal * (currentIota / currentPool) / (depositIota / depositPool)
             = principal * currentIota * depositPool / (currentPool * depositIota)
```

**Wait, let me re-check this...**

Actually, looking at line 368-369:
```typescript
const numerator = principal * currentRate.iotaAmount * depositRate.poolTokenAmount;
const denominator = currentRate.poolTokenAmount * depositRate.iotaAmount;
```

This computes:
```
currentValue = (principal * currentIota * depositPool) / (currentPool * depositIota)
```

Let's verify this algebraically:
```
Exchange rate at deposit: R_deposit = depositIota / depositPool
Exchange rate at current: R_current = currentIota / currentPool

We want: currentValue = principal * (R_current / R_deposit)
                      = principal * (currentIota / currentPool) / (depositIota / depositPool)
                      = principal * (currentIota / currentPool) * (depositPool / depositIota)
                      = principal * (currentIota * depositPool) / (currentPool * depositIota)
```

**VERDICT:** The formula is actually CORRECT mathematically!

However, there is a subtle issue with the comment on line 354:
```typescript
// Formula: currentValue = principal * (current_iota / current_pool_token) / (deposit_iota / deposit_pool_token)
```

This comment suggests division, but the actual implementation does:
```typescript
const numerator = principal * currentRate.iotaAmount * depositRate.poolTokenAmount;
const denominator = currentRate.poolTokenAmount * depositRate.iotaAmount;
```

**RE-ANALYSIS:** The code IS mathematically correct, but the variable names are confusing:
- `currentRate.iotaAmount` should represent "currentIota"
- `currentRate.poolTokenAmount` should represent "currentPool"
- `depositRate.iotaAmount` should represent "depositIota"
- `depositRate.poolTokenAmount` should represent "depositPool"

So the formula is: `(principal * currentIota * depositPool) / (currentPool * depositIota)`

Which algebraically equals: `principal * (currentIota/currentPool) / (depositIota/depositPool)`

**VERDICT: Formula is CORRECT** - Downgrading from CRITICAL to LOW (documentation issue only)

---

### CRITICAL-2: Division by Zero in Exchange Rate Display

**Location:** Lines 348-351 (calculateExchangeRate function)

**Severity:** CRITICAL (in display context) / MEDIUM (no impact on reward calculation)

**Issue:**
```typescript
function calculateExchangeRate(data: ExchangeRateData): number {
  if (data.poolTokenAmount === 0n) return 1;
  return Number(data.iotaAmount) / Number(data.poolTokenAmount);
}
```

**Problem 1:** This function checks `poolTokenAmount === 0n` and returns 1, but what if `iotaAmount` is also 0? Returning rate=1.0 when the pool has 0 IOTA is misleading.

**Problem 2:** This function converts BigInt to Number, which can lose precision for very large values (>2^53). While this is "for display only" (line 347), it could show incorrect rates.

**Problem 3:** This function is ONLY used for display (line 573, 635) and NOT for actual reward calculation, so it doesn't affect reward accuracy. However, it could mislead users about actual exchange rates.

**Impact:** Medium - Display only, no calculation impact

---

### CRITICAL-3: Missing Pagination for Stakes Table (Line 224-227)

**Location:** Lines 224-227 (useValidatorVaults hook)

**Severity:** CRITICAL

**Issue:**
```typescript
const stakesFields = await client.getDynamicFields({
  parentId: stakesTableId,
  limit: 100,
});
```

**Problem:** The stakes are queried with a limit of 100, but there is NO pagination loop to fetch additional stakes if a validator has more than 100 stake objects.

Compare this to the pagination in `usePoolRewardsEstimate` (lines 482-490):
```typescript
// Get ALL stakes with pagination
const allStakesFields: Awaited<ReturnType<typeof client.getDynamicFields>>["data"] = [];
let stakesCursor: string | null | undefined = null;

do {
  const response = await client.getDynamicFields({
    parentId: stakesTableId,
    limit: 50,
    cursor: stakesCursor ?? undefined,
  });
  allStakesFields.push(...response.data);
  stakesCursor = response.hasNextPage ? response.nextCursor : null;
} while (stakesCursor);
```

**Impact:** If a validator has >100 stakes, the `useValidatorVaults` hook will only return the first 100 and miss the rest. This causes:
1. Incorrect `stakes` array in `ValidatorVaultInfo`
2. Incorrect `totalStaked` display
3. Missing stake data in UI

**Recommendation:** Add pagination loop like in `usePoolRewardsEstimate`

---

### CRITICAL-4: BigInt Overflow Risk

**Location:** Lines 368-369

**Severity:** CRITICAL (theoretical) / LOW (practical)

**Issue:**
```typescript
const numerator = principal * currentRate.iotaAmount * depositRate.poolTokenAmount;
const denominator = currentRate.poolTokenAmount * depositRate.iotaAmount;
```

**Problem:** This performs three BigInt multiplications in sequence:
1. `principal * currentRate.iotaAmount`
2. `(result) * depositRate.poolTokenAmount`

For IOTA with 9 decimals (1 IOTA = 1_000_000_000):
- Typical principal: 1,000 IOTA = 1,000,000,000,000 (1e12)
- Typical iotaAmount: 1,000,000 IOTA = 1e15
- Typical poolTokenAmount: Similar magnitude

Maximum calculation:
```
numerator = 1e12 * 1e15 * 1e15 = 1e42
```

JavaScript BigInt can handle values up to approximately 2^1048576 (astronomically large), so overflow is practically impossible.

**Verdict:** LOW severity - Theoretical concern only, practically impossible to overflow

---

### CRITICAL-5: Fallback Estimation Logic Errors

**Location:** Lines 599-612

**Severity:** CRITICAL

**Issue:**
When deposit exchange rate is missing, the code uses a fallback estimation:

```typescript
// Lines 603-609
const epochsEarning = currentEpoch - stake.activationEpoch;
if (epochsEarning >= 2) {
  // Use a conservative estimate: assume 5% APY, ~0.014% per epoch
  // This is better than returning 0 for old stakes
  const estimatedRewardPercent = BigInt(Math.floor(epochsEarning * 14)); // 0.014% per epoch in basis points
  const estimatedReward = (stake.principal * estimatedRewardPercent) / 1000000n;
  validatorRewards += estimatedReward;
```

**Problem 1 - Mathematical Error:**
The comment says "0.014% per epoch in basis points" but:
- Basis points = 1/10000 = 0.01%
- The code uses `estimatedRewardPercent = epochsEarning * 14`
- Then divides by `1000000n`
- This gives: `(principal * epochsEarning * 14) / 1000000`
- Which equals: `principal * epochsEarning * 0.000014` = 0.0014% per epoch (NOT 0.014%)

**Problem 2 - Incorrect APY Calculation:**
The comment claims "5% APY, ~0.014% per epoch" but:
- 5% APY over 365 days / 24 hour epochs = ~8760 epochs/year (if epochs are 1 hour)
- 5% / 8760 = 0.00057% per epoch
- But IOTA epochs are ~24 hours, so ~365 epochs/year
- 5% / 365 = 0.0137% per epoch (close to 0.014%, but the code implements 0.0014%)

**Problem 3 - Magic Number with no explanation:**
The value `14` and divisor `1000000n` are hardcoded with no clear derivation.

**Problem 4 - Division precision loss:**
```typescript
const estimatedRewardPercent = BigInt(Math.floor(epochsEarning * 14));
```
The `Math.floor` is unnecessary since `epochsEarning` is already an integer. This should be:
```typescript
const estimatedRewardPercent = BigInt(epochsEarning * 14);
```

**Actual Impact:** Rewards are underestimated by 10x (0.0014% instead of 0.014% per epoch)

---

## MEDIUM ISSUES

### MEDIUM-1: Edge Case - Zero Principal Not Handled

**Location:** Lines 356-377

**Severity:** MEDIUM

**Issue:**
The function `calculateRewardBigInt` doesn't explicitly check for `principal === 0n`.

**Current behavior:**
```typescript
if (currentRate.poolTokenAmount === 0n || depositRate.iotaAmount === 0n || depositRate.poolTokenAmount === 0n) {
  return 0n;
}
// ... calculation ...
const reward = currentValue - principal;
return reward > 0n ? reward : 0n;
```

If `principal === 0n`:
- Numerator = 0n * ... = 0n
- currentValue = 0n
- reward = 0n - 0n = 0n
- Returns 0n (correct)

**Verdict:** Works correctly, but should add explicit check for clarity:
```typescript
if (principal === 0n) return 0n;
```

---

### MEDIUM-2: Edge Case - Current Exchange Rate Zero

**Location:** Lines 362-377

**Severity:** MEDIUM

**Issue:**
The code checks for `currentRate.poolTokenAmount === 0n` but NOT for `currentRate.iotaAmount === 0n`.

```typescript
if (currentRate.poolTokenAmount === 0n || depositRate.iotaAmount === 0n || depositRate.poolTokenAmount === 0n) {
  return 0n;
}
```

**Missing check:** `currentRate.iotaAmount === 0n`

**Scenario:** What if the staking pool has been completely slashed or has 0 IOTA balance?

**Impact:**
- If `currentRate.iotaAmount === 0n`, then numerator = 0, currentValue = 0
- reward = 0 - principal = negative
- Returns 0n (due to line 376: `reward > 0n ? reward : 0n`)

**Verdict:** Works correctly due to the `reward > 0n` check, but should be explicit:
```typescript
if (currentRate.iotaAmount === 0n || currentRate.poolTokenAmount === 0n ||
    depositRate.iotaAmount === 0n || depositRate.poolTokenAmount === 0n) {
  return 0n;
}
```

---

### MEDIUM-3: Edge Case - Very Old Stakes Without Exchange Rate

**Location:** Lines 557-612

**Severity:** MEDIUM

**Issue:**
For very old stakes where exchange rate data is not available, the code tries to use a fallback (lines 599-612). However:

1. The fallback only triggers if `epochsEarning >= 2` (line 603)
2. For stakes with `epochsEarning === 1`, no rewards are calculated (returns 0)

**Scenario:**
- Stake activated at epoch 100
- Current epoch is 101
- Exchange rate data missing for epoch 100
- `epochsEarning = 101 - 100 = 1`
- Fallback doesn't trigger (requires >= 2)
- Returns 0 rewards (incorrect - should have 1 epoch of rewards)

**Impact:** Stakes that have earned rewards for exactly 1 epoch will show 0 rewards if exchange rate data is missing.

**Recommendation:** Change condition from `>= 2` to `>= 1`

---

## LOW ISSUES

### LOW-1: Inconsistent Pagination Limits

**Locations:** Multiple

**Issue:**
- Vaults pagination: limit 50 (line 189)
- Stakes in useValidatorVaults: limit 100, NO pagination (line 226)
- Stakes in usePoolRewardsEstimate: limit 50 WITH pagination (line 485)

**Recommendation:** Standardize to limit 50 with pagination everywhere

---

### LOW-2: Activation Epoch Logic Clarity

**Location:** Lines 578-581

**Issue:**
```typescript
const isActive = stake.activationEpoch <= currentEpoch;
const isEarning = stake.activationEpoch < currentEpoch; // Rewards start next epoch
```

**Comment says "Rewards start next epoch"** but this is slightly ambiguous.

**Clarification:**
- Stake created at epoch N
- `activationEpoch = N`
- At epoch N: `isActive = true, isEarning = false` (pending, not earning)
- At epoch N+1: `isActive = true, isEarning = true` (active, earning)

This is CORRECT per IOTA staking rules, but the variable name `rewardsStartEpoch: activationEpoch + 1` (line 248) is clearer.

---

### LOW-3: Type Safety Issue with `any`

**Locations:** Multiple (lines 170, 201, 211, 238, 423, 457, 471, 509, 547)

**Issue:**
Heavy use of `eslint-disable-next-line @typescript-eslint/no-explicit-any` and `as any` casts.

**Recommendation:** Define proper TypeScript interfaces for:
- Pool fields structure
- Vault fields structure
- Stake fields structure
- Exchange rate fields structure

---

## PAGINATION ANALYSIS

### Correct Pagination Loops

**usePoolRewardsEstimate - Vaults** (lines 436-447): CORRECT
```typescript
const allVaultFields: Awaited<ReturnType<typeof client.getDynamicFields>>["data"] = [];
let vaultCursor: string | null | undefined = null;

do {
  const response = await client.getDynamicFields({
    parentId: vaultsTableId,
    limit: 50,
    cursor: vaultCursor ?? undefined,
  });
  allVaultFields.push(...response.data);
  vaultCursor = response.hasNextPage ? response.nextCursor : null;
} while (vaultCursor);
```

**Analysis:**
- Initializes cursor to null
- Checks `hasNextPage` before setting next cursor
- Loop continues while cursor is truthy
- No infinite loop risk - cursor becomes null when no more pages

**usePoolRewardsEstimate - Stakes** (lines 478-490): CORRECT (same pattern)

**useValidatorVaults - Vaults** (lines 183-194): CORRECT (same pattern)

### Missing Pagination

**useValidatorVaults - Stakes** (lines 223-227): MISSING PAGINATION
```typescript
const stakesFields = await client.getDynamicFields({
  parentId: stakesTableId,
  limit: 100,
});
```

**Impact:** Will only fetch first 100 stakes per validator

---

## DATA INTEGRITY ANALYSIS

### Stake Data Parsing (lines 238-250)

```typescript
const stakeData = (stakeObj.data.content.fields as any)?.value?.fields || stakeObj.data.content.fields;

// StakedIota fields: id, pool_id, stake_activation_epoch, principal
const principal = BigInt(stakeData?.principal || "0");
const activationEpoch = parseInt(stakeData?.stake_activation_epoch || "0");

stakes.push({
  objectId: stakeField.objectId,
  principal,
  activationEpoch,
  rewardsStartEpoch: activationEpoch + 1,
});
```

**Analysis:**
- CORRECT: Uses optional chaining and fallback to "0"
- CORRECT: `rewardsStartEpoch: activationEpoch + 1` matches IOTA staking rules
- CORRECT: Parses `principal` as BigInt
- CORRECT: Parses `stake_activation_epoch` as integer

### Exchange Rate Data Parsing (lines 551-555)

```typescript
const rateFields = (rateObj.data.content.fields as any)?.value?.fields ||
  (rateObj.data.content.fields as any)?.value ||
  rateObj.data.content.fields;
depositRates.set(epoch, {
  iotaAmount: BigInt(rateFields?.iota_amount || "0"),
  poolTokenAmount: BigInt(rateFields?.pool_token_amount || "0"),
});
```

**Analysis:**
- CORRECT: Tries multiple possible field paths
- CORRECT: Uses fallback to "0" for missing data
- CORRECT: Stores as BigInt

---

## EARNING LOGIC VERIFICATION

### Stakes Earning Timeline (lines 578-614)

```typescript
// Check if stake is active AND earning (rewards start at activation + 1)
// Stake lifecycle: created -> pending (activation epoch) -> active (activation+1 onwards)
const isActive = stake.activationEpoch <= currentEpoch;
const isEarning = stake.activationEpoch < currentEpoch; // Rewards start next epoch
```

**IOTA Staking Rules:**
1. Stake created in epoch N with `activationEpoch = N`
2. At epoch N: Stake is "pending" (active but not earning)
3. At epoch N+1: Stake starts earning rewards
4. At epoch N+2, N+3, ...: Continues earning

**Code Behavior:**
| Current Epoch | activationEpoch | isActive | isEarning | Status |
|--------------|----------------|----------|-----------|---------|
| N            | N              | true     | false     | Pending (Correct) |
| N+1          | N              | true     | true      | Earning (Correct) |
| N+2          | N              | true     | true      | Earning (Correct) |
| N-1          | N              | false    | false     | Future stake (Correct) |

**VERDICT: CORRECT** - The earning logic properly implements IOTA staking rules

---

## SUMMARY OF FINDINGS

### Critical Issues (5 → 1 after re-analysis)
1. ~~Mathematical formula error~~ - FALSE ALARM, formula is correct
2. ~~Division by zero~~ - Display only, no calculation impact → MEDIUM
3. **Missing pagination for stakes** - Can miss data → CRITICAL
4. ~~BigInt overflow~~ - Practically impossible → LOW
5. **Fallback estimation errors** - Underestimates by 10x → CRITICAL

### Medium Issues (3)
1. Zero principal edge case - Works but should be explicit
2. Zero current exchange rate - Works but should be explicit
3. Very old stakes fallback threshold - Should be >= 1, not >= 2

### Low Issues (3)
1. Inconsistent pagination limits
2. Variable naming clarity
3. Type safety with `any` casts

---

## RECOMMENDATIONS

### Immediate Fixes Required

1. **Add pagination to useValidatorVaults stakes query** (CRITICAL-3)
2. **Fix fallback estimation math** (CRITICAL-5)
3. **Lower fallback threshold from 2 to 1** (MEDIUM-3)
4. **Add explicit zero checks** (MEDIUM-1, MEDIUM-2)

### Code Improvements

1. Standardize pagination limits to 50
2. Define proper TypeScript interfaces
3. Add explicit edge case handling for zero values
4. Document the reward calculation formula more clearly

---

## TESTING RECOMMENDATIONS

### Test Cases for Reward Calculation

1. **Normal case**: Stake with valid exchange rates at both epochs
2. **Zero principal**: Stake with 0 principal
3. **Zero current rate**: Current exchange rate is 0 (slashed validator)
4. **Zero deposit rate**: Deposit exchange rate is 0 (impossible but defensive)
5. **Missing deposit rate**: Old stake without exchange rate data
6. **Pending stake**: Stake at activation epoch (not earning yet)
7. **New active stake**: Stake at activation+1 epoch (just started earning)
8. **Old stake**: Stake with many epochs of rewards
9. **Very large principal**: Test for overflow (1M IOTA)
10. **Very small principal**: Test precision (0.001 IOTA)

### Test Cases for Pagination

1. **Single page**: < 50 vaults, < 50 stakes per vault
2. **Multiple pages**: > 50 vaults
3. **Many stakes**: Validator with > 100 stakes
4. **Empty vault**: Validator with 0 stakes

---

## CONCLUSION

The reward calculation logic is mostly sound, but has **2 critical bugs**:

1. **Missing pagination** will cause data loss for validators with >100 stakes
2. **Fallback estimation** underestimates rewards by 10x due to mathematical error

The core BigInt formula for reward calculation is **mathematically correct**. The edge case handling is **mostly adequate** but should be more explicit. The earning logic **correctly implements** IOTA staking rules.

**Risk Assessment:** MEDIUM-HIGH
- Core formula: CORRECT
- Edge cases: ADEQUATE with improvements needed
- Pagination: BROKEN for one query
- Fallback logic: BROKEN (10x underestimate)

**Recommended Actions:**
1. Fix pagination immediately (data integrity issue)
2. Fix fallback math immediately (10x error is significant)
3. Add explicit zero checks (defensive programming)
4. Add comprehensive unit tests
