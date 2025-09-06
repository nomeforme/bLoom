import {
  NodeNFTMinted as NodeNFTMintedEvent,
  NodeNFTContentUpdated as NodeNFTContentUpdatedEvent,
  NodeTokenCreated as NodeTokenCreatedEvent,
  TokenBoundAccountCreated as TokenBoundAccountCreatedEvent,
  Transfer as TransferEvent
} from "../generated/templates/LoomNodeNFT/LoomNodeNFT"
import {
  NodeNFTMinted,
  NodeNFTContentUpdated,
  NodeTokenCreated,
  TokenBoundAccountCreated,
  NFTTransfer
} from "../generated/schema"
import { NodeToken } from "../generated/templates"

export function handleNodeNFTMinted(event: NodeNFTMintedEvent): void {
  let entity = new NodeNFTMinted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.tokenId = event.params.tokenId
  entity.nodeId = event.params.nodeId
  entity.owner = event.params.owner
  entity.content = event.params.content
  entity.tokenBoundAccount = event.params.tokenBoundAccount
  entity.nodeTokenContract = event.params.nodeTokenContract

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleNodeNFTContentUpdated(event: NodeNFTContentUpdatedEvent): void {
  let entity = new NodeNFTContentUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.tokenId = event.params.tokenId
  entity.nodeId = event.params.nodeId
  entity.content = event.params.content

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleNodeTokenCreated(event: NodeTokenCreatedEvent): void {
  let entity = new NodeTokenCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.tokenId = event.params.tokenId
  entity.nodeTokenContract = event.params.nodeTokenContract
  entity.tokenBoundAccount = event.params.tokenBoundAccount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Start indexing the NodeToken contract
  NodeToken.create(event.params.nodeTokenContract)
}

export function handleTokenBoundAccountCreated(event: TokenBoundAccountCreatedEvent): void {
  let entity = new TokenBoundAccountCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.tokenId = event.params.tokenId
  entity.tokenBoundAccount = event.params.tokenBoundAccount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleNFTTransfer(event: TransferEvent): void {
  let entity = new NFTTransfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.from = event.params.from
  entity.to = event.params.to
  entity.tokenId = event.params.tokenId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}