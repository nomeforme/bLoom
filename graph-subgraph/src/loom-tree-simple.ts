import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import {
  NodeCreated as NodeCreatedEvent,
  NodeUpdated as NodeUpdatedEvent
} from "../generated/templates/LoomTree/LoomTree"
import { Tree, Node } from "../generated/schema"

export function handleNodeCreated(event: NodeCreatedEvent): void {
  // Load tree
  let tree = Tree.load(event.address.toHex())
  if (tree == null) {
    log.warning('Tree not found for address {}', [event.address.toHex()])
    return
  }

  // Create new Node entity
  let nodeId = event.address.toHex() + '-' + event.params.nodeId.toHex()
  let node = new Node(nodeId)
  node.nodeId = event.params.nodeId
  node.tree = tree.id
  node.content = "Node content" // Simplified
  node.author = event.params.author
  node.timestamp = event.params.timestamp
  node.isRoot = false
  node.hasNFT = false
  node.createdAt = event.block.timestamp
  node.createdAtBlock = event.block.number
  node.updatedAt = event.block.timestamp
  node.transactionHash = event.transaction.hash
  node.save()

  // Update tree node count
  tree.nodeCount = tree.nodeCount.plus(BigInt.fromI32(1))
  tree.updatedAt = event.block.timestamp
  tree.save()

  log.info('Node created: {} in tree {}', [
    event.params.nodeId.toHex(),
    event.address.toHex()
  ])
}

export function handleNodeUpdated(event: NodeUpdatedEvent): void {
  // Find node by tree address and update
  let tree = Tree.load(event.address.toHex())
  if (tree == null) {
    log.warning('Tree not found for address {}', [event.address.toHex()])
    return
  }

  log.info('Node updated by {} in tree {}', [
    event.params.author.toHex(),
    event.address.toHex()
  ])
}