import { BigInt, Bytes, log, json, JSONValue } from "@graphprotocol/graph-ts"
import {
  NodeNFTMinted as NodeNFTMintedEvent,
  TokenBoundAccountCreated as TokenBoundAccountCreatedEvent,
  NodeTokenCreated as NodeTokenCreatedEvent,
  Transfer as TransferEvent
} from "../generated/templates/LoomNodeNFT/LoomNodeNFT"
import { NodeToken as NodeTokenTemplate } from "../generated/templates"
import { 
  NFTContract, 
  NodeNFT, 
  NodeToken, 
  TokenBoundAccount,
  Node,
  DailyTreeStat, 
  UserStat 
} from "../generated/schema"

export function handleNodeNFTMinted(event: NodeNFTMintedEvent): void {
  log.info('Node NFT minted: tokenId {} for nodeId {} to {}', [
    event.params.tokenId.toString(),
    event.params.nodeId.toHex(),
    event.params.owner.toHex()
  ])

  // Load NFT Contract
  let nftContract = NFTContract.load(event.address.toHex())
  if (nftContract == null) {
    log.error('NFT Contract not found: {}', [event.address.toHex()])
    return
  }

  // Create NodeNFT entity
  let nodeNFTId = event.address.toHex() + '-' + event.params.tokenId.toString()
  let nodeNFT = new NodeNFT(nodeNFTId)
  nodeNFT.tokenId = event.params.tokenId
  nodeNFT.nodeId = event.params.nodeId
  nodeNFT.nftContract = nftContract.id
  nodeNFT.owner = event.params.owner
  nodeNFT.content = event.params.content
  nodeNFT.textContent = event.params.content // Initially same as content
  nodeNFT.tokenBoundAccount = event.params.tokenBoundAccount
  nodeNFT.createdAt = event.block.timestamp
  nodeNFT.createdAtBlock = event.block.number
  nodeNFT.updatedAt = event.block.timestamp
  nodeNFT.transactionHash = event.transaction.hash
  nodeNFT.save()

  // Update NFT Contract total supply
  nftContract.totalSupply = nftContract.totalSupply.plus(BigInt.fromI32(1))
  nftContract.save()

  // Update related Node entity if it exists
  let tree = nftContract.tree
  if (tree) {
    let nodeId = tree + '-' + event.params.nodeId.toHex()
    let node = Node.load(nodeId)
    if (node) {
      node.hasNFT = true
      node.save()
    }
  }

  // Update user stats
  updateUserStats(event.params.owner, event.block.timestamp, false, false, false, true, false)

  // Update daily stats
  updateDailyStats(event.block.timestamp, false, false, false, true, false, event.transaction.gasUsed)

  log.info('Node NFT indexed: {} for node: {}', [nodeNFTId, event.params.nodeId.toHex()])
}

export function handleTokenBoundAccountCreated(event: TokenBoundAccountCreatedEvent): void {
  log.info('Token Bound Account created: {} for tokenId {}', [
    event.params.tokenBoundAccount.toHex(),
    event.params.tokenId.toString()
  ])

  // Create TokenBoundAccount entity
  let tba = new TokenBoundAccount(event.params.tokenBoundAccount.toHex())
  tba.address = event.params.tokenBoundAccount
  tba.tokenId = event.params.tokenId
  tba.chainId = BigInt.fromI32(1) // Default, could be retrieved from contract
  tba.tokenContract = event.address
  tba.createdAt = event.block.timestamp
  tba.createdAtBlock = event.block.number
  tba.transactionHash = event.transaction.hash

  // Link to NodeNFT
  let nodeNFTId = event.address.toHex() + '-' + event.params.tokenId.toString()
  let nodeNFT = NodeNFT.load(nodeNFTId)
  if (nodeNFT) {
    tba.nodeNFT = nodeNFT.id
  }

  tba.save()
}

export function handleNodeTokenCreated(event: NodeTokenCreatedEvent): void {
  log.info('Node Token created: {} for tokenId {} at TBA {}', [
    event.params.nodeTokenContract.toHex(),
    event.params.tokenId.toString(),
    event.params.tokenBoundAccount.toHex()
  ])

  // Create NodeToken entity
  let nodeToken = new NodeToken(event.params.nodeTokenContract.toHex())
  nodeToken.address = event.params.nodeTokenContract
  nodeToken.name = "" // Will be populated by NodeToken contract events
  nodeToken.symbol = ""
  nodeToken.totalSupply = BigInt.fromI32(0)
  nodeToken.initialSupply = BigInt.fromI32(0)
  nodeToken.decimals = 18 // Standard for ERC20
  nodeToken.tokenBoundAccount = event.params.tokenBoundAccount
  nodeToken.createdAt = event.block.timestamp
  nodeToken.createdAtBlock = event.block.number
  nodeToken.transactionHash = event.transaction.hash

  // Link to NodeNFT
  let nodeNFTId = event.address.toHex() + '-' + event.params.tokenId.toString()
  let nodeNFT = NodeNFT.load(nodeNFTId)
  if (nodeNFT) {
    nodeToken.nodeNFT = nodeNFT.id
    nodeNFT.nodeToken = nodeToken.id
    nodeNFT.save()
  }

  nodeToken.save()

  // Start indexing this NodeToken contract's events
  NodeTokenTemplate.create(event.params.nodeTokenContract)

  // Update daily stats
  updateDailyStats(event.block.timestamp, false, false, false, false, true, event.transaction.gasUsed)

  log.info('Node Token indexed: {} for NFT: {}', [nodeToken.id, nodeNFTId])
}

export function handleTransfer(event: TransferEvent): void {
  // Handle NFT transfers to update ownership
  if (event.params.from.equals(Bytes.empty())) {
    // This is a mint, already handled by NodeNFTMinted
    return
  }

  let nodeNFTId = event.address.toHex() + '-' + event.params.tokenId.toString()
  let nodeNFT = NodeNFT.load(nodeNFTId)
  if (nodeNFT) {
    let oldOwner = nodeNFT.owner
    nodeNFT.owner = event.params.to
    nodeNFT.updatedAt = event.block.timestamp
    nodeNFT.save()

    // Update user stats for old and new owners
    updateUserStats(oldOwner, event.block.timestamp, false, false, false, false, false)
    updateUserStats(event.params.to, event.block.timestamp, false, false, false, false, false)

    log.info('NFT transferred: {} from {} to {}', [
      nodeNFTId,
      event.params.from.toHex(),
      event.params.to.toHex()
    ])
  }
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