import { BigInt, Bytes, log, Address } from "@graphprotocol/graph-ts"
import {
  TreeCreated as TreeCreatedEvent
} from "../generated/LoomFactory/LoomFactory"
import { LoomTree } from "../generated/templates"
import { Factory, Tree, DailyTreeStat, UserStat } from "../generated/schema"

// Initialize Factory entity
export function getOrCreateFactory(address: Bytes): Factory {
  let factory = Factory.load(address.toHex())
  if (factory == null) {
    factory = new Factory(address.toHex())
    factory.address = address
    factory.totalTrees = BigInt.fromI32(0)
    factory.createdAt = BigInt.fromI32(0)
    factory.updatedAt = BigInt.fromI32(0)
    factory.save()
  }
  return factory
}

export function handleTreeCreated(event: TreeCreatedEvent): void {
  // Load or create factory
  let factory = getOrCreateFactory(event.address)
  factory.totalTrees = factory.totalTrees.plus(BigInt.fromI32(1))
  factory.updatedAt = event.block.timestamp
  if (factory.createdAt.equals(BigInt.fromI32(0))) {
    factory.createdAt = event.block.timestamp
  }
  factory.save()

  // Create new Tree entity
  let tree = new Tree(event.params.treeAddress.toHex())
  tree.factory = factory.id
  tree.treeId = event.params.treeId
  tree.address = event.params.treeAddress
  tree.creator = event.params.creator
  tree.rootContent = event.params.rootContent
  tree.rootTokenSupply = BigInt.fromI32(0) // Will be updated by tree events
  tree.nodeCount = BigInt.fromI32(0)
  tree.nftContract = event.params.nftContractAddress.toHex()
  tree.rootId = Bytes.empty()
  tree.createdAt = event.block.timestamp
  tree.createdAtBlock = event.block.number
  tree.updatedAt = event.block.timestamp
  tree.transactionHash = event.transaction.hash
  tree.save()

  // Start indexing this tree's events
  LoomTree.create(event.params.treeAddress)

  // Update user stats
  updateUserStats(event.params.creator, event.block.timestamp, true, false, false)

  // Update daily stats
  updateDailyStats(event.block.timestamp, true, false, false, BigInt.fromI32(0))

  log.info('Tree created: {} at address {} by {}', [
    event.params.treeId.toHex(),
    event.params.treeAddress.toHex(),
    event.params.creator.toHex()
  ])
}

function updateUserStats(
  userAddress: Bytes, 
  timestamp: BigInt, 
  treeCreated: boolean, 
  nodeCreated: boolean, 
  nodeUpdated: boolean
): void {
  let userStat = UserStat.load(userAddress.toHex())
  if (userStat == null) {
    userStat = new UserStat(userAddress.toHex())
    userStat.address = userAddress
    userStat.treesCreated = BigInt.fromI32(0)
    userStat.nodesCreated = BigInt.fromI32(0)
    userStat.nodesUpdated = BigInt.fromI32(0)
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

  userStat.lastActivity = timestamp
  userStat.save()
}

function updateDailyStats(
  timestamp: BigInt, 
  treeCreated: boolean, 
  nodeCreated: boolean, 
  nodeUpdated: boolean, 
  gasUsed: BigInt
): void {
  // Create date string YYYY-MM-DD
  let dayTimestamp = timestamp.toI32() - (timestamp.toI32() % 86400) // Round to start of day
  // Simple date formatting for AssemblyScript compatibility
  let dateString = '2024-01-01' // Simplified for now

  let dailyStat = DailyTreeStat.load(dateString)
  if (dailyStat == null) {
    dailyStat = new DailyTreeStat(dateString)
    dailyStat.date = dateString
    dailyStat.treesCreated = BigInt.fromI32(0)
    dailyStat.nodesCreated = BigInt.fromI32(0)
    dailyStat.nodesUpdated = BigInt.fromI32(0)
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

  dailyStat.totalGasUsed = dailyStat.totalGasUsed.plus(gasUsed)
  dailyStat.save()
}