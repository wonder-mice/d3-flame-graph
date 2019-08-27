import {State} from './State'
import {StructureTraits} from './Item'
import {nodeFlagSelected, nodeFlagSelectionTerminator, nodeTraverse} from './Node'

const selectionMask = nodeFlagSelected | nodeFlagSelectionTerminator

function selectionRoots (root) {
  return root ? [root] : null
}

function selectionForEach (nodes, flag, callback) {
  for (let i = nodes.length; i--;) {
    callback(nodes[i], flag)
  }
}

function selectionAllEqual (children, bits) {
  for (let i = children.length; i--;) {
    if (bits !== (children[i].flags & selectionMask)) {
      return false
    }
  }
  return true
}

function selectionSyncAncestors (node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    const selectedBits = parent.flags & selectionMask
    const terminatorBits = selectedBits | nodeFlagSelectionTerminator
    if (selectionAllEqual(parent.children, terminatorBits)) {
      if (selectedBits === terminatorBits) {
        break
      }
      parent.flags |= nodeFlagSelectionTerminator
    } else {
      if (selectedBits !== terminatorBits) {
        break
      }
      parent.flags &= ~nodeFlagSelectionTerminator
    }
  }
}

function selectionUpdateNode (node, flag) {
  const selected = node.flags
  if (flag === (selected & nodeFlagSelected)) {
    return false
  }
  let bits = flag | nodeFlagSelectionTerminator
  const children = node.children
  if (children && !selectionAllEqual(children, bits)) {
    bits &= ~nodeFlagSelectionTerminator
  }
  node.flags = (selected & ~selectionMask) | bits
  return true
}

function selectionUpdateSubtree (node, nodeFlag, descendantsFlag) {
  const selected = node.flags
  const selectedBits = selected & selectionMask
  const children = node.children
  const leaf = !children || !children.length
  let nodeBits = nodeFlag
  let changed = true
  if (nodeFlag === descendantsFlag || leaf) {
    nodeBits |= nodeFlagSelectionTerminator
    if (nodeBits === selectedBits) {
      return false
    }
    node.flags = (selected & ~selectionMask) | nodeBits
  } else if (nodeBits !== selectedBits) {
    node.flags = (selected & ~selectionMask) | nodeBits
  } else {
    changed = false
  }
  if (!leaf) {
    const descendantBits = descendantsFlag | nodeFlagSelectionTerminator
    nodeTraverse([children], (descendant) => {
      const selected = descendant.flags
      if (descendantBits === (selected & selectionMask)) {
        return false
      }
      descendant.flags = (selected & ~selectionMask) | descendantBits
      changed = true
      return true
    })
  }
  return changed
}

function selectionUpdateAncestors (node, siblingsFlag, ancestorsFlag) {
  let parentFlag = ancestorsFlag | nodeFlagSelectionTerminator
  if (parentFlag !== (node.flags & selectionMask)) {
    parentFlag = ancestorsFlag
  }
  let changed = false
  for (let parent = node.parent; parent; parent = (node = parent).parent) {
    const siblings = parent.children
    let i = siblings.length
    if (1 < i--) {
      do {
        const sibling = siblings[i]
        if (sibling !== node) {
          changed = selectionUpdateSubtree(sibling, siblingsFlag, siblingsFlag) || changed
        }
      } while (i--)
      if (siblingsFlag !== ancestorsFlag) {
        parentFlag = ancestorsFlag
      }
    }
    const selected = parent.flags
    if (parentFlag !== (selected & selectionMask)) {
      parent.flags = (selected & ~selectionMask) | parentFlag
      changed = true
    }
  }
  return changed
}

export function selectionReset (roots, flag) {
  if (roots) {
    const bits = flag | nodeFlagSelectionTerminator
    nodeTraverse([roots], (node) => {
      node.flags = (node.flags & ~selectionMask) | bits
      return true
    })
  }
  return true
}

export function selectionModifyNode (node, flag) {
  if (selectionUpdateNode(node, flag)) {
    selectionSyncAncestors(node)
    return true
  }
  return false
}

export function selectionModifyAncestors (node, flag) {
  let changed = false
  do {
    changed = selectionUpdateNode(node, flag) || changed
  } while ((node = node.parent))
  return changed
}

export function selectionModifySubtree (node, flag) {
  if (selectionUpdateSubtree(node, flag, flag)) {
    selectionSyncAncestors(node)
    return true
  }
  return false
}

export function selectionModifyNamedNodes (roots, name, flag) {
  let changed = false
  if (roots) {
    nodeTraverse([roots], (node) => {
      if (node.name === name) {
        changed = selectionModifyNode(node, flag) || changed
      }
      return true
    })
  }
  return changed
}

export function selectionModifyNamedAncestors (roots, name, flag) {
  let changed = false
  if (roots) {
    nodeTraverse([roots], (node) => {
      if (node.name === name) {
        changed = selectionModifyAncestors(node, flag) || changed
      }
      return true
    })
  }
  return changed
}

export function selectionModifyNamedSubtrees (roots, name, flag) {
  let changed = false
  if (roots) {
    nodeTraverse([roots], (node) => {
      if (node.name === name) {
        changed = selectionModifySubtree(node, flag) || changed
        return false
      }
      return true
    })
  }
  return changed
}

export function selectionSetNamedNodes (roots, name) {
  let changed = false
  if (roots) {
    nodeTraverse([roots], (node) => {
      changed = selectionModifyNode(node, node.name === name ? nodeFlagSelected : 0) || changed
      return true
    })
  }
  return changed
}

export function selectionSetNamedAncestors (roots, name) {
  let changed = false
  if (roots) {
    nodeTraverse([roots], (node) => {
      if (node.name === name) {
        changed = selectionModifyAncestors(node, nodeFlagSelected) || changed
      } else {
        changed = selectionModifyNode(node, 0) || changed
      }
      return true
    })
  }
  return changed
}

export function selectionSetNamedSubtrees (roots, name) {
  let changed = false
  if (roots) {
    nodeTraverse([roots], (node) => {
      if (node.name === name) {
        changed = selectionModifySubtree(node, nodeFlagSelected) || changed
        return false
      }
      changed = selectionModifyNode(node, 0) || changed
      return true
    })
  }
  return changed
}

export class NodeSelection {
  constructor (model) {
    this.model = model
    this.selectionState = model.selectionState
    this.indexState = new State('NodeSelection::Index', (state) => { this.updateIndex(state) })
    this.indexState.input(this.selectionState)
  }
  reset (include) {
    selectionReset(selectionRoots(this.model.rootNode), include ? nodeFlagSelected : 0)
    this.selectionState.invalidate()
  }
  modifyNode (node, include) {
    selectionModifyNode(node, include ? nodeFlagSelected : 0)
    this.selectionState.invalidate()
  }
  modifySubtree (node, include) {
    selectionModifySubtree(node, include ? nodeFlagSelected : 0)
    this.selectionState.invalidate()
  }
  modifyAncestors (node, include) {
    selectionModifyAncestors(node, include ? nodeFlagSelected : 0)
    this.selectionState.invalidate()
  }
  modifyNamedNodes (name, include) {
    selectionModifyNamedNodes(selectionRoots(this.model.rootNode), name, include ? nodeFlagSelected : 0)
    this.selectionState.invalidate()
  }
  modifyNamedAncestors (name, include) {
    selectionModifyNamedAncestors(selectionRoots(this.model.rootNode), name, include ? nodeFlagSelected : 0)
    this.selectionState.invalidate()
  }
  modifyNamedSubtrees (name, include) {
    selectionModifyNamedSubtrees(selectionRoots(this.model.rootNode), name, include ? nodeFlagSelected : 0)
    this.selectionState.invalidate()
  }
  setNode (node) {
    selectionUpdateSubtree(node, nodeFlagSelected, 0)
    selectionUpdateAncestors(node, 0, 0)
    this.selectionState.invalidate()
  }
  setSubtree (node) {
    selectionUpdateSubtree(node, nodeFlagSelected, nodeFlagSelected)
    selectionUpdateAncestors(node, 0, 0)
    this.selectionState.invalidate()
  }
  setAncestors (node) {
    selectionUpdateSubtree(node, nodeFlagSelected, 0)
    selectionUpdateAncestors(node, 0, nodeFlagSelected)
    this.selectionState.invalidate()
  }
  setNamedNodes (name) {
    selectionSetNamedNodes(selectionRoots(this.model.rootNode), name)
    this.selectionState.invalidate()
  }
  setNamedSubtrees (name) {
    selectionSetNamedSubtrees(selectionRoots(this.model.rootNode), name)
    this.selectionState.invalidate()
  }
  setNamedAncestors (name) {
    selectionSetNamedAncestors(selectionRoots(this.model.rootNode), name)
    this.selectionState.invalidate()
  }
  updateIndex (state) {
    // [source]      [result]      [how]
    //  direct        direct        node.selectedCost = node.cost for each node
    //  direct        transitive    node.selectedCost = sum(child.cost) if child is selected
    //  transitive    direct        node.selectedCost = node.cost - sum(child.cost)
    //  transitive    transitive    node.selectedCost = node.cost - sum(child.cost)
  }
}

export class FlattenNodeSelection {
  constructor (selection) {
    this.selection = selection
    this.selectionState = selection.selectionState
  }
  modifyNode (node, include) {
    // FIXME: Likely need also modify recursive roots)
    selectionForEach(node.roots, include ? nodeFlagSelected : 0, (node, flag) => { selectionModifyNode(node, flag) })
    this.selectionState.invalidate()
  }
  modifySubtree (node, include) {
    // FIXME: Likely need also modify recursive roots)
    selectionForEach(node.roots, include ? nodeFlagSelected : 0, (node, flag) => { selectionModifySubtree(node, flag) })
    this.selectionState.invalidate()
  }
  modifyAncestors (node, include) {
    // FIXME: Likely need also modify recursive roots)
    selectionForEach(node.roots, include ? nodeFlagSelected : 0, (node, flag) => { selectionModifyAncestors(node, flag) })
    this.selectionState.invalidate()
  }
  modifyNamedNodes (name, include) {
    this.selection.modifyNamedNodes(name, include)
  }
  modifyNamedAncestors (name, include) {
    this.selection.modifyNamedAncestors(name, include)
  }
  modifyNamedSubtrees (name, include) {
    this.selection.modifyNamedSubtrees(name, include)
  }
  setNode (node) {
    this.selection.reset(false)
    selectionForEach(node.roots, nodeFlagSelected, (node, flag) => { selectionModifyNode(node, flag) })
    this.selectionState.invalidate()
  }
  setSubtree (node) {
    this.selection.reset(false)
    selectionForEach(node.roots, nodeFlagSelected, (node, flag) => { selectionModifySubtree(node, flag) })
    this.selectionState.invalidate()
  }
  setAncestors (node) {
    this.selection.reset(false)
    selectionForEach(node.roots, nodeFlagSelected, (node, flag) => { selectionModifyAncestors(node, flag) })
    this.selectionState.invalidate()
  }
  setNamedNodes (name) {
    this.selection.setNamedNodes(name)
  }
  setNamedSubtrees (name) {
    this.selection.setNamedSubtrees(name)
  }
  setNamedAncestors (name) {
    this.selection.setNamedAncestors(name)
  }
}

export class NodeSelectionStructureTraits extends StructureTraits {
  static getName (node) { return node.name }
  static getCost (node) { return node.cost }
  static getChildren (node) { throw Error('Method not implemented.') }
  static preorderDFS (queue, callback) {
    let k = queue.length
    let pk = 0
    const levels = Array(k).fill(0)
    const pending = []
    while (k--) {
      const node = queue[k]
      const level = levels[k]
      const childrenLevel = level + 1
      const sk = k
      let children = node.children
      if (children) {
        for (;;) {
          for (let i = children.length; i--;) {
            const child = children[i]
            const selected = child.flags
            if (selected & nodeFlagSelected) {
              queue[k] = child
              levels[k] = childrenLevel
              ++k
              // } else if (selected & nodeFlagDescendantSelected) {
            } else if (!(selected & nodeFlagSelectionTerminator)) {
              const grandChildren = child.children
              if (grandChildren) {
                pending[pk++] = grandChildren
              }
            }
          }
          if (!pk) {
            break
          }
          children = pending[--pk]
        }
      }
      callback(node, level, k - sk)
    }
  }
  static collectSiblings (parents) {
    const result = []
    const queue = parents.slice()
    for (let k = queue.length; k--;) {
      const parent = queue[k]
      const children = parent.children
      if (children) {
        for (let i = children.length; i--;) {
          const child = children[i]
          const selected = child.flags
          if (selected & nodeFlagSelected) {
            result.push(child)
            // } else if (selected & nodeFlagDescendantSelected) {
          } else if (!(selected & nodeFlagSelectionTerminator)) {
            queue[k++] = child
          }
        }
      }
    }
    return result
  }
  static selectedRoots (roots) {
    const result = []
    const queue = [roots]
    for (let k = queue.length; k--;) {
      const nodes = queue[k]
      for (let i = nodes.length; i--;) {
        const node = nodes[i]
        const selected = node.flags
        if (selected & nodeFlagSelected) {
          result.push(node)
          // } else if (selected & nodeFlagDescendantSelected && node.children) {
        } else if (!(selected & nodeFlagSelectionTerminator) && node.children) {
          queue[k++] = node.children
        }
      }
    }
    return result
  }
  static suggestedName (nodes, emptyName, ambiguousName) {
    const n = nodes ? nodes.length : 0
    if (!n) {
      return emptyName
    }
    const names = new Set()
    for (let i = n; i--;) {
      names.add(nodes[i].name)
    }
    return 1 === names.size ? nodes[0].name : ambiguousName
  }
}

/*
export class NodeSelection {
  constructor () {
    this.nodes = null
    this.index = null
  }
  update (nodes, costTraits) {
    if (nodes && nodes.length) {
      this.nodes = nodes
      this.index = createNodeNameIndex(nodes, costTraits)
    } else {
      this.reset()
    }
  }
  reset () {
    this.nodes = null
    this.index = null
  }
}
*/
