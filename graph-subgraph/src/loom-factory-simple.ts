import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import {
  TreeCreated as TreeCreatedEvent
} from "../generated/LoomFactory/LoomFactory"
import { LoomTree } from "../generated/templates"
import { Factory, Tree } from "../generated/schema"

export function handleTreeCreated(event: TreeCreatedEvent): void {
  // Create new Factory entity if needed
  let factory = Factory.load(event.address.toHex())
  if (factory == null) {
    factory = new Factory(event.address.toHex())
    factory.address = event.address
    factory.totalTrees = BigInt.fromI32(0)
    factory.createdAt = event.block.timestamp
    factory.updatedAt = event.block.timestamp
  }
  factory.totalTrees = factory.totalTrees.plus(BigInt.fromI32(1))
  factory.updatedAt = event.block.timestamp
  factory.save()

  // Create new Tree entity
  let tree = new Tree(event.params.treeAddress.toHex())
  tree.factory = factory.id
  tree.treeId = event.params.treeId
  tree.address = event.params.treeAddress
  tree.creator = event.params.creator
  tree.rootContent = event.params.rootContent
  tree.rootTokenSupply = BigInt.fromI32(0)
  tree.nodeCount = BigInt.fromI32(0)
  tree.rootId = Bytes.empty()
  tree.createdAt = event.block.timestamp
  tree.createdAtBlock = event.block.number
  tree.updatedAt = event.block.timestamp
  tree.transactionHash = event.transaction.hash
  tree.save()

  // Start indexing this tree's events
  LoomTree.create(event.params.treeAddress)

  log.info('Tree created: {} at address {}', [
    event.params.treeId.toHex(),
    event.params.treeAddress.toHex()
  ])
}