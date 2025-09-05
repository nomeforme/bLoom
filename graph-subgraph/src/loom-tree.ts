import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import {
  NodeCreated as NodeCreatedEvent,
  NodeUpdated as NodeUpdatedEvent,
  LoomTree as LoomTreeContract
} from "../generated/templates/LoomTree/LoomTree"
import { Tree, Node, NodeUpdate, DailyTreeStat, UserStat } from "../generated/schema"

export function handleNodeCreated(event: NodeCreatedEvent): void {
  // Load the tree
  let tree = Tree.load(event.address.toHex())
  if (tree == null) {
    log.error('Tree not found for address: {}', [event.address.toHex()])
    return
  }

  // Create Node entity
  let nodeId = event.address.toHex() + '-' + event.params.nodeId.toHex()
  let node = new Node(nodeId)
  node.nodeId = event.params.nodeId
  node.tree = tree.id
  node.author = event.params.author
  node.timestamp = event.block.timestamp
  node.createdAt = event.block.timestamp
  node.createdAtBlock = event.block.number
  node.updatedAt = event.block.timestamp
  node.transactionHash = event.transaction.hash

  // Get additional node data from contract
  let treeContract = LoomTreeContract.bind(event.address)
  let nodeDataResult = treeContract.try_getNode(event.params.nodeId)
  let nodeContentResult = treeContract.try_getNodeContent(event.params.nodeId)
  let nodeModelIdResult = treeContract.try_getNodeModelId(event.params.nodeId)
  let nodeHasNFTResult = treeContract.try_nodeHasNFT(event.params.nodeId)

  if (!nodeDataResult.reverted) {
    node.parentId = nodeDataResult.value.value1
    node.isRoot = nodeDataResult.value.value5
    
    // Set parent relationship if not root
    if (!node.isRoot && !node.parentId.equals(Bytes.empty())) {
      let parentNodeId = event.address.toHex() + '-' + node.parentId.toHex()
      let parentNode = Node.load(parentNodeId)
      if (parentNode != null) {
        node.parent = parentNode.id
      }
    }
  }

  if (!nodeContentResult.reverted) {
    node.content = nodeContentResult.value
  } else {
    node.content = ""
  }

  if (!nodeModelIdResult.reverted) {
    node.modelId = nodeModelIdResult.value
  } else {
    node.modelId = ""
  }

  if (!nodeHasNFTResult.reverted) {
    node.hasNFT = nodeHasNFTResult.value
  } else {
    node.hasNFT = false
  }

  // Check if this is the root node and update tree
  if (node.isRoot) {
    tree.rootId = node.nodeId
    tree.rootContent = node.content
  }

  node.save()

  // Update tree node count
  tree.nodeCount = tree.nodeCount.plus(BigInt.fromI32(1))
  tree.updatedAt = event.block.timestamp
  tree.save()

  // Update user stats
  updateUserStats(event.params.author, event.block.timestamp, false, true, false)

  // Update daily stats
  updateDailyStats(event.block.timestamp, false, true, false, event.transaction.gasUsed)

  log.info('Node created: {} in tree {} by {}', [
    event.params.nodeId.toHex(),
    event.address.toHex(),
    event.params.author.toHex()
  ])
}

export function handleNodeUpdated(event: NodeUpdatedEvent): void {
  // Load the node
  let nodeId = event.address.toHex() + '-' + event.params.nodeId.toHex()
  let node = Node.load(nodeId)
  if (node == null) {
    log.error('Node not found: {} for tree: {}', [event.params.nodeId.toHex(), event.address.toHex()])
    return
  }

  // Store old content for update tracking
  let oldContent = node.content

  // Get new content from contract
  let treeContract = LoomTreeContract.bind(event.address)
  let nodeContentResult = treeContract.try_getNodeContent(event.params.nodeId)
  
  let newContent = ""
  if (!nodeContentResult.reverted) {
    newContent = nodeContentResult.value
    node.content = newContent
  }

  node.updatedAt = event.block.timestamp
  node.save()

  // Create NodeUpdate record for history
  let updateId = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let nodeUpdate = new NodeUpdate(updateId)
  nodeUpdate.node = node.id
  nodeUpdate.oldContent = oldContent
  nodeUpdate.newContent = newContent
  nodeUpdate.updatedBy = event.params.author
  nodeUpdate.timestamp = event.block.timestamp
  nodeUpdate.blockNumber = event.block.number
  nodeUpdate.transactionHash = event.transaction.hash
  nodeUpdate.save()

  // Update tree timestamp
  let tree = Tree.load(event.address.toHex())
  if (tree != null) {
    tree.updatedAt = event.block.timestamp
    
    // If this is the root node, update tree's root content
    if (node.isRoot) {
      tree.rootContent = newContent
    }
    
    tree.save()
  }

  // Update user stats
  updateUserStats(event.params.author, event.block.timestamp, false, false, true)

  // Update daily stats
  updateDailyStats(event.block.timestamp, false, false, true, event.transaction.gasUsed)

  log.info('Node updated: {} in tree {} by {}', [
    event.params.nodeId.toHex(),
    event.address.toHex(),
    event.params.author.toHex()
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