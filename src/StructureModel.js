import {State} from './State'
import {Node} from './Node'

export class StructureModel {
  constructor () {
    this.rootName = null
    this.structureRoots = null
    this.structureTraits = null
    this.costTraits = null
    this.valueTraits = null
    this.orderFunction = null

    this.rootNode = null
    this.siblingNodes = null

    this.structureRootsState = new State('StructureModel::StructureRoots')
    this.structureTraitsState = new State('StructureModel::StructureTraits')
    this.costTraitsState = new State('StructureModel::CostTraits')
    this.valueTraitsState = new State('StructureModel::ValueTraits')
    this.orderFunctionState = new State('StructureModel::OrderFunction')

    this.rootNameState = new State('StructureModel::RootName')
    this.structureState = new State('StructureModel::Structure', (state) => { this.create() })
    this.structureState.input(this.structureRootsState)
    this.structureState.input(this.structureTraitsState)
    this.valueState = new State('StructureModel::Value', (state) => { this.appraise() })
    this.valueState.input(this.valueTraitsState)
    this.valueState.input(this.structureState)
    this.orderState = new State('StructureModel::Order', (state) => { this.sort() })
    this.orderState.input(this.orderFunctionState)
    this.orderState.input(this.structureState)
    this.selectionState = new State('StructureModel::Selection')
    this.selectionState.input(this.structureState)
  }
  setRootName (name) {
    this.rootName = name
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
