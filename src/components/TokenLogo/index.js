import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { isAddress } from '../../utils/index.js'
import PlaceHolder from '../../assets/placeholder.png'
import { useChainId } from '../../contexts/Application'
const BAD_IMAGES = {}

const Inline = styled.div`
  display: flex;
  align-items: center;
  align-self: center;
`

const Image = styled.img`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  background-color: white;
  border-radius: 50%;
  box-shadow: 0px 6px 10px rgba(0, 0, 0, 0.075);
`

// const StyledEthereumLogo = styled.div`
//   display: flex;
//   align-items: center;
//   justify-content: center;

//   > img {
//     width: ${({ size }) => size};
//     height: ${({ size }) => size};
//   }
// `

export default function TokenLogo({ address, header = false, size = '24px', ...rest }) {
  const { chainId } = useChainId()
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
  }, [address])

  if (error || BAD_IMAGES[address]) {
    return (
      <Inline>
        <Image {...rest} alt={''} src={PlaceHolder} size={size} />
      </Inline>
    )
  }

  const path = `https://raw.githubusercontent.com/Polarfox-DEX/polarfox-token-lists/master/${chainId}/token-logos/${isAddress(address)}.png`

  return (
    <Inline>
      <Image
        {...rest}
        alt={''}
        src={path}
        size={size}
        onError={(event) => {
          BAD_IMAGES[address] = true
          setError(true)
          event.preventDefault()
        }}
      />
    </Inline>
  )
}
