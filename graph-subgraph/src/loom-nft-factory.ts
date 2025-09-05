import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import {
  NFTContractCreated as NFTContractCreatedEvent
} from "../generated/LoomNFTFactory/LoomNFTFactory"
import { LoomNodeNFT } from "../generated/templates"
import { NFTFactory, NFTContract, Tree } from "../generated/schema"

export function handleNFTContractCreated(event: NFTContractCreatedEvent): void {
  log.info('NFT Contract created: {} for tree {} by {}', [
    event.params.nftContract.toHex(),
    event.params.treeId.toHex(),
    event.params.creator.toHex()
  ])

  // Load or create NFTFactory
  let nftFactory = NFTFactory.load(event.address.toHex())
  if (nftFactory == null) {
    nftFactory = new NFTFactory(event.address.toHex())
    nftFactory.address = event.address
    nftFactory.registry = Bytes.empty() // Will be set if we can get it from contract
    nftFactory.accountImplementation = Bytes.empty()
    nftFactory.salt = Bytes.empty()
    nftFactory.createdAt = event.block.timestamp
    nftFactory.updatedAt = event.block.timestamp
  } else {
    nftFactory.updatedAt = event.block.timestamp
  }
  nftFactory.save()

  // Create NFTContract entity
  let nftContract = new NFTContract(event.params.nftContract.toHex())
  nftContract.address = event.params.nftContract
  nftContract.nftFactory = nftFactory.id
  nftContract.treeId = event.params.treeId
  nftContract.creator = event.params.creator
  nftContract.totalSupply = BigInt.fromI32(0)
  nftContract.createdAt = event.block.timestamp
  nftContract.createdAtBlock = event.block.number
  nftContract.transactionHash = event.transaction.hash

  // Link to tree if it exists
  let tree = Tree.load(event.params.treeId.toHex()) // Try tree ID first
  if (tree == null) {
    // If not found by tree ID, search by other means or leave unlinked
    log.warning('Tree not found for treeId: {}', [event.params.treeId.toHex()])
  } else {
    nftContract.tree = tree.id
    tree.nftContract = nftContract.id
    tree.save()
  }

  nftContract.save()

  // Start indexing this NFT contract's events
  LoomNodeNFT.create(event.params.nftContract)

  log.info('NFT Contract indexed: {} linked to tree: {}', [
    nftContract.id,
    nftContract.tree ? nftContract.tree! : 'none'
  ])
}