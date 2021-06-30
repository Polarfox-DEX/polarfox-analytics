import React, { useMemo } from 'react'
import styled from 'styled-components'
import Panel from '../Panel'
import { AutoColumn } from '../Column'
import { RowFixed } from '../Row'
import { TYPE } from '../../Theme'
import { usePairData } from '../../contexts/PairData'
import { formattedNum } from '../../utils'

const PriceCard = styled(Panel)`
  position: absolute;
  right: -220px;
  width: 220px;
  top: -20px;
  z-index: 9999;
  height: fit-content;
  background-color: ${({ theme }) => theme.bg1};
`

function formatPercent(rawPercent) {
  if (rawPercent < 0.01) {
    return '<1%'
  } else return parseFloat(rawPercent * 100).toFixed(0) + '%'
}

export default function PfxPrice() {
  // const daiPair = usePairData('')
  // const usdcPair = usePairData('')
  const usdtPair = usePairData('0x6fa3df2d2c73e47010497fdcae3ec2773a4f8dbb')

  // const totalLiquidity = useMemo(() => {
  //   return daiPair && usdcPair && usdtPair ? daiPair.trackedReserveUSD + usdcPair.trackedReserveUSD + usdtPair.trackedReserveUSD : 0
  // }, [daiPair, usdcPair, usdtPair])

  const totalLiquidity = useMemo(() => {
    return usdtPair ? usdtPair.trackedReserveUSD : 0
  }, [usdtPair])

  // const daiPerAvax = daiPair ? parseFloat(daiPair.token0Price).toFixed(2) : '-'
  // const usdcPerAvax = usdcPair ? parseFloat(usdcPair.token0Price).toFixed(2) : '-'
  const usdtPerAvax = usdtPair ? parseFloat(usdtPair.token1Price).toFixed(2) : '-'

  return (
    <PriceCard>
      <AutoColumn gap="10px">
        {/* <RowFixed>
          <TYPE.main>DAI/AVAX: {formattedNum(daiPerAvax, true)}</TYPE.main>
          <TYPE.light style={{ marginLeft: '10px' }}>
            {daiPair && totalLiquidity ? formatPercent(daiPair.trackedReserveUSD / totalLiquidity) : '-'}
          </TYPE.light>
        </RowFixed>
        <RowFixed>
          <TYPE.main>USDC/AVAX: {formattedNum(usdcPerAvax, true)}</TYPE.main>
          <TYPE.light style={{ marginLeft: '10px' }}>
            {usdcPair && totalLiquidity ? formatPercent(usdcPair.trackedReserveUSD / totalLiquidity) : '-'}
          </TYPE.light>
        </RowFixed> */}
        <RowFixed>
          <TYPE.main>USDT/AVAX: {formattedNum(usdtPerAvax, true)}</TYPE.main>
          <TYPE.light style={{ marginLeft: '10px' }}>
            {usdtPair && totalLiquidity ? formatPercent(usdtPair.trackedReserveUSD / totalLiquidity) : '-'}
          </TYPE.light>
        </RowFixed>
      </AutoColumn>
    </PriceCard>
  )
}
