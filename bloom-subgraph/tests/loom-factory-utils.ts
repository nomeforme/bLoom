import { newMockEvent } from "matchstick-as"
import { ethereum, Bytes, Address } from "@graphprotocol/graph-ts"
import { TreeCreated } from "../generated/LoomFactory/LoomFactory"

export function createTreeCreatedEvent(
  treeId: Bytes,
  treeAddress: Address,
  nftContractAddress: Address,
  creator: Address,
  rootContent: string
): TreeCreated {
  let treeCreatedEvent = changetype<TreeCreated>(newMockEvent())

  treeCreatedEvent.parameters = new Array()

  treeCreatedEvent.parameters.push(
    new ethereum.EventParam("treeId", ethereum.Value.fromFixedBytes(treeId))
  )
  treeCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "treeAddress",
      ethereum.Value.fromAddress(treeAddress)
    )
  )
  treeCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "nftContractAddress",
      ethereum.Value.fromAddress(nftContractAddress)
    )
  )
  treeCreatedEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  )
  treeCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "rootContent",
      ethereum.Value.fromString(rootContent)
    )
  )

  return treeCreatedEvent
}
