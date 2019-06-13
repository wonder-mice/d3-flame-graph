import {State, StateInputTraits} from './State'
import {Callstack} from './Callstack'
import {Node, nodeRootPath, nodeWalk} from './Node'

export class StructureStateAddedSiblingsTraits extends StateInputTraits {
  static send (input, value) {
    const accumulator = input.value
    if (accumulator) {
      for (let x = accumulator.length, y = 0, n = value.length; y < n; ++x, ++y) {
        accumulator[x] = value[y]
      }
    } else {
      input.value = value.slice()
    }
  }
}

export class FlattenModel {
  constructor () {
    this.rootName = null
    this.structureRoots = null
    this.structureTraits = null
    this.costTraits = null
    this.valueTraits = null
    this.orderFunction = null

    this.rootNode = null
    this.siblingNodes = null
    this.structurePath = null
    this.structureNode = null
    this.structureAddedSiblingNodes = []

    this.rootNameState = new State('FlattenModel::RootName')
    this.structureRootsState = new State('FlattenModel::StructureRoots')
    this.structureTraitsState = new State('FlattenModel::StructureTraits')
    this.costTraitsState = new State('FlattenModel::CostTraits')
    this.valueTraitsState = new State('FlattenModel::ValueTraits')
    this.orderFunctionState = new State('FlattenModel::OrderFunction')

    this.structureBaseState = new State('FlattenModel::StructureBase', (state) => { this.updateStructureBase(state) })
    this.structureBaseState.input(this.structureRootsState)
    this.structureBaseState.input(this.structureTraitsState)
    this.structureBaseState.input(this.costTraitsState)
    this.structureNodeState = new State('FlattenModel::StructureNode', (state) => { this.updateStructureNode(state) })
    this.structureNodeState.input(this.structureBaseState)
    this.structureState = new State('FlattenModel::Structure', (state) => { this.updateStructure(state) })
    this.structureState.input(this.structureNodeState)
    this.structureStateBaseInput = this.structureState.input(this.structureBaseState)

    this.valueState = new State('FlattenModel::Value', (state) => { this.updateValue(state) })
    this.valueState.input(this.valueTraitsState)
    this.valueStateStructureInput = this.valueState.input(this.structureState, StructureStateAddedSiblingsTraits)

    this.orderState = new State('FlattenModel::Order', (state) => { this.updateOrder(state) })
    this.orderState.input(this.orderFunctionState)
    this.orderStateStructureInput = this.orderState.input(this.structureState, StructureStateAddedSiblingsTraits)
  }
  setRootName (name) {
    this.rootName = name
    const rootNode = this.rootNode
    if (rootNode) {
      rootNode.name = name
    }
    this.rootNameState.invalidate()
  }
  setStructureRoots (roots) {
    this.structureRoots = roots
    this.structureRootsState.invalidate()
  }
  setStructureTraits (traits) {
    this.structureTraits = traits
    this.structureTraitsState.invalidate()
  }
  setCostTraits (traits) {
    this.costTraits = traits
    this.costTraitsState.invalidate()
  }
  setValueTraits (traits) {
    this.valueTraits = traits
    this.valueTraitsState.invalidate()
  }
  setOrderFunction (orderFunction) {
    this.orderFunction = orderFunction
    this.orderFunctionState.invalidate()
  }
  setStructurePath (structurePath) {
    this.structurePath = structurePath
    this.structureNode = null
    this.structureNodeState.invalidate()
  }
  setStructureNode (structureNode) {
    if (structureNode !== this.structureNode) {
      this.structurePath = null
      this.structureNode = structureNode
      this.structureNodeState.invalidate()
    }
  }
  updateStructureBase (state) {
    this.create()
    this.structureAddedSiblingNodes.length = 0
  }
  updateStructureNode (state) {
    let structurePath = this.structurePath
    let structureNode = this.structureNode
    let walkingPath = null
    const rootNode = this.rootNode
    if (structureNode) {
      structurePath = []
      if (rootNode !== nodeRootPath(structureNode, structurePath)) {
        structureNode = rootNode
        walkingPath = structurePath
      }
    } else {
      structureNode = rootNode
      walkingPath = structurePath
    }
    const addedSiblingNodes = this.structureStateBaseInput.changed ? null : this.structureAddedSiblingNodes
    this.structureNode = nodeWalk(structureNode, walkingPath, (node) => {
      if (this.expand(node) && addedSiblingNodes) {
        // Contract is such, that when `expand()` returns `true`, node has at least one child.
        addedSiblingNodes.push(node.children)
      }
    })
    this.structurePath = structurePath
  }
  updateStructure (state) {
    const addedSiblingNodes = this.structureAddedSiblingNodes
    if (!this.structureStateBaseInput.changed) {
      if (addedSiblingNodes.length) {
        state.send(addedSiblingNodes)
      } else {
        state.cancel()
      }
    }
    addedSiblingNodes.length = 0
  }
  updateValue (state) {
    this.appraise(this.valueStateStructureInput.value || this.siblingNodes)
  }
  updateOrder (state) {
    this.sort(this.orderStateStructureInput.value || this.siblingNodes)
  }
  create () {
    const structureRoots = this.structureRoots
    const structureTraits = this.structureTraits
    const costTraits = this.costTraits
    const aggregatesDirect = costTraits.aggregatesDirect
    const aggregatesTransitive = costTraits.aggregatesTransitive
    const aggregates = aggregatesDirect || aggregatesTransitive
    const rootCost = aggregates ? costTraits.newCost() : null
    const rootNode = new Node(null, this.rootName || 'All', rootCost)
    rootNode.roots = structureRoots
    rootNode.self = 0
    rootNode.dir = true
    if (aggregates) {
      for (let i = structureRoots.length; i--;) {
        const root = structureRoots[i]
        const cost = structureTraits.getCost(root)
        costTraits.addCost(rootCost, cost, aggregatesDirect, aggregatesTransitive)
      }
    }
    const rootNodes = [rootNode]
    this.siblingNodes = [rootNodes]
    this.rootNode = rootNode
  }
  expand (parentNode) {
    const children = parentNode.children
    if (undefined !== children) {
      return false
    }
    const structureTraits = this.structureTraits
    const costTraits = this.costTraits
    const aggregatesDirect = costTraits.aggregatesDirect
    const aggregatesTransitive = costTraits.aggregatesTransitive
    const aggregates = aggregatesDirect || aggregatesTransitive
    const nodes = new Map()
    const callstack = new Callstack()
    structureTraits.preorderDFS(structureTraits.collectSiblings(parentNode.roots), function (item, level, hasChildren) {
      const name = structureTraits.getName(item)
      const nonRecursive = !callstack.update(level, name, hasChildren)
      // This check is just an optimization for relatively common case, so we avoid map lookup.
      if (aggregatesDirect || nonRecursive) {
        const cost = structureTraits.getCost(item)
        let node = nodes.get(name)
        if (node) {
          const addTransitive = aggregatesTransitive && nonRecursive
          if (aggregatesDirect || addTransitive) {
            costTraits.addCost(node.cost, cost, aggregatesDirect, addTransitive)
          }
          if (nonRecursive) {
            node.roots.push(item)
          }
        } else {
          node = new Node(parentNode, name, aggregates ? costTraits.copyCost(cost) : null)
          node.roots = [item]
          node.self = 0
          node.dir = true
          nodes.set(name, node)
        }
      }
    })
    if (!nodes.size) {
      parentNode.children = null
      return false
    }
    const siblings = Array.from(nodes.values())
    parentNode.children = siblings
    this.siblingNodes.push(siblings)
    return true
  }
  appraise (siblingNodes) {
    const valueTraits = this.valueTraits
    const delta = valueTraits.delta
    for (let k = siblingNodes.length; k--;) {
      const siblings = siblingNodes[k]
      for (let i = siblings.length; i--;) {
        const node = siblings[i]
        const cost = node.cost
        node.total = valueTraits.getValue(cost) || 0
        if (delta) {
          node.delta = valueTraits.getDelta(cost) || 0
        }
      }
    }
  }
  sort (siblingNodes) {
    const orderFunction = this.orderFunction
    if (orderFunction) {
      for (let k = siblingNodes.length; k--;) {
        const siblings = siblingNodes[k]
        siblings.sort(orderFunction)
      }
    }
  }
}
