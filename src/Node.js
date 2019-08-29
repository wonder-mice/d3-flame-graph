import {StructureTraits} from './Item'

// Used with `Node.flags` to support node marking. Marking is different from selection in that
// it is optimized for full node tree traversal - something like a predicate that says whether
// node is marked or not. Also marking structure allows to tell whether any specifc node has
// descendants or ancestors that are marked, but it doesn't allow to tell whether any specific
// node has descendants or ancestors that are NOT marked.
export const nodeFlagAncestorMarked = 0b0001 // node has an ancestor that is marked
export const nodeFlagDescendantMarked = 0b0010 // node has a descendant that is marked
export const nodeFlagMarked = 0b0100 // node is marked
export const nodeFlagHiddenDescendantMarked = 0b1000 // nodes has marked descendant that are not visible (e.g. too small).
export const nodeFlagMarkedShift = 2

// Used with `Node.flags` to support node selection. Selection is different from marking in that
// it is optimized for selecting and unselecting specific set of nodes (i.e. list of nodes is known
// and full node tree traversal is not needed). Its structure is more symmetrical, in that it's
// equally easy to get information about what is selected as what is unselected. However this comes
// at a cost - certain questions (e.g. does this node has (un)selected descendant?) can not be
// answered easily.
// When `nodeFlagSelectionTerminator` is set, all node's descendants have the same state of
// `nodeFlagSelected` flag.  E.g. if node has both `nodeFlagSelected` and `nodeFlagSelectionTerminator`
// flags set, then the entire subtree is selected. And if node only has `nodeFlagSelectionTerminator`
// flag set, then the entire subtree is not selected. For leaf nodes `nodeFlagSelectionTerminator`
// should always be set.
export const nodeFlagSelected = 0b10000
export const nodeFlagSelectionTerminator = 0b100000
export const nodeMaskSelection = 0b110000
export const nodeMaskSelectionShift = 4

// Used with `Node.flags` to indicate nodes that provide context for other nodes.
export const nodeFlagFocused = 0b11000000 // node is focused
export const nodeFlagDescendantFocused = 0b10000000 // node is on the path from focused node to the root
export const nodeMaskFocus = 0b11000000
export const nodeMaskFocusShift = 6

// Used with `Node.flags` to indicate small nodes. Small nodes can be rendered differently not to
// include as much of a content, because it'll be not visible anyway.
export const nodeFlagTiny = 0b100000000

// Used with `Node.flags` to indicate highlighted nodes. Highlight is an amalgam of marking and selection.
// As selection, it is optimized for cases where set of nodes that needs to be highlighted is known. And
// as marking, it allows to tell whether node has hidden highlighted descendant. These flags are transient
// and are cleared by layout. These flags are only valid for layed out nodes - nodes that are not part of
// current page will have these flags in undeterminite state. Importan difference from marking and
// selection - for marking and selection, node tree (and node flags) is the source of truth, while for
// highlight node flags are just a projection of external source of truth (e.g. list of highlighted nodes).
export const nodeFlagHighlighted = 0b1000000000
export const nodeFlagHiddenDescendantHighlighted = 0b10000000000
export const nodeMaskHighlight = 0b11000000000
export const nodeMaskHighlightShift = 9

export class Node {
  constructor (parent, name, cost) {
    this.parent = parent
    this.name = name
    this.cost = cost
    this.flags = nodeFlagSelected | nodeFlagSelectionTerminator
    // this.mark = 0
    // Short for `revision`. Value stored in this field is the same for all visible nodes, while not visible nodes
    // will have values different from the value that visible nodes have. This technique saves cycles on marking
    // nodes discarded by layout as invisible. Since usually there are more invisible nodes then visible, it gives
    // nice time savings.
    this.rev = 0
    // Optional fields:
    // .roots - array of items used to generate this node
    // Value fields:
    // .total - signed scalar, total cost of the node and it's descendants (can be negative!)
    // .self - signed scalar, intrinsic cost of the node itself (can be negative!)
    // .delta - signed scalar, used for node coloring
    // Appraisal updates `node.total`, `node.self` and `node.delta` fields using `ValueTraits.getValue()`
    // and `ValueTraits.getDelta()` methods. Updated fields don't have any intrinsic semantic
    // meaning other than how layout interprets them. Nodes will be laid out in space allowed
    // by `parent.total - parent.self` proportionally to their `total` value. Item value that
    // is returned from `ValueTraits.getValue()`) can be negative (e.g. when value represents
    // some kind of a delta, though not necessary the same as `ValueTraits.getDelta()`). Keep
    // in mind, that following is NOT neccessary true:
    //   parent.total == parent.self + sum([child.total for child in parent.children])
    //   node.total >= node.self
    // Layout is free to interpret such cases as it sees fit (pun intended).
  }
}

export function nodeTraverse (queue, callback) {
  for (let k = queue.length; k--;) {
    const nodes = queue[k]
    for (let i = nodes.length; i--;) {
      const node = nodes[i]
      if (callback(node)) {
        const children = node.children
        if (children) {
          queue[k++] = children
        }
      }
    }
  }
}

export function nodeNamed (nodes, name) {
  if (nodes) {
    for (let i = nodes.length; i--;) {
      const node = nodes[i]
      if (node.name === name) {
        return node
      }
    }
  }
  return null
}

export function nodeRoot (node) {
  for (let parent = node; parent; parent = (node = parent).parent) {}
  return node
}

export function nodeRootPath (node, path) {
  // Root name is not part of the path because root is always there and its name
  // doesn't really means much and used mostly for visual purposes.
  for (let parent = node.parent; parent; parent = (node = parent).parent) {
    if (path) {
      path.push(node.name)
    }
  }
  return node
}

export function nodeWalk (node, path, expand) {
  for (let k = path ? path.length : 0; ;) {
    if (expand) {
      expand(node)
    }
    if (!k) {
      break
    }
    const children = node.children
    if (!children || !children.length) {
      path.splice(0, k)
      break
    }
    let pathNode = null
    while (k && !(pathNode = nodeNamed(children, path[--k]))) {
      path.splice(k, 1)
    }
    if (!pathNode) {
      break
    }
    node = pathNode
  }
  return node
}

export class NodeStructureTraits extends StructureTraits {
  static getName (node) { return node.name }
  static getCost (node) { return node.cost }
  static getChildren (node) { return node.children }
}

export class NodeContext {
  constructor () {
    this.hasDelta = false
    this.maxDelta = 0
  }
}
