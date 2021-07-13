import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'

import { client } from '../apollo/client'
import {
  PAIR_DATA,
  PAIR_CHART,
  FILTERED_TRANSACTIONS,
  PAIRS_CURRENT,
  PAIRS_BULK,
  PAIRS_HISTORICAL_BULK,
  HOURLY_PAIR_RATES
} from '../apollo/queries'

import { useAvaxPrice, getAvaxPriceAtDate, getCurrentAvaxPrice } from './GlobalData'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import {
  getPercentChange,
  get2DayPercentChange,
  isAddress,
  getBlocksFromTimestamps,
  getTimestampsForChanges,
  splitQuery,
  getMostRecentBlockSinceTimestamp
} from '../utils'
import { timeframeOptions } from '../constants'
import { useLatestBlocks } from './Application'
import { updateNameData } from '../utils/data'
import { useChainId } from '../contexts/Application'

const UPDATE = 'UPDATE'
const UPDATE_PAIR_TXNS = 'UPDATE_PAIR_TXNS'
const UPDATE_CHART_DATA = 'UPDATE_CHART_DATA'
const UPDATE_TOP_PAIRS = 'UPDATE_TOP_PAIRS'
const UPDATE_HOURLY_DATA = 'UPDATE_HOURLY_DATA'

dayjs.extend(utc)

export function safeAccess(object, path) {
  return object
    ? path.reduce((accumulator, currentValue) => (accumulator && accumulator[currentValue] ? accumulator[currentValue] : null), object)
    : null
}

const PairDataContext = createContext()

function usePairDataContext() {
  return useContext(PairDataContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE: {
      const { pairAddress, data } = payload
      return {
        ...state,
        [pairAddress]: {
          ...state?.[pairAddress],
          ...data
        }
      }
    }

    case UPDATE_TOP_PAIRS: {
      const { topPairs } = payload
      let added = {}
      topPairs.map((pair) => {
        return (added[pair.id] = pair)
      })
      return {
        ...state,
        ...added
      }
    }

    case UPDATE_PAIR_TXNS: {
      const { address, transactions } = payload
      return {
        ...state,
        [address]: {
          ...(safeAccess(state, [address]) || {}),
          txns: transactions
        }
      }
    }
    case UPDATE_CHART_DATA: {
      const { address, chartData } = payload
      return {
        ...state,
        [address]: {
          ...(safeAccess(state, [address]) || {}),
          chartData
        }
      }
    }

    case UPDATE_HOURLY_DATA: {
      const { address, hourlyData, timeWindow } = payload
      return {
        ...state,
        [address]: {
          ...state?.[address],
          hourlyData: {
            ...state?.[address]?.hourlyData,
            [timeWindow]: hourlyData
          }
        }
      }
    }

    default: {
      throw Error(`Unexpected action type in DataContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, {})

  // update pair specific data
  const update = useCallback((pairAddress, data) => {
    dispatch({
      type: UPDATE,
      payload: {
        pairAddress,
        data
      }
    })
  }, [])

  const updateTopPairs = useCallback((topPairs) => {
    dispatch({
      type: UPDATE_TOP_PAIRS,
      payload: {
        topPairs
      }
    })
  }, [])

  const updatePairTxns = useCallback((address, transactions) => {
    dispatch({
      type: UPDATE_PAIR_TXNS,
      payload: { address, transactions }
    })
  }, [])

  const updateChartData = useCallback((address, chartData) => {
    dispatch({
      type: UPDATE_CHART_DATA,
      payload: { address, chartData }
    })
  }, [])

  const updateHourlyData = useCallback((address, hourlyData, timeWindow) => {
    dispatch({
      type: UPDATE_HOURLY_DATA,
      payload: { address, hourlyData, timeWindow }
    })
  }, [])

  return (
    <PairDataContext.Provider
      value={useMemo(
        () => [
          state,
          {
            update,
            updatePairTxns,
            updateChartData,
            updateTopPairs,
            updateHourlyData
          }
        ],
        [state, update, updatePairTxns, updateChartData, updateTopPairs, updateHourlyData]
      )}
    >
      {children}
    </PairDataContext.Provider>
  )
}

async function getBulkPairData(pairList, avaxPrice, chainId) {
  const [t1, t2, tWeek] = getTimestampsForChanges()
  let blocks = await getBlocksFromTimestamps([t1, t2, tWeek], chainId)
  let b1, b2, bWeek
  if (blocks.length !== 3) {
    b1 = await getMostRecentBlockSinceTimestamp(t1, chainId)
    b2 = await getMostRecentBlockSinceTimestamp(t2, chainId)
    bWeek = await getMostRecentBlockSinceTimestamp(tWeek, chainId)
  } else {
    b1 = blocks[0].number
    b2 = blocks[1].number
    bWeek = blocks[2].number
  }

  try {
    let current = await client(chainId).query({
      query: PAIRS_BULK,
      variables: {
        allPairs: pairList
      },
      fetchPolicy: 'cache-first'
    })

    let [oneDayResult, twoDayResult, oneWeekResult] = await Promise.all(
      [b1, b2, bWeek].map(async (block) => {
        let result = client(chainId).query({
          query: PAIRS_HISTORICAL_BULK(block, pairList),
          fetchPolicy: 'cache-first'
        })
        return result
      })
    )

    let oneDayData = oneDayResult?.data?.pairs.reduce((obj, cur, i) => {
      return { ...obj, [cur.id]: cur }
    }, {})

    let twoDayData = twoDayResult?.data?.pairs.reduce((obj, cur, i) => {
      return { ...obj, [cur.id]: cur }
    }, {})

    let oneWeekData = oneWeekResult?.data?.pairs.reduce((obj, cur, i) => {
      return { ...obj, [cur.id]: cur }
    }, {})

    let pairData = await Promise.all(
      current &&
        current.data.pairs.map(async (pair) => {
          let data = pair
          let oneDayHistory = oneDayData?.[pair.id]
          if (!oneDayHistory) {
            let newData = await client(chainId).query({
              query: PAIR_DATA(pair.id, b1),
              fetchPolicy: 'cache-first'
            })
            oneDayHistory = newData.data.pairs[0]
          }
          let twoDayHistory = twoDayData?.[pair.id]
          if (!twoDayHistory) {
            let newData = await client(chainId).query({
              query: PAIR_DATA(pair.id, b2),
              fetchPolicy: 'cache-first'
            })
            twoDayHistory = newData.data.pairs[0]
          }
          let oneWeekHistory = oneWeekData?.[pair.id]
          if (!oneWeekHistory) {
            let newData = await client(chainId).query({
              query: PAIR_DATA(pair.id, bWeek),
              fetchPolicy: 'cache-first'
            })
            oneWeekHistory = newData.data.pairs[0]
          }
          data = parseData(data, oneDayHistory, twoDayHistory, oneWeekHistory, avaxPrice, b1)
          return data
        })
    )
    return pairData
  } catch (e) {
    console.log(e)
  }
}

function parseData(data, oneDayData, twoDayData, oneWeekData, avaxPrice, oneDayBlock) {
  // get volume changes
  const [oneDayVolumeUSD, volumeChangeUSD] = get2DayPercentChange(
    data?.volumeAVAX ? data.volumeAVAX * avaxPrice : 0,
    oneDayData?.volumeAVAX ? oneDayData.volumeAVAX * avaxPrice : 0,
    twoDayData?.volumeAVAX ? twoDayData.volumeAVAX * avaxPrice : 0
  )
  const [oneDayVolumeUntracked, volumeChangeUntracked] = get2DayPercentChange(
    data?.untrackedVolumeAVAX ? data.untrackedVolumeAVAX * avaxPrice : 0,
    oneDayData?.untrackedVolumeAVAX ? oneDayData.untrackedVolumeAVAX * avaxPrice : 0,
    twoDayData?.untrackedVolumeAVAX ? twoDayData.untrackedVolumeAVAX * avaxPrice : 0
  )
  const oneWeekVolumeUSD = parseFloat(oneWeekData ? (data?.volumeAVAX - oneWeekData?.volumeAVAX) * avaxPrice : data.volumeAVAX * avaxPrice)

  // set volume properties
  data.oneDayVolumeUSD = parseFloat(oneDayVolumeUSD)
  data.oneWeekVolumeUSD = oneWeekVolumeUSD
  data.volumeChangeUSD = volumeChangeUSD
  data.oneDayVolumeUntracked = oneDayVolumeUntracked
  data.volumeChangeUntracked = volumeChangeUntracked

  // Recalculate reserveUSD using AVAX's real price
  data.reserveUSD = data.reserveAVAX * avaxPrice

  // set liquidity properties
  data.trackedReserveUSD = data.trackedReserveAVAX * avaxPrice
  data.liquidityChangeUSD = getPercentChange(data.reserveAVAX * avaxPrice, oneDayData?.reserveAVAX * avaxPrice)

  // Format if pair has not existed for a day or a week
  if (!oneDayData && data && data.createdAtBlockNumber > oneDayBlock) {
    data.oneDayVolumeUSD = parseFloat(data.volumeAVAX) * avaxPrice
  }
  if (!oneDayData && data) {
    data.oneDayVolumeUSD = parseFloat(data.volumeAVAX) * avaxPrice
  }
  if (!oneWeekData && data) {
    data.oneWeekVolumeUSD = parseFloat(data.volumeAVAX) * avaxPrice
  }

  // format incorrect names
  updateNameData(data)

  return data
}

const getPairTransactions = async (pairAddress, chainId) => {
  const transactions = {}

  try {
    let result = await client(chainId).query({
      query: FILTERED_TRANSACTIONS,
      variables: {
        allPairs: [pairAddress]
      },
      fetchPolicy: 'no-cache'
    })
    transactions.mints = result.data.mints
    transactions.burns = result.data.burns
    transactions.swaps = result.data.swaps

    let avaxPrice = await getCurrentAvaxPrice()

    for (let i = 0; i < transactions.mints.length; i++) {
      transactions.mints[i].amountUSD = (parseFloat(transactions.mints[i].amountAVAX) * avaxPrice).toString()
    }
    for (let i = 0; i < transactions.burns.length; i++) {
      transactions.burns[i].amountUSD = (parseFloat(transactions.burns[i].amountAVAX) * avaxPrice).toString()
    }
    for (let i = 0; i < transactions.swaps.length; i++) {
      transactions.swaps[i].amountUSD = (parseFloat(transactions.swaps[i].amountAVAX) * avaxPrice).toString()
    }
  } catch (e) {
    console.log(e)
  }

  return transactions
}

const getPairChartData = async (pairAddress, chainId) => {
  let data = []
  const utcEndTime = dayjs.utc()
  let utcStartTime = utcEndTime.subtract(1, 'year').startOf('minute')
  let startTime = utcStartTime.unix() - 1

  try {
    let allFound = false
    let skip = 0
    while (!allFound) {
      let result = await client(chainId).query({
        query: PAIR_CHART,
        variables: {
          pairAddress: pairAddress,
          skip
        },
        fetchPolicy: 'cache-first'
      })
      skip += 1000
      data = data.concat(result.data.pairDayDatas)
      if (result.data.pairDayDatas.length < 1000) {
        allFound = true
      }
    }

    let dayIndexSet = new Set()
    let dayIndexArray = []
    let avaxPrice = await getCurrentAvaxPrice()
    const oneDay = 24 * 60 * 60
    data.forEach((dayData, i) => {
      // add the day index to the set of days
      dayIndexSet.add((data[i].date / oneDay).toFixed(0))
      dayIndexArray.push(data[i])
      dayData.dailyVolumeAVAX = parseFloat(dayData.dailyVolumeAVAX)
      dayData.dailyVolumeUSD = dayData.dailyVolumeAVAX * avaxPrice
      dayData.reserveAVAX = parseFloat(dayData.reserveAVAX)
      dayData.reserveUSD = dayData.reserveAVAX * avaxPrice
    })

    if (data[0]) {
      // fill in empty days
      let timestamp = data[0].date ? data[0].date : startTime
      let latestLiquidityAVAX = data[0].reserveAVAX
      let latestLiquidityUSD = latestLiquidityAVAX * avaxPrice
      let index = 1
      while (timestamp < utcEndTime.unix() - oneDay) {
        const nextDay = timestamp + oneDay
        let currentDayIndex = (nextDay / oneDay).toFixed(0)
        if (!dayIndexSet.has(currentDayIndex)) {
          data.push({
            date: nextDay,
            dayString: nextDay,
            dailyVolumeAVAX: 0,
            dailyVolumeUSD: 0,
            reserveAVAX: latestLiquidityAVAX,
            reserveUSD: latestLiquidityUSD
          })
        } else {
          latestLiquidityAVAX = dayIndexArray[index].reserveAVAX
          latestLiquidityUSD = latestLiquidityAVAX * avaxPrice
          index = index + 1
        }
        timestamp = nextDay
      }
    }

    data = data.sort((a, b) => (parseInt(a.date) > parseInt(b.date) ? 1 : -1))

    for (let j = 0; j < data.length; j++) {
      let latestAvaxPrice
      if (j === data.length - 1) {
        latestAvaxPrice = await getCurrentAvaxPrice()
      } else {
        latestAvaxPrice = await getAvaxPriceAtDate(data[j].date)
      }
      data[j].dailyVolumeUSD = data[j].dailyVolumeAVAX * latestAvaxPrice
      data[j].reserveUSD = data[j].reserveAVAX * latestAvaxPrice
    }
  } catch (e) {
    console.log(e)
  }

  return data
}

const getHourlyRateData = async (pairAddress, startTime, latestBlock, chainId) => {
  try {
    const utcEndTime = dayjs.utc()
    let time = startTime

    // create an array of hour start times until we reach current hour
    const timestamps = []
    while (time <= utcEndTime.unix() - 3600) {
      timestamps.push(time)
      time += 3600
    }

    // backout if invalid timestamp format
    if (timestamps.length === 0) {
      return []
    }

    // once you have all the timestamps, get the blocks for each timestamp in a bulk query
    let blocks

    blocks = await getBlocksFromTimestamps(timestamps, chainId, 100)

    // catch failing case
    if (!blocks || blocks?.length === 0) {
      return []
    }

    if (latestBlock) {
      blocks = blocks.filter((b) => {
        return parseFloat(b.number) <= parseFloat(latestBlock)
      })
    }

    const result = await splitQuery(HOURLY_PAIR_RATES, client(chainId), [pairAddress], blocks, 100)

    // format token AVAX price results
    let values = []
    for (var row in result) {
      let timestamp = row.split('t')[1]
      if (timestamp) {
        values.push({
          timestamp,
          rate0: parseFloat(result[row]?.token0Price),
          rate1: parseFloat(result[row]?.token1Price)
        })
      }
    }

    let formattedHistoryRate0 = []
    let formattedHistoryRate1 = []

    // for each hour, construct the open and close price
    for (let i = 0; i < values.length - 1; i++) {
      formattedHistoryRate0.push({
        timestamp: values[i].timestamp,
        open: parseFloat(values[i].rate0),
        close: parseFloat(values[i + 1].rate0)
      })
      formattedHistoryRate1.push({
        timestamp: values[i].timestamp,
        open: parseFloat(values[i].rate1),
        close: parseFloat(values[i + 1].rate1)
      })
    }

    return [formattedHistoryRate0, formattedHistoryRate1]
  } catch (e) {
    console.log(e)
    return [[], []]
  }
}

export function Updater() {
  const { chainId } = useChainId()

  const [, { updateTopPairs }] = usePairDataContext()
  const [avaxPrice] = useAvaxPrice()
  useEffect(() => {
    async function getData() {
      // get top pairs by reserves
      let {
        data: { pairs }
      } = await client(chainId).query({
        query: PAIRS_CURRENT,
        fetchPolicy: 'cache-first'
      })

      // format as array of addresses
      const formattedPairs = pairs.map((pair) => {
        return pair.id
      })

      // get data for every pair in list
      let topPairs = await getBulkPairData(formattedPairs, avaxPrice, chainId)
      topPairs && updateTopPairs(topPairs)
    }
    avaxPrice && getData()
  }, [avaxPrice, updateTopPairs, chainId])
  return null
}

export function useHourlyRateData(pairAddress, timeWindow) {
  const { chainId } = useChainId()
  const [state, { updateHourlyData }] = usePairDataContext()
  const chartData = state?.[pairAddress]?.hourlyData?.[timeWindow]
  const [latestBlock] = useLatestBlocks()

  useEffect(() => {
    const currentTime = dayjs.utc()
    const windowSize = timeWindow === timeframeOptions.MONTH ? 'month' : 'week'
    const startTime = timeWindow === timeframeOptions.ALL_TIME ? 1589760000 : currentTime.subtract(1, windowSize).startOf('hour').unix()

    async function fetch() {
      let data = await getHourlyRateData(pairAddress, startTime, latestBlock, chainId)
      updateHourlyData(pairAddress, data, timeWindow)
    }
    if (!chartData) {
      fetch()
    }
  }, [chartData, timeWindow, pairAddress, updateHourlyData, latestBlock, chainId])

  return chartData
}

/**
 * @todo
 * store these updates to reduce future redundant calls
 */
export function useDataForList(pairList) {
  const { chainId } = useChainId()
  const [state] = usePairDataContext()
  const [avaxPrice] = useAvaxPrice()

  const [stale, setStale] = useState(false)
  const [fetched, setFetched] = useState([])

  // reset
  useEffect(() => {
    if (pairList) {
      setStale(false)
      setFetched()
    }
  }, [pairList])

  useEffect(() => {
    async function fetchNewPairData() {
      let newFetched = []
      let unfetched = []

      pairList.map(async (pair) => {
        let currentData = state?.[pair.id]
        if (!currentData) {
          unfetched.push(pair.id)
        } else {
          newFetched.push(currentData)
        }
      })

      let newPairData = await getBulkPairData(
        unfetched.map((pair) => {
          return pair
        }),
        avaxPrice,
        chainId
      )
      setFetched(newFetched.concat(newPairData))
    }
    if (avaxPrice && pairList && pairList.length > 0 && !fetched && !stale) {
      setStale(true)
      fetchNewPairData()
    }
  }, [avaxPrice, state, pairList, stale, fetched, chainId])

  let formattedFetch =
    fetched &&
    fetched.reduce((obj, cur) => {
      return { ...obj, [cur?.id]: cur }
    }, {})

  return formattedFetch
}

/**
 * Get all the current and 24hr changes for a pair
 */
export function usePairData(pairAddress) {
  const [state, { update }] = usePairDataContext()
  const [avaxPrice] = useAvaxPrice()
  const pairData = state?.[pairAddress]

  useEffect(() => {
    async function fetchData() {
      if (!pairData && pairAddress) {
        let data = await getBulkPairData([pairAddress], avaxPrice)
        data && update(pairAddress, data[0])
      }
    }
    if (!pairData && pairAddress && avaxPrice && isAddress(pairAddress)) {
      fetchData()
    }
  }, [pairAddress, pairData, update, avaxPrice])

  return pairData || {}
}

/**
 * Get most recent txns for a pair
 */
export function usePairTransactions(pairAddress) {
  const { chainId } = useChainId()
  const [state, { updatePairTxns }] = usePairDataContext()
  const pairTxns = state?.[pairAddress]?.txns
  useEffect(() => {
    async function checkForTxns() {
      if (!pairTxns) {
        let transactions = await getPairTransactions(pairAddress, chainId)
        updatePairTxns(pairAddress, transactions)
      }
    }
    checkForTxns()
  }, [pairTxns, pairAddress, updatePairTxns, chainId])
  return pairTxns
}

export function usePairChartData(pairAddress) {
  const { chainId } = useChainId()
  const [state, { updateChartData }] = usePairDataContext()
  const chartData = state?.[pairAddress]?.chartData

  useEffect(() => {
    async function checkForChartData() {
      if (!chartData) {
        let data = await getPairChartData(pairAddress, chainId)
        updateChartData(pairAddress, data)
      }
    }
    checkForChartData()
  }, [chartData, pairAddress, updateChartData, chainId])
  return chartData
}

/**
 * Get list of all pairs in Uniswap
 */
export function useAllPairData() {
  const [state] = usePairDataContext()
  return state || {}
}
