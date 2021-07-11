import React from 'react'
import styled from 'styled-components'

import { CHAIN_ID } from '../../constants'
import { useChainId } from '../../contexts/Application'

const BlockchainList = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: ${({ theme }) => theme.text1};
`

const VerticalBar = styled.span`
  opacity: 0.6;
`

const BlockchainOption = styled.span`
  opacity: ${({ activeText }) => (activeText ? 1 : 0.6)};
  :hover {
    cursor: pointer;
    text-decoration: none;
    underline: none;
    opacity: 1;
  }
`

function BlockchainSelector() {
  // TODO: Might want to reload the page when changing the chainId, or at least reload a bunch of stuff
  const { chainId, updateChainId } = useChainId()

  return (
    <BlockchainList>
      <BlockchainOption activeText={chainId === CHAIN_ID.AVALANCHE} onClick={() => updateChainId(CHAIN_ID.AVALANCHE)}>
        Avalanche
      </BlockchainOption>
      <VerticalBar> | </VerticalBar>
      <BlockchainOption activeText={chainId === CHAIN_ID.FUJI} onClick={() => updateChainId(CHAIN_ID.FUJI)}>
        Fuji
      </BlockchainOption>
    </BlockchainList>
  )
}

export default BlockchainSelector
