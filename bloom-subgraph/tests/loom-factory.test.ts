import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Bytes, Address } from "@graphprotocol/graph-ts"
import { TreeCreated } from "../generated/schema"
import { TreeCreated as TreeCreatedEvent } from "../generated/LoomFactory/LoomFactory"
import { handleTreeCreated } from "../src/loom-factory"
import { createTreeCreatedEvent } from "./loom-factory-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let treeId = Bytes.fromI32(1234567890)
    let treeAddress = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let nftContractAddress = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let creator = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let rootContent = "Example string value"
    let newTreeCreatedEvent = createTreeCreatedEvent(
      treeId,
      treeAddress,
      nftContractAddress,
      creator,
      rootContent
    )
    handleTreeCreated(newTreeCreatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("TreeCreated created and stored", () => {
    assert.entityCount("TreeCreated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "TreeCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "treeId",
      "1234567890"
    )
    assert.fieldEquals(
      "TreeCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "treeAddress",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "TreeCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "nftContractAddress",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "TreeCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "creator",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "TreeCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "rootContent",
      "Example string value"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
