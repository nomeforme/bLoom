import {
  NodeCreated as NodeCreatedEvent,
  NodeUpdated as NodeUpdatedEvent,
  MetadataSet as MetadataSetEvent,
  LoomTree
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
  entity.modelId = event.params.modelId // ← Get modelId directly from event
  entity.tokenId = event.params.tokenId // ← NFT token ID (0 for lightweight nodes)
  entity.tokenBoundAccount = event.params.tokenBoundAccount // ← ERC6551 TBA (null for lightweight)
  entity.nodeTokenContract = event.params.nodeTokenContract // ← ERC20 contract (null for lightweight)

  // For lightweight nodes (hasNFT: false), get content from contract storage
  if (!event.params.hasNFT) {
    let contract = LoomTree.bind(event.address)
    let contentResult = contract.try_getNodeContent(event.params.nodeId)
    if (!contentResult.reverted) {
      entity.content = contentResult.value
    }
  }

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
  entity.modelId = event.params.modelId // ← Get modelId directly from updated event

  // For lightweight nodes, get updated content from contract storage
  // Check if the node has NFT using the nodeHasNFT function
  let contract = LoomTree.bind(event.address)
  let hasNFTResult = contract.try_nodeHasNFT(event.params.nodeId)
  
  if (!hasNFTResult.reverted && !hasNFTResult.value) {
    // Node is lightweight, get the updated content
    let contentResult = contract.try_getNodeContent(event.params.nodeId)
    if (!contentResult.reverted) {
      entity.content = contentResult.value
    }
  }

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