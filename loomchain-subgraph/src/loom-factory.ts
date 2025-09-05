import { TreeCreated as TreeCreatedEvent } from "../generated/LoomFactory/LoomFactory"
import { TreeCreated } from "../generated/schema"

export function handleTreeCreated(event: TreeCreatedEvent): void {
  let entity = new TreeCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.treeId = event.params.treeId
  entity.treeAddress = event.params.treeAddress
  entity.nftContractAddress = event.params.nftContractAddress
  entity.creator = event.params.creator
  entity.rootContent = event.params.rootContent

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
