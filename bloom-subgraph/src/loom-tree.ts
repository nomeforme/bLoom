import {
  NodeCreated as NodeCreatedEvent,
  NodeUpdated as NodeUpdatedEvent,
  MetadataSet as MetadataSetEvent
} from "../generated/templates/LoomTree/LoomTree"
import {
  NodeCreated,
  NodeUpdated,
  MetadataSet
} from "../generated/schema"

export function handleNodeCreated(event: NodeCreatedEvent): void {
  let entity = new NodeCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.nodeId = event.params.nodeId
  entity.parentId = event.params.parentId
  entity.author = event.params.author
  entity.timestamp = event.params.timestamp
  entity.treeAddress = event.address // ← This is the key! The tree contract address
  entity.hasNFT = event.params.hasNFT // ← New field from updated event

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleNodeUpdated(event: NodeUpdatedEvent): void {
  let entity = new NodeUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.nodeId = event.params.nodeId
  entity.author = event.params.author
  entity.treeAddress = event.address

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMetadataSet(event: MetadataSetEvent): void {
  let entity = new MetadataSet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.nodeId = event.params.nodeId
  entity.key = event.params.key
  entity.value = event.params.value
  entity.treeAddress = event.address

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}