import { ApolloClient } from 'apollo-client'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { HttpLink } from 'apollo-link-http'
import { SUBGRAPH_CLIENT, HEALTH_CLIENT, STAKING_CLIENT, BLOCK_CLIENT } from '../constants'

export const client = (chainId) => {
  return new ApolloClient({
    link: new HttpLink({
      uri: SUBGRAPH_CLIENT[chainId]
    }),
    cache: new InMemoryCache(),
    shouldBatch: true
  })
}

export const healthClient = new ApolloClient({
  link: new HttpLink({
    uri: HEALTH_CLIENT
  }),
  cache: new InMemoryCache(),
  shouldBatch: true
})

export const stakingClient = new ApolloClient({
  link: new HttpLink({
    uri: STAKING_CLIENT
  }),
  cache: new InMemoryCache(),
  shouldBatch: true
})

export const blockClient = (chainId) => {
  return new ApolloClient({
    link: new HttpLink({
      uri: BLOCK_CLIENT[chainId]
    }),
    cache: new InMemoryCache()
  })
}
