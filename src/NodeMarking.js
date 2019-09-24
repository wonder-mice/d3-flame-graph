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
  return marked
}
