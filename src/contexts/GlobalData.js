import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import { client } from '../apollo/client'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useTimeframe } from './Application'
import { getPercentChange, getBlocksFromTimestamps, get2DayPercentChange, getTimeframe } from '../utils'
import { GLOBAL_DATA, GLOBAL_TXNS, GLOBAL_CHART, ALL_PAIRS, ALL_TOKENS, TOP_LPS_PER_PAIRS } from '../apollo/queries'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { useAllPairData } from './PairData'
import CoinGecko from 'coingecko-api'
import { useChainId } from './Application'
const UPDATE = 'UPDATE'
const UPDATE_TXNS = 'UPDATE_TXNS'
const UPDATE_CHART = 'UPDATE_CHART'
const UPDATE_AVAX_PRICE = 'UPDATE_AVAX_PRICE'
const AVAX_PRICE_KEY = 'AVAX_PRICE_KEY'
const UPDATE_ALL_PAIRS_IN_UNISWAP = 'UPDATE_ALL_PAIRS_IN_UNISWAP'
const UPDATE_ALL_TOKENS_IN_UNISWAP = 'UPDATE_ALL_TOKENS_IN_UNISWAP'
const UPDATE_TOP_LPS = 'UPDATE_TOP_LPS'

const coinGeckoClient = new CoinGecko()

// format dayjs with the libraries that we need
dayjs.extend(utc)
dayjs.extend(weekOfYear)

const GlobalDataContext = createContext()

function useGlobalDataContext() {
  return useContext(GlobalDataContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE: {
      const { data } = payload
      return {
        ...state,
        globalData: data
      }
    }
    case UPDATE_TXNS: {
      const { transactions } = payload
      return {
        ...state,
        transactions
      }
    }
    case UPDATE_CHART: {
      const { daily, weekly } = payload
      return {
        ...state,
        chartData: {
          daily,
          weekly
        }
      }
    }
    case UPDATE_AVAX_PRICE: {
      const { avaxPrice, oneDayPrice, avaxPriceChange } = payload
      return {
        [AVAX_PRICE_KEY]: avaxPrice,
        oneDayPrice,
        avaxPriceChange
      }
    }

    case UPDATE_ALL_PAIRS_IN_UNISWAP: {
      const { allPairs } = payload
      return {
        ...state,
        allPairs
      }
    }

    case UPDATE_ALL_TOKENS_IN_UNISWAP: {
      const { allTokens } = payload
      return {
        ...state,
        allTokens
      }
    }

    case UPDATE_TOP_LPS: {
      const { topLps } = payload
      return {
        ...state,
        topLps
      }
    }
    default: {
      throw Error(`Unexpected action type in DataContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, {})
  const update = useCallback((data) => {
    dispatch({
      type: UPDATE,
      payload: {
        data
      }
    })
  }, [])

  const updateTransactions = useCallback((transactions) => {
    dispatch({
      type: UPDATE_TXNS,
      payload: {
        transactions
      }
    })
  }, [])

  const updateChart = useCallback((daily, weekly) => {
    dispatch({
      type: UPDATE_CHART,
      payload: {
        daily,
        weekly
      }
    })
  }, [])

  const updateAvaxPrice = useCallback((avaxPrice, oneDayPrice, avaxPriceChange) => {
    dispatch({
      type: UPDATE_AVAX_PRICE,
      payload: {
        avaxPrice,
        oneDayPrice,
        avaxPriceChange
      }
    })
  }, [])

  const updateAllPairsInUniswap = useCallback((allPairs) => {
    dispatch({
      type: UPDATE_ALL_PAIRS_IN_UNISWAP,
      payload: {
        allPairs
      }
    })
  }, [])

  const updateAllTokensInUniswap = useCallback((allTokens) => {
    dispatch({
      type: UPDATE_ALL_TOKENS_IN_UNISWAP,
      payload: {
        allTokens
      }
    })
  }, [])

  const updateTopLps = useCallback((topLps) => {
    dispatch({
      type: UPDATE_TOP_LPS,
      payload: {
        topLps
      }
    })
  }, [])
  return (
    <GlobalDataContext.Provider
      value={useMemo(
        () => [
          state,
          {
            update,
            updateTransactions,
            updateChart,
            updateAvaxPrice,
            updateTopLps,
            updateAllPairsInUniswap,
            updateAllTokensInUniswap
          }
        ],
        [state, update, updateTransactions, updateTopLps, updateChart, updateAvaxPrice, updateAllPairsInUniswap, updateAllTokensInUniswap]
      )}
    >
      {children}
    </GlobalDataContext.Provider>
  )
}

/**
 * Gets all the global data for the overview page.
 * Needs current avax price and the old avax price to get
 * 24 hour USD changes.
 * @param {*} avaxPrice
 * @param {*} oldAvaxPrice
 */
async function getGlobalData(avaxPrice, oldAvaxPrice, chainId) {
  // data for each day, historic data used for % changes
  let data = {}
  let oneDayData = {}
  let twoDayData = {}

  try {
    // get timestamps for the days
    const utcCurrentTime = dayjs()
    const utcOneDayBack = utcCurrentTime.subtract(1, 'day').unix()
    const utcTwoDaysBack = utcCurrentTime.subtract(2, 'day').unix()
    const utcOneWeekBack = utcCurrentTime.subtract(1, 'week').unix()
    const utcTwoWeeksBack = utcCurrentTime.subtract(2, 'week').unix()

    // get the blocks needed for time travel queries
    let [oneDayBlock, twoDayBlock, oneWeekBlock, twoWeekBlock] = await getBlocksFromTimestamps(
      [utcOneDayBack, utcTwoDaysBack, utcOneWeekBack, utcTwoWeeksBack],
      chainId
    )

    // fetch the global data
    let result = await client(chainId).query({
      query: GLOBAL_DATA({ chainId: chainId }),
      fetchPolicy: 'cache-first'
    })
    data = result.data.polarfoxFactories[0]

    // fetch the historical data
    let oneDayResult = await client(chainId).query({
      query: GLOBAL_DATA({ block: oneDayBlock?.number, chainId }),
      fetchPolicy: 'cache-first'
    })
    oneDayData = oneDayResult.data.polarfoxFactories[0]

    let twoDayResult = await client(chainId).query({
      query: GLOBAL_DATA({ block: twoDayBlock?.number, chainId }),
      fetchPolicy: 'cache-first'
    })
    twoDayData = twoDayResult.data.polarfoxFactories[0]

    let oneWeekResult = await client(chainId).query({
      query: GLOBAL_DATA({ block: oneWeekBlock?.number, chainId }),
      fetchPolicy: 'cache-first'
    })
    const oneWeekData = oneWeekResult.data.polarfoxFactories[0]

    let twoWeekResult = await client(chainId).query({
      query: GLOBAL_DATA({ block: twoWeekBlock?.number, chainId }),
      fetchPolicy: 'cache-first'
    })
    const twoWeekData = twoWeekResult.data.polarfoxFactories[0]

    if (data) {
      //if (data && oneDayData && twoDayData && twoWeekData) {

      // format the total liquidity in USD
      data.totalLiquidityUSD = data.totalLiquidityAVAX * avaxPrice
      data.totalVolumeUSD = data.totalVolumeAVAX * avaxPrice
      data.untrackedVolumeUSD = data.untrackedVolumeAVAX * avaxPrice

      if (oneDayData) {
        oneDayData.totalLiquidityUSD = oneDayData.totalLiquidityAVAX * avaxPrice
        oneDayData.totalVolumeUSD = oneDayData.totalVolumeAVAX * avaxPrice
        oneDayData.untrackedVolumeUSD = oneDayData.untrackedVolumeAVAX * avaxPrice
      }

      if (twoDayData) {
        twoDayData.totalLiquidityUSD = twoDayData.totalLiquidityAVAX * avaxPrice
        twoDayData.totalVolumeUSD = twoDayData.totalVolumeAVAX * avaxPrice
        twoDayData.untrackedVolumeUSD = twoDayData.untrackedVolumeAVAX * avaxPrice
      }

      if (oneWeekData) {
        oneWeekData.totalLiquidityUSD = oneWeekData.totalLiquidityAVAX * avaxPrice
        oneWeekData.totalVolumeUSD = oneWeekData.totalVolumeAVAX * avaxPrice
        oneWeekData.untrackedVolumeUSD = oneWeekData.untrackedVolumeAVAX * avaxPrice
      }

      if (twoWeekData) {
        twoWeekData.totalLiquidityUSD = twoWeekData.totalLiquidityAVAX * avaxPrice
        twoWeekData.totalVolumeUSD = twoWeekData.totalVolumeAVAX * avaxPrice
        twoWeekData.untrackedVolumeUSD = twoWeekData.untrackedVolumeAVAX * avaxPrice
      }

      if (oneDayData && twoDayData) {
        let [oneDayVolumeUSD, volumeChangeUSD] = get2DayPercentChange(
          data.totalVolumeUSD,
          oneDayData.totalVolumeUSD ? oneDayData.totalVolumeUSD : 0,
          twoDayData.totalVolumeUSD ? twoDayData.totalVolumeUSD : 0
        )

        const [oneDayTxns, txnChange] = get2DayPercentChange(
          data.txCount,
          oneDayData.txCount ? oneDayData.txCount : 0,
          twoDayData.txCount ? twoDayData.txCount : 0
        )

        if (twoWeekData) {
          const [oneWeekVolume, weeklyVolumeChange] = get2DayPercentChange(
            data.totalVolumeUSD,
            oneWeekData.totalVolumeUSD,
            twoWeekData.totalVolumeUSD
          )
          data.oneWeekVolume = oneWeekVolume
          data.weeklyVolumeChange = weeklyVolumeChange
        }

        const liquidityChangeUSD = getPercentChange(data.totalLiquidityAVAX, oneDayData.totalLiquidityAVAX)
        data.liquidityChangeUSD = liquidityChangeUSD

        // add relevant fields with the calculated amounts
        data.oneDayVolumeUSD = oneDayVolumeUSD
        data.volumeChangeUSD = volumeChangeUSD
        data.oneDayTxns = oneDayTxns
        data.txnChange = txnChange
      }
    }
  } catch (e) {
    console.log(e)
  }

  return data
}

/**
 * Get historical data for volume and liquidity used in global charts
 * on main page
 * @param {*} oldestDateToFetch // start of window to fetch from
 */
const getChartData = async (oldestDateToFetch, avaxPrice, chainId) => {
  let data = []
  let weeklyData = []
  const utcEndTime = dayjs.utc()
  let skip = 0
  let allFound = false

  try {
    while (!allFound) {
      let result = await client(chainId).query({
        query: GLOBAL_CHART,
        variables: {
          startTime: oldestDateToFetch,
          skip
        },
        fetchPolicy: 'cache-first'
      })
      skip += 1000
      data = data.concat(result.data.polarfoxDayDatas)
      if (result.data.polarfoxDayDatas.length < 1000) {
        allFound = true
      }
    }

    if (data) {
      let dayIndexSet = new Set()
      let dayIndexArray = []
      const oneDay = 24 * 60 * 60

      // for each day, parse the daily volume and format for chart array
      data.forEach((dayData, i) => {
        // add the day index to the set of days
        dayIndexSet.add((data[i].date / oneDay).toFixed(0))
        dayIndexArray.push(data[i])
        dayData.dailyVolumeAVAX = parseFloat(dayData.dailyVolumeAVAX)
        dayData.dailyVolumeUSD = dayData.dailyVolumeAVAX * avaxPrice
        dayData.totalVolumeAVAX = parseFloat(dayData.totalVolumeAVAX)
        dayData.totalVolumeUSD = dayData.totalVolumeAVAX * avaxPrice
        dayData.totalLiquidityAVAX = parseFloat(dayData.totalLiquidityAVAX)
        dayData.totalLiquidityUSD = dayData.totalLiquidityAVAX * avaxPrice
      })

      // fill in empty days ( there will be no day datas if no trades made that day )
      let timestamp = data[0].date ? data[0].date : oldestDateToFetch
      let latestLiquidityAVAX = data[0].totalLiquidityAVAX
      let latestLiquidityUSD = data[0].totalLiquidityAVAX * avaxPrice
      let latestDayDats = data[0].mostLiquidTokens
      let index = 1
      while (timestamp < utcEndTime.unix() - oneDay) {
        const nextDay = timestamp + oneDay
        let currentDayIndex = (nextDay / oneDay).toFixed(0)
        if (!dayIndexSet.has(currentDayIndex)) {
          data.push({
            date: nextDay,
            dailyVolumeAVAX: 0,
            dailyVolumeUSD: 0,
            totalLiquidityAVAX: latestLiquidityAVAX,
            totalLiquidityUSD: latestLiquidityUSD,
            mostLiquidTokens: latestDayDats
          })
        } else {
          latestLiquidityUSD = dayIndexArray[index].totalLiquidityUSD
          latestDayDats = dayIndexArray[index].mostLiquidTokens
          index = index + 1
        }
        timestamp = nextDay
      }
    }

    // format weekly data for weekly sized chunks
    data = data.sort((a, b) => (parseInt(a.date) > parseInt(b.date) ? 1 : -1))
    let startIndexWeekly = -1
    let currentWeek = -1
    data.forEach((entry, i) => {
      const week = dayjs.utc(dayjs.unix(data[i].date)).week()
      if (week !== currentWeek) {
        currentWeek = week
        startIndexWeekly++
      }
      weeklyData[startIndexWeekly] = weeklyData[startIndexWeekly] || {}
      weeklyData[startIndexWeekly].date = data[i].date
      weeklyData[startIndexWeekly].weeklyVolumeAVAX = (weeklyData[startIndexWeekly].weeklyVolumeAVAX ?? 0) + data[i].dailyVolumeAVAX
      weeklyData[startIndexWeekly].weeklyVolumeUSD = (weeklyData[startIndexWeekly].weeklyVolumeUSD ?? 0) + data[i].dailyVolumeUSD
    })
  } catch (e) {
    console.log(e)
  }
  return [data, weeklyData]
}

/**
 * Get and format transactions for global page
 */
const getGlobalTransactions = async (chainId) => {
  let transactions = {}

  try {
    let avaxPrice = await getCurrentAvaxPrice()

    let result = await client(chainId).query({
      query: GLOBAL_TXNS,
      fetchPolicy: 'cache-first'
    })
    transactions.mints = []
    transactions.burns = []
    transactions.swaps = []
    result?.data?.transactions &&
      result.data.transactions.map((transaction) => {
        if (transaction.mints.length > 0) {
          transaction.mints.map((mint) => {
            mint.amountUSD = (parseFloat(mint.amountAVAX) * avaxPrice).toString()
            return transactions.mints.push(mint)
          })
        }
        if (transaction.burns.length > 0) {
          transaction.burns.map((burn) => {
            burn.amountUSD = (parseFloat(burn.amountAVAX) * avaxPrice).toString()
            return transactions.burns.push(burn)
          })
        }
        if (transaction.swaps.length > 0) {
          transaction.swaps.map((swap) => {
            swap.amountUSD = (parseFloat(swap.amountAVAX) * avaxPrice).toString()
            return transactions.swaps.push(swap)
          })
        }
        return true
      })
  } catch (e) {
    console.log(e)
  }

  return transactions
}

/**
 * Gets the current price of AVAX, 24 hour price, and % change between them
 */
const getAvaxPrice = async () => {
  const utcCurrentTime = dayjs()
  const utcOneDayBack = utcCurrentTime.subtract(1, 'day').startOf('minute').unix() * 1000

  let result = await coinGeckoClient.simple.price({
    ids: ['avalanche-2'],
    vs_currencies: ['usd'],
    include_24hr_change: ['true']
  })

  let avaxPrice = result['data']['avalanche-2']['usd']
  let priceChangeAVAX = result['data']['avalanche-2']['usd_24h_change']

  result = await coinGeckoClient.coins.fetchMarketChart('avalanche-2', {
    days: 1,
    vs_currency: 'usd'
  })

  let avaxPriceOneDay = 0

  let i
  let snapshot
  for (i = 0; i < result['data']['prices'].length; i++) {
    snapshot = result['data']['prices'][i]
    if (snapshot[0] > utcOneDayBack) {
      avaxPriceOneDay = snapshot[1]
      break
    }
  }

  return [avaxPrice, avaxPriceOneDay, priceChangeAVAX]
}

export const getAvaxPriceAtTimestamp = async (timestamp) => {
  const utcCurrentTime = Date.now() / 1000
  let diff = utcCurrentTime - timestamp
  let days_back = Math.round(diff / (60 * 60 * 24))

  let result = await coinGeckoClient.coins.fetchMarketChart('avalanche-2', {
    days: days_back,
    vs_currency: 'usd'
  })

  return result['data']['prices']
}

export const getCurrentAvaxPrice = async () => {
  let result = await coinGeckoClient.simple.price({
    ids: ['avalanche-2'],
    vs_currencies: ['usd']
  })

  let avaxPrice = result['data']['avalanche-2']['usd']

  return avaxPrice
}

/**
 * Gets the price of AVAX at a given point in time
 */
export const getAvaxPriceAtDate = async (timestamp) => {
  let datetime = new Date(timestamp * 1000) // convert to milliseconds

  let dateString = datetime.getDate() + '-' + (datetime.getMonth() + 1) + '-' + datetime.getFullYear()

  let result = await coinGeckoClient.coins.fetchHistory('avalanche-2', {
    date: dateString
  })

  let avaxPrice = result['data']['market_data']['current_price']['usd']

  return avaxPrice
}

const PAIRS_TO_FETCH = 500
const TOKENS_TO_FETCH = 500

/**
 * Loop through every pair on uniswap, used for search
 */
async function getAllPairsOnUniswap(chainId) {
  try {
    let allFound = false
    let pairs = []
    let skipCount = 0
    while (!allFound) {
      let result = await client(chainId).query({
        query: ALL_PAIRS,
        variables: {
          skip: skipCount
        },
        fetchPolicy: 'cache-first'
      })
      skipCount = skipCount + PAIRS_TO_FETCH
      pairs = pairs.concat(result?.data?.pairs)
      if (result?.data?.pairs.length < PAIRS_TO_FETCH || pairs.length > PAIRS_TO_FETCH) {
        allFound = true
      }
    }
    return pairs
  } catch (e) {
    console.log(e)
  }
}

/**
 * Loop through every token on uniswap, used for search
 */
async function getAllTokensOnUniswap(chainId) {
  try {
    let allFound = false
    let skipCount = 0
    let tokens = []
    while (!allFound) {
      let result = await client(chainId).query({
        query: ALL_TOKENS,
        variables: {
          skip: skipCount
        },
        fetchPolicy: 'cache-first'
      })
      tokens = tokens.concat(result?.data?.tokens)
      if (result?.data?.tokens?.length < TOKENS_TO_FETCH || tokens.length > TOKENS_TO_FETCH) {
        allFound = true
      }
      skipCount = skipCount += TOKENS_TO_FETCH
    }
    return tokens
  } catch (e) {
    console.log(e)
  }
}

/**
 * Hook that fetches overview data, plus all tokens and pairs for search
 */
export function useGlobalData() {
  const { chainId } = useChainId()
  const [state, { update, updateAllPairsInUniswap, updateAllTokensInUniswap }] = useGlobalDataContext()
  const [avaxPrice, oldAvaxPrice] = useAvaxPrice()

  const data = state?.globalData

  useEffect(() => {
    async function fetchData() {
      let globalData = await getGlobalData(avaxPrice, oldAvaxPrice, chainId)
      globalData && update(globalData)

      let allPairs = await getAllPairsOnUniswap(chainId)
      updateAllPairsInUniswap(allPairs)

      let allTokens = await getAllTokensOnUniswap(chainId)
      updateAllTokensInUniswap(allTokens)
    }
    if (!data && avaxPrice && oldAvaxPrice) {
      fetchData()
    }
  }, [avaxPrice, oldAvaxPrice, update, data, updateAllPairsInUniswap, updateAllTokensInUniswap, chainId])

  return data || {}
}

export function useGlobalChartData() {
  const { chainId } = useChainId()
  const [state, { updateChart }] = useGlobalDataContext()
  const [oldestDateFetch, setOldestDateFetched] = useState()
  const [activeWindow] = useTimeframe()

  const chartDataDaily = state?.chartData?.daily
  const chartDataWeekly = state?.chartData?.weekly

  const [avaxPrice] = useAvaxPrice()

  /**
   * Keep track of oldest date fetched. Used to
   * limit data fetched until it is actually needed.
   * (do not fetch year long stuff unless year option selected)
   */
  useEffect(() => {
    // based on window, get starttime
    let startTime = getTimeframe(activeWindow)

    if ((activeWindow && startTime < oldestDateFetch) || !oldestDateFetch) {
      setOldestDateFetched(startTime)
    }
  }, [activeWindow, oldestDateFetch])

  /**
   * Fetch data if none fetched or older data is needed
   */
  useEffect(() => {
    async function fetchData() {
      // historical stuff for chart
      let [newChartData, newWeeklyData] = await getChartData(oldestDateFetch, avaxPrice, chainId)
      updateChart(newChartData, newWeeklyData)
    }
    if (oldestDateFetch && !(chartDataDaily && chartDataWeekly)) {
      fetchData()
    }
  }, [chartDataDaily, chartDataWeekly, oldestDateFetch, updateChart, avaxPrice, chainId])

  return [chartDataDaily, chartDataWeekly]
}

export function useGlobalTransactions() {
  const { chainId } = useChainId()
  const [state, { updateTransactions }] = useGlobalDataContext()
  const transactions = state?.transactions
  useEffect(() => {
    async function fetchData() {
      if (!transactions) {
        let txns = await getGlobalTransactions(chainId)
        updateTransactions(txns)
      }
    }
    fetchData()
  }, [updateTransactions, transactions, chainId])
  return transactions
}

export function useAvaxPrice() {
  const [state, { updateAvaxPrice }] = useGlobalDataContext()
  const avaxPrice = state?.[AVAX_PRICE_KEY]
  const avaxPriceOld = state?.['oneDayPrice']
  useEffect(() => {
    async function checkForAvaxPrice() {
      if (!avaxPrice) {
        let [newPrice, oneDayPrice, priceChange] = await getAvaxPrice()
        updateAvaxPrice(newPrice, oneDayPrice, priceChange)
      }
    }
    checkForAvaxPrice()
  }, [avaxPrice, updateAvaxPrice])

  return [avaxPrice, avaxPriceOld]
}

export function useAllPairsInUniswap() {
  const [state] = useGlobalDataContext()
  let allPairs = state?.allPairs

  return allPairs || []
}

export function useAllTokensInUniswap() {
  const [state] = useGlobalDataContext()
  let allTokens = state?.allTokens

  return allTokens || []
}

/**
 * Get the top liquidity positions based on AVAX size
 * @TODO Not a perfect lookup needs improvement
 */
export function useTopLps() {
  const { chainId } = useChainId()
  const [state, { updateTopLps }] = useGlobalDataContext()
  let topLps = state?.topLps

  const allPairs = useAllPairData()

  let [avaxPrice] = useAvaxPrice()

  useEffect(() => {
    async function fetchData() {
      // get top 20 by reserves
      let topPairs = Object.keys(allPairs)
        ?.sort((a, b) => parseFloat(allPairs[a].reserveAVAX > allPairs[b].reserveAVAX ? -1 : 1))
        ?.slice(0, 99)
        .map((pair) => pair)

      let topLpLists = await Promise.all(
        topPairs.map(async (pair) => {
          // for each one, fetch top LPs
          try {
            const { data: results } = await client(chainId).query({
              query: TOP_LPS_PER_PAIRS,
              variables: {
                pair: pair.toString()
              },
              fetchPolicy: 'cache-first'
            })
            if (results) {
              return results.liquidityPositions
            }
          } catch (e) {}
        })
      )

      // get the top lps from the results formatted
      const topLps = []
      topLpLists
        .filter((i) => !!i) // check for ones not fetched correctly
        .map((list) => {
          return list.map((entry) => {
            const pairData = allPairs[entry.pair.id]
            const usd =
              (parseFloat(entry.liquidityTokenBalance) / parseFloat(pairData.totalSupply)) * parseFloat(pairData.reserveAVAX) * avaxPrice
            if (usd) {
              return topLps.push({
                user: entry.user,
                pairName: pairData.token0.symbol + '-' + pairData.token1.symbol,
                pairAddress: entry.pair.id,
                token0: pairData.token0.id,
                token1: pairData.token1.id,
                usd: usd
              })
            }
            return null
          })
        })

      const sorted = topLps.sort((a, b) => (a.usd > b.usd ? -1 : 1))
      const shorter = sorted.splice(0, 100)
      updateTopLps(shorter)
    }

    if (!topLps && allPairs && Object.keys(allPairs).length > 0) {
      fetchData()
    }
  })

  return topLps
}
