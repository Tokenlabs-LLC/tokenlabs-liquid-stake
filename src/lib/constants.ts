// Contract addresses and IDs for IOTA Testnet (Deployed: 2025-12-11 - v3 tIOTA name)
export const PACKAGE_ID = "0xfb784a42f5a09475a72df201b6d0053911c7639bfc073b5895e2875ec6c156d4";
export const POOL_ID = "0x8f0cf942f3dd1cfa14288ac6a1b81f94bbb87ee77ace13c762b0dc770dfcafe6";
export const METADATA_ID = "0x19286e9d5eaee1a434e9dbe2e349165e1b73d3e8e7afb77aac89f8c7fb317f78";
export const OWNER_CAP_ID = "0x5b449bf4653a379e10774800d1d7e4217297536973dc7df6a03b288f655b74d3";
export const OPERATOR_CAP_ID = "0xc60ee47357fa37374e3876e3e7f3636c80db72a1e1eea8a048dd9e1b7bf98915";

// System objects
export const SYSTEM_STATE = "0x5";
export const CLOCK = "0x6";

// Token type
export const CERT_TYPE = `${PACKAGE_ID}::cert::CERT`;

// Constants
export const ONE_IOTA = 1_000_000_000n;
export const DECIMALS = 9;
export const MAX_PERCENT = 10000;

// Token logos
export const IOTA_LOGO = "https://s2.coinmarketcap.com/static/img/coins/64x64/1720.png";
export const TIOTA_LOGO = "https://tokenlabs.network/tIOTA.png";

// Default validators for automatic staking
export const DEFAULT_VALIDATORS = [
  {
    name: "Tokenlabs",
    address: "0xd20c0b7ab20ac195bc5fac68388fc2be75145059cbbdefe651ca986d8760c136",
    priority: 100
  },
  {
    name: "DLT.GREEN",
    address: "0xe1a4e6303a75ec1fa70e086368bebc3a615394d83307a056d4eabf729b6f6a5f",
    priority: 90
  },
  {
    name: "SDVC",
    address: "0x13f11b0548895a8514324f9f3c07c8f50725491f30c39d374ee7952a74cf9585",
    priority: 80
  },
];

// Network configuration
export const NETWORK = "testnet" as const;
