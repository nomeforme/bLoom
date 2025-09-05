import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import {
  TokensMinted as TokensMintedEvent,
  TokensBurned as TokensBurnedEvent,
  Transfer as TransferEvent
} from "../generated/templates/NodeToken/NodeToken"
import { NodeToken, TokenMintEvent, TokenBurnEvent, DailyTreeStat, UserStat } from "../generated/schema"

export function handleTokensMinted(event: TokensMintedEvent): void {
  log.info('Tokens minted: {} to {} with reason: {}', [
    event.params.amount.toString(),
    event.params.to.toHex(),
    event.params.reason
  ])

  // Load NodeToken
  let nodeToken = NodeToken.load(event.address.toHex())
  if (nodeToken == null) {
    log.error('NodeToken not found: {}', [event.address.toHex()])
    return
  }

  // Update total supply
  nodeToken.totalSupply = nodeToken.totalSupply.plus(event.params.amount)
  nodeToken.save()

  // Create TokenMintEvent
  let mintEventId = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let mintEvent = new TokenMintEvent(mintEventId)
  mintEvent.nodeToken = nodeToken.id
  mintEvent.to = event.params.to
  mintEvent.amount = event.params.amount
  mintEvent.reason = event.params.reason
  mintEvent.timestamp = event.block.timestamp
  mintEvent.blockNumber = event.block.number
  mintEvent.transactionHash = event.transaction.hash
  mintEvent.save()

  // Update user stats
  updateUserStats(event.params.to, event.block.timestamp, false, false, false, false, false)

  // Update daily stats  
  updateDailyStats(event.block.timestamp, false, false, false, false, false, event.transaction.gasUsed)

  log.info('Token mint event indexed: {}', [mintEventId])
}

export function handleTokensBurned(event: TokensBurnedEvent): void {
  log.info('Tokens burned: {} from {} with reason: {}', [
    event.params.amount.toString(),
    event.params.from.toHex(),
    event.params.reason
  ])

  // Load NodeToken
  let nodeToken = NodeToken.load(event.address.toHex())
  if (nodeToken == null) {
    log.error('NodeToken not found: {}', [event.address.toHex()])
    return
  }

  // Update total supply
  nodeToken.totalSupply = nodeToken.totalSupply.minus(event.params.amount)
  nodeToken.save()

  // Create TokenBurnEvent
  let burnEventId = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let burnEvent = new TokenBurnEvent(burnEventId)
  burnEvent.nodeToken = nodeToken.id
  burnEvent.from = event.params.from
  burnEvent.amount = event.params.amount
  burnEvent.reason = event.params.reason
  burnEvent.timestamp = event.block.timestamp
  burnEvent.blockNumber = event.block.number
  burnEvent.transactionHash = event.transaction.hash
  burnEvent.save()

  // Update user stats
  updateUserStats(event.params.from, event.block.timestamp, false, false, false, false, false)

  // Update daily stats
  updateDailyStats(event.block.timestamp, false, false, false, false, false, event.transaction.gasUsed)

  log.info('Token burn event indexed: {}', [burnEventId])
}

export function handleTransfer(event: TransferEvent): void {
  // Handle ERC20 transfers for additional analytics if needed
  // For now, we mainly care about mint/burn events
  
  if (event.params.from.equals(Bytes.empty())) {
    // This is a mint, handled by TokensMinted
    return
  }
  
  if (event.params.to.equals(Bytes.empty())) {
    // This is a burn, handled by TokensBurned  
    return
  }

  // Regular transfer - could add analytics here if needed
  log.info('Token transfer: {} from {} to {}', [
    event.params.value.toString(),
    event.params.from.toHex(),
    event.params.to.toHex()
  ])
}

function updateUserStats(
  userAddress: Bytes, 
  timestamp: BigInt, 
  treeCreated: boolean, 
  nodeCreated: boolean, 
  nodeUpdated: boolean, 
  nftCreated: boolean,
  tokenCreated: boolean
): void {
  let userStat = UserStat.load(userAddress.toHex())
  if (userStat == null) {
    userStat = new UserStat(userAddress.toHex())
    userStat.address = userAddress
    userStat.treesCreated = BigInt.fromI32(0)
    userStat.nodesCreated = BigInt.fromI32(0)
    userStat.nodesUpdated = BigInt.fromI32(0)
    userStat.nftsOwned = BigInt.fromI32(0)
    userStat.tokensCreated = BigInt.fromI32(0)
    userStat.firstTreeCreated = BigInt.fromI32(0)
    userStat.lastActivity = timestamp
  }

  if (treeCreated) {
    userStat.treesCreated = userStat.treesCreated.plus(BigInt.fromI32(1))
    if (userStat.firstTreeCreated.equals(BigInt.fromI32(0))) {
      userStat.firstTreeCreated = timestamp
    }
  }
  if (nodeCreated) {
    userStat.nodesCreated = userStat.nodesCreated.plus(BigInt.fromI32(1))
  }
  if (nodeUpdated) {
    userStat.nodesUpdated = userStat.nodesUpdated.plus(BigInt.fromI32(1))
  }
  if (nftCreated) {
    userStat.nftsOwned = userStat.nftsOwned.plus(BigInt.fromI32(1))
  }
  if (tokenCreated) {
    userStat.tokensCreated = userStat.tokensCreated.plus(BigInt.fromI32(1))
  }

  userStat.lastActivity = timestamp
  userStat.save()
}

function updateDailyStats(
  timestamp: BigInt, 
  treeCreated: boolean, 
  nodeCreated: boolean, 
  nodeUpdated: boolean, 
  nftCreated: boolean,
  tokenCreated: boolean,
  gasUsed: BigInt
): void {
  // Create date string YYYY-MM-DD
  let dayTimestamp = timestamp.toI32() - (timestamp.toI32() % 86400) // Round to start of day
  let date = new Date(dayTimestamp * 1000)
  let dateString = date.getUTCFullYear().toString() + '-' + 
    (date.getUTCMonth() + 1).toString().padStart(2, '0') + '-' + 
    date.getUTCDate().toString().padStart(2, '0')

  let dailyStat = DailyTreeStat.load(dateString)
  if (dailyStat == null) {
    dailyStat = new DailyTreeStat(dateString)
    dailyStat.date = dateString
    dailyStat.treesCreated = BigInt.fromI32(0)
    dailyStat.nodesCreated = BigInt.fromI32(0)
    dailyStat.nodesUpdated = BigInt.fromI32(0)
    dailyStat.nftsCreated = BigInt.fromI32(0)
    dailyStat.tokensCreated = BigInt.fromI32(0)
    dailyStat.uniqueAuthors = BigInt.fromI32(0)
    dailyStat.totalGasUsed = BigInt.fromI32(0)
  }

  if (treeCreated) {
    dailyStat.treesCreated = dailyStat.treesCreated.plus(BigInt.fromI32(1))
  }
  if (nodeCreated) {
    dailyStat.nodesCreated = dailyStat.nodesCreated.plus(BigInt.fromI32(1))
  }
  if (nodeUpdated) {
    dailyStat.nodesUpdated = dailyStat.nodesUpdated.plus(BigInt.fromI32(1))
  }
  if (nftCreated) {
    dailyStat.nftsCreated = dailyStat.nftsCreated.plus(BigInt.fromI32(1))
  }
  if (tokenCreated) {
    dailyStat.tokensCreated = dailyStat.tokensCreated.plus(BigInt.fromI32(1))
  }

  dailyStat.totalGasUsed = dailyStat.totalGasUsed.plus(gasUsed)
  dailyStat.save()
}