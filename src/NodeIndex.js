import {Callstack} from './Callstack'

export class NodeIndexEntry {
  constructor (nodes, aggregate) {
    this.nodes = nodes
    this.aggregate = aggregate
  }
}

export function nodeIndexNodes (index, key) {
  let entry
  return index && (entry = index.get(key)) && entry.nodes
}

export function nodeIndexAggregate (index, key) {
  let entry
  return index && (entry = index.get(key)) && entry.aggregate
}

export function createNodeNameIndex (rootNodes, costTraits) {
  const aggregatesDirect = costTraits.aggregatesDirect
  const aggregatesTransitive = costTraits.aggregatesTransitive
  const aggregates = aggregatesDirect || aggregatesTransitive
  const callstack = aggregatesTransitive ? new Callstack() : null
  const queue = rootNodes.slice()
  const levels = Array(queue.length).fill(0)
  const index = new Map()
  for (let k = queue.length; k--;) {
    const node = queue[k]
    const level = levels[k]
    const name = node.name
    const children = node.children
    const childrenCount = children && children.length
    if (childrenCount) {
      const childrenLevel = level + 1
      for (let i = childrenCount; i--; k++) {
        queue[k] = children[i]
        levels[k] = childrenLevel
      }
    }
    const addTransitive = callstack ? !callstack.update(level, name, childrenCount) : false
    let entry = index.get(name)
    if (entry) {
      entry.nodes.push(node)
      if (aggregatesDirect || addTransitive) {
        costTraits.addCost(entry.aggregate, node.cost, aggregatesDirect, addTransitive)
      }
    } else {
      entry = new NodeIndexEntry([node], aggregates ? costTraits.copyCost(node.cost) : null)
      index.set(name, entry)
    }
  }
  return index
}
