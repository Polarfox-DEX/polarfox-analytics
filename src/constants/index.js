// Chain ID
export const CHAIN_ID = {
  AVALANCHE: 43114,
  FUJI: 43113
}

// Default chain ID
export const DEFAULT_CHAIN_ID = CHAIN_ID.FUJI

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// !! Needs to be lowercase
// TODO: Add Avalanche
export const FACTORY_ADDRESS = {
  [CHAIN_ID.AVALANCHE]: ZERO_ADDRESS,
  [CHAIN_ID.FUJI]: '0xdb7d8719a03d02fc7595803f8365e3fa3364fce5'
}

export const WAVAX_ADDRESS = {
  [CHAIN_ID.AVALANCHE]: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  [CHAIN_ID.FUJI]: '0xd00ae08403b9bbb9124bb305c09058e32c39a48c'
}

export const BUNDLE_ID = {
  [CHAIN_ID.AVALANCHE]: '1',
  [CHAIN_ID.FUJI]: '1'
}

export const timeframeOptions = {
  WEEK: '1 week',
  MONTH: '1 month',
  // THREE_MONTHS: '3 months',
  // YEAR: '1 year',
  ALL_TIME: 'All time'
}

// Token list URLs to fetch tokens from - use for warnings on tokens and pairs
// TODO: Add Avalanche
export const SUPPORTED_LIST_URLS__NO_ENS = {
  [CHAIN_ID.AVALANCHE]: [],
  [CHAIN_ID.FUJI]: ['https://raw.githubusercontent.com/Polarfox-DEX/polarfox-token-lists/master/43113/fuji-token-list.json']
}

// Hide from overview list
export const OVERVIEW_TOKEN_BLACKLIST = {
  [CHAIN_ID.AVALANCHE]: [],
  [CHAIN_ID.FUJI]: []
}

// Pair blacklist
export const PAIR_BLACKLIST = {
  [CHAIN_ID.AVALANCHE]: [],
  [CHAIN_ID.FUJI]: []
}

// For tokens that cause errors on fee calculations
export const FEE_WARNING_TOKENS = {
  [CHAIN_ID.AVALANCHE]: [],
  [CHAIN_ID.FUJI]: []
}
