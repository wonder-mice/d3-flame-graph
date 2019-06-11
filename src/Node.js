// `Node.mark` flags:
export const nodeMarked = 0b0001 // node is marked
export const nodeDescendantMarked = 0b0010 // node has a descendant that is marked
export const nodeAncestorMarked = 0b0100 // node has an ancestor that is marked
export const nodeHiddenDescendantMarked = 0b1000 // node has marked descendants that are not visible (e.g. too small)

// `Node.bits` flags:
export const nodeFocused = 0b11 // node is focused
export const nodeDescendantFocused = 0b10 // node is on the path from focused node to the root

// Flag is set when node is selected.
export const nodeFlagSelected = 0b000100
// When set, all node's descendants have the same state of `nodeFlagSelected` flag.  E.g. if
// node has both `nodeFlagSelected` and `nodeFlagSelectionTerminator` flags set, then the entire
// subtree is selected. And if node only has `nodeFlagSelectionTerminator` flag set, then the
// entire subtree is not selected. For leaf nodes `nodeFlagSelectionTerminator` should always
// be set.
export const nodeFlagSelectionTerminator = 0b001000

export class Node {
  constructor (parent, name, cost) {
    this.parent = parent
    this.name = name
    this.cost = cost
    this.mark = 0
    this.bits = 0
    // Short for `revision`. Value stored in this field is the same for all visible nodes, while not visible nodes
    // will have values different from the value that visible nodes have. This technique saves cycles on marking
    // nodes discarded by layout as invisible. Since usually there are more invisible nodes then visible, it gives
    // nice time savings.
    this.rev = 0
    // Optional fields:
    // .roots - array of items used to generate this node
    // .dir - boolean, true if item is a directory
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
    this.selected = nodeFlagSelected | nodeFlagSelectionTerminator
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

export function nodeRoot (node) {
  for (let parent = node; parent; parent = (node = parent).parent) {}
  return node
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

export class NodeContext {
  constructor () {
    this.hasDelta = false
    this.maxDelta = 0
  }
}
