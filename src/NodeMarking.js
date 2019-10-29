import {nodeFlagMarked, nodeFlagDescendantMarked, nodeFlagHiddenDescendantMarked, nodeFlagAncestorMarked} from './Node'

const markingMask = nodeFlagMarked | nodeFlagDescendantMarked | nodeFlagHiddenDescendantMarked | nodeFlagAncestorMarked
const markedAncestorMask = nodeFlagMarked | nodeFlagAncestorMarked
const markedHiddenDescendantMask = nodeFlagDescendantMarked | nodeFlagHiddenDescendantMarked

function updateMarkedNodeAncestors (ancestor) {
  while (ancestor) {
    const ancestorFlags = ancestor.flags
    if (ancestorFlags & nodeFlagDescendantMarked) {
      return
    }
    ancestor.flags = ancestorFlags | nodeFlagDescendantMarked
    ancestor = ancestor.parent
  }
}

function updateMarkedNodeAncestorsHidden (ancestor, layoutRevision) {
  // This function assumes that `ancestor` has a `node` for which `ancestor === node.parent`
  // and `node.rev !== layoutRevision` and  `null !== layoutRevision`.
  while (ancestor) {
    const ancestorFlags = ancestor.flags
    if (ancestorFlags & markedHiddenDescendantMask) {
      return
    }
    const rev = ancestor.rev
    ancestor.flags = ancestorFlags | markedHiddenDescendantMask
    ancestor = ancestor.parent
    if (rev === layoutRevision) {
      break
    }
  }
  updateMarkedNodeAncestors(ancestor)
}

export function markNodes (rootNodes, predicate, layoutRevision) {
  const marked = []
  const queue = [rootNodes]
  const updateHiddenDescendantMarked = null !== layoutRevision
  for (let k = queue.length, n = 0; k--;) {
    const nodes = queue[k]
    for (let i = nodes.length; i--;) {
      const node = nodes[i]
      if (predicate) {
        let ancestor = node.parent
        let flags = 0
        if (predicate(node)) {
          flags = nodeFlagMarked
          marked[n++] = node
          if (updateHiddenDescendantMarked && node.rev !== layoutRevision) {
            updateMarkedNodeAncestorsHidden(ancestor, layoutRevision)
          } else {
            updateMarkedNodeAncestors(ancestor)
          }
        }
        if (ancestor && (ancestor.flags & markedAncestorMask)) {
          flags |= nodeFlagAncestorMarked
        }
        node.flags = (node.flags & ~markingMask) | flags
      } else {
        node.flags &= ~markingMask
      }
      const children = node.children
      if (children && children.length) {
        queue[k++] = children
      }
    }
  }
  return 0 < marked.length ? marked : null
}

export function markedNodesAggregate (rootNodes, costTraits) {
  const aggregatesDirect = costTraits.aggregatesDirect
  const aggregatesTransitive = costTraits.aggregatesTransitive
  if (!aggregatesDirect && !aggregatesTransitive) {
    return null
  }
  let cost = null
  const queue = [rootNodes]
  const queueAddTransitive = aggregatesDirect && aggregatesTransitive ? [true] : null
  for (let k = queue.length; k--;) {
    const nodes = queue[k]
    const addTransitive = queueAddTransitive ? queueAddTransitive[k] : aggregatesTransitive
    for (let i = nodes.length; i--;) {
      const node = nodes[i]
      const flags = node.flags
      const marked = flags & nodeFlagMarked
      if (marked) {
        if (cost) {
          costTraits.addCost(cost, node.cost, aggregatesDirect, addTransitive)
        } else {
          cost = costTraits.copyCost(node.cost)
        }
        // Only inspect `children` of marked `node` if `aggregatesDirect` is `true`.
        if (!aggregatesDirect) {
          continue
        }
      }
      if (flags & nodeFlagDescendantMarked) {
        if (queueAddTransitive) {
          queueAddTransitive[k] = addTransitive && !marked
        }
        // `node.children` is non-null and non-empty because it has at least one
        // marked descendant.
        queue[k++] = node.children
      }
    }
  }
  return cost
}

// Same as `markedNodesAggregate()`, but always traverses all marked nodes to
// put them into `markedNodes`, which must be a non-null array.
export function markedNodesListAggregate (rootNodes, costTraits, markedNodes) {
  const aggregatesDirect = costTraits.aggregatesDirect
  const aggregatesTransitive = costTraits.aggregatesTransitive
  let cost = null
  let n = markedNodes.length
  const queue = [rootNodes]
  const queueAddTransitive = aggregatesTransitive ? [true] : null
  for (let k = queue.length; k--;) {
    const nodes = queue[k]
    const addTransitive = queueAddTransitive && queueAddTransitive[k]
    const addMarked = addTransitive || aggregatesDirect
    for (let i = nodes.length; i--;) {
      const node = nodes[i]
      const flags = node.flags
      const marked = flags & nodeFlagMarked
      if (marked) {
        if (addMarked) {
          if (cost) {
            costTraits.addCost(cost, node.cost, aggregatesDirect, addTransitive)
          } else {
            cost = costTraits.copyCost(node.cost)
          }
        }
        markedNodes[n++] = node
      }
      if (flags & nodeFlagDescendantMarked) {
        if (queueAddTransitive) {
          queueAddTransitive[k] = addTransitive && !marked
        }
        // `node.children` is non-null and non-empty because it has at least one
        // marked descendant.
        queue[k++] = node.children
      }
    }
  }
  return cost
}
