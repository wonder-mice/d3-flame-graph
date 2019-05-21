import {State, StateInputTraits} from './State'
import {Callstack} from './Callstack'
import {Node} from './Node'

export class StructureStateAddedSiblingsInputTraits extends StateInputTraits {
  static update (input, value) {
    const accumulator = input.value
    if (accumulator) {
      accumulator.push(value)
    } else {
      input.value = [value]
    }
  }
}

export class StructureStateAddedSiblingsOutputTraits extends StateInputTraits {
  static update (input, value) {
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

export class NodeModel {
  constructor () {
    this.rootName = null
    this.structureRoots = null
    this.structureTraits = null
    this.costTraits = null
    this.valueTraits = null
    this.orderFunction = null

    this.rootNode = null
    this.siblingNodes = null

    this.structureRootsState = new State('NodeModel::StructureRoots')
    this.structureTraitsState = new State('NodeModel::StructureTraits')
    this.costTraitsState = new State('NodeModel::CostTraits')
    this.valueTraitsState = new State('NodeModel::ValueTraits')
    this.orderFunctionState = new State('NodeModel::OrderFunction')

    this.structureState = new State('NodeModel::Structure')
    this.valueState = new State('NodeModel::Value')
    this.orderState = new State('NodeModel::Order')
    this.nameState = new State('NodeModel::Name')
    this.selectionState = new State('NodeModel::Selection')
  }
  setRootName (name) {
    this.rootName = name
    this.nameState.invalidate()
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
}

export class StructureModel extends NodeModel {
  constructor () {
    super()

    this.structureState.input(this.structureRootsState)
    this.structureState.input(this.structureTraitsState)
    this.valueState.input(this.valueTraitsState)
    this.valueState.input(this.structureState)
    this.orderState.input(this.orderFunctionState)
    this.orderState.input(this.structureState)
    this.selectionState.input(this.structureState)

    this.structureState.action = (state) => { this.create() }
    this.valueState.action = (state) => { this.appraise() }
    this.orderState.action = (state) => { this.sort() }
  }
  create () {
    const structureTraits = this.structureTraits
    const structureRoots = this.structureRoots
    const structureRootCount = structureRoots ? structureRoots.length : 0
    const superRootRequired = this.rootName || (1 !== structureRootCount)
    // Always create super root, because it makes code simpler and eliminates
    // extra `if`-s in DFS loop making it more efficient.
    const superRoot = new Node(null, this.rootName || 'All', null)
    const superRootChildren = superRoot.children = []
    const rootNodes = superRootRequired ? [superRoot] : superRootChildren
    const siblingNodes = [rootNodes]
    if (superRootRequired && structureRootCount) {
      siblingNodes.push(superRootChildren)
    }
    const parents = [superRoot]
    structureTraits.preorderDFS(structureRoots.slice(), function (item, level, hasChildren) {
      const parent = parents[level]
      const node = new Node(parent, structureTraits.getName(item), structureTraits.getCost(item))
      parent.children.push(node)
      if (hasChildren) {
        siblingNodes.push(node.children = [])
        parents[level + 1] = node
      } else {
        node.children = null
      }
    })
    if (superRootRequired) {
      const costTraits = this.costTraits
      if (costTraits) {
        const rootCost = superRoot.cost = costTraits.newCost()
        if (costTraits.aggregatesTransitive) {
          for (let i = superRootChildren.length; i--;) {
            costTraits.addCost(rootCost, superRootChildren[i].cost, false, true)
          }
        }
      }
    } else {
      for (let i = superRootChildren.length; i--;) {
        superRootChildren[i].parent = null
      }
    }
    this.rootNode = rootNodes.length ? rootNodes[0] : null
    this.siblingNodes = siblingNodes
  }
  appraise () {
    const valueTraits = this.valueTraits
    const direct = valueTraits.direct
    const delta = valueTraits.delta
    const siblingNodes = this.siblingNodes
    const siblingCount = siblingNodes.length
    for (let k = 0; k < siblingCount; ++k) {
      let total = 0
      const siblings = siblingNodes[k]
      for (let i = siblings.length; i--;) {
        const node = siblings[i]
        const cost = node.cost
        total += (node.total = node.self = valueTraits.getValue(cost) || 0)
        if (delta) {
          node.delta = valueTraits.getDelta(cost) || 0
        }
      }
      if (!direct && 0 < k) {
        // Maybe it'll be better to move `node` in loop above out and make it non-constant. Then its last
        // value can be used here as "any node" to get siblings parent (saves array index access).
        const parent = siblings[0].parent
        parent.self -= total
      }
    }
    // If neccessary, traverse the tree in reverse order to compute `total` fields.
    if (direct) {
      for (let k = siblingCount; 1 < k--;) {
        const siblings = siblingNodes[k]
        let total = 0
        for (let i = siblings.length; i--;) {
          total += siblings[i].total
        }
        // Same here, can use non-constant variable in loop above and use its last value here as "any node".
        const parent = siblings[0].parent
        parent.total += total
      }
    }
  }
  sort () {
    const orderFunction = this.orderFunction
    if (orderFunction) {
      const siblingNodes = this.siblingNodes
      for (let k = siblingNodes.length; k--;) {
        const siblings = siblingNodes[k]
        siblings.sort(orderFunction)
      }
    }
  }
}

export class FlattenModel extends NodeModel {
  constructor () {
    super()

    this.structureBaseState = new State('FlattenModel::StructureBase', (state) => { this.updateStructureBase(state) })
    this.structureBaseState.input(this.structureRootsState)
    this.structureBaseState.input(this.structureTraitsState)
    this.structureStateBaseInput = this.structureState.input(this.structureBaseState)
    this.structureStateAddedSiblingsInput = this.structureState.input(null, StructureStateAddedSiblingsInputTraits)

    this.valueBaseState = new State('FlattenModel::ValueBase', (state) => { this.updateValueBase(state) })
    this.valueBaseState.input(this.structureBaseState)
    this.valueBaseState.input(this.valueTraitsState)
    this.valueStateBaseInput = this.valueState.input(this.valueBaseState)
    this.valueStateStructureInput = this.valueState.input(this.structureState, StructureStateAddedSiblingsOutputTraits)

    this.orderBaseState = new State('FlattenModel::OrderBase', (state) => { this.updateOrderBase(state) })
    this.orderBaseState.input(this.structureBaseState)
    this.orderBaseState.input(this.orderFunctionState)
    this.orderStateBaseInput = this.orderState.input(this.orderBaseState)
    this.orderStateStructureInput = this.orderState.input(this.structureState, StructureStateAddedSiblingsOutputTraits)

    this.structureState.action = (state) => { this.updateStructure(state) }
    this.valueState.action = (state) => { this.updateValue(state) }
    this.orderState.action = (state) => { this.updateOrder(state) }
  }
  setExpandedNode (node) {
    if (this.expand(node)) {
      this.structureStateAddedSiblingsInput.send(node.children)
    }
  }
  updateStructureBase (state) {
    this.create()
    this.structureStateAddedSiblingsInput.cancel()
  }
  updateStructure (state) {
    // This condition is redundant, since `updateStructureBase()` will cancel
    // `structureStateAddedSiblingsInput`. Full condition for readability.
    if (!this.structureStateBaseInput.changed && this.structureStateAddedSiblingsInput.changed) {
      const addedSiblings = this.structureStateAddedSiblingsInput.value
      if (addedSiblings && addedSiblings.length) {
        state.send(addedSiblings)
      } else {
        state.cancel()
      }
    }
  }
  updateValueBase (state) {
    this.appraise(this.siblingNodes)
  }
  updateValue (state) {
    if (this.valueStateBaseInput.changed) {
      return
    }
    const addedSiblings = this.valueStateStructureInput.value
    this.appraise(addedSiblings)
  }
  updateOrderBase (state) {
    this.sort(this.siblingNodes)
  }
  updateOrder (state) {
    if (this.orderStateBaseInput.changed) {
      return
    }
    const addedSiblings = this.orderStateStructureInput.value
    this.sort(addedSiblings)
  }
  create () {
    const structureRoots = this.structureRoots
    const structureTraits = this.structureTraits
    const costTraits = this.costTraits
    const aggregatesDirect = costTraits.aggregatesDirect
    const aggregatesTransitive = costTraits.aggregatesTransitive
    const rootCost = costTraits.newCost()
    const rootNode = new Node(null, this.rootName || 'All', rootCost)
    rootNode.roots = structureRoots
    rootNode.self = 0
    rootNode.dir = true
    for (let i = structureRoots.length; i--;) {
      const root = structureRoots[i]
      const cost = structureTraits.getCost(root)
      costTraits.addCost(rootCost, cost, aggregatesDirect, aggregatesTransitive)
    }
    this.rootNode = rootNode
    const rootNodes = [rootNode]
    this.siblingNodes = [rootNodes]
    this.expandedSiblingNodes = null
    this.expand(rootNode)
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

/*
export class ConsolidatedTreeModel extends NodeModel {
  constructor () {
    super()
  }
}
*/
