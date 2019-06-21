import {nodeMarked, nodeHiddenDescendantMarked} from './Node'

export class NodeHighlightClass {
  constructor (name, prefix) {
    this.name = name || null
    this.prefix = prefix || null
    this._index = null
  }
  setName (name) {
    this.name = name
    this._index = null
  }
  getClass (mask) {
    return (this._index || this.generateIndex())[mask]
  }
  getIndex () {
    return this._index || this.generateIndex()
  }
  generateIndex () {
    const name = this.prefix ? this.prefix + this.name : this.name
    return (this._index = Array.from({length: 16}, (v, k) => name + k))
  }
}

// There are two types of hightlight currently:
// 1. Explicit list of nodes to be highlighted. In this case, for highlighted hidden nodes need to walk tree up to find
//    closest visible ancestor. Good for hightlights with small node count or when number of different hightlights is too large
//    to have dedicated marks for each of them or node set changes too often to reuse same mark field, because computing marks
//    and associated node list is same or greater computational effort as traversing tree once to find closest visible ancestors.
// 2. Using node tree markings. This requires to update the entire tree (or its significant part) when marks change, traversing
//    it from the top. When node visibility changes, list of actually hightlighted nodes must be created. Good for long lived
//    hightlights where marks are updated less often and can be reused for some time.
// This class only supports first hightlight type.
export class NodeHighlight {
  constructor (highlightClass) {
    this.highlightClass = highlightClass
    // This highlight can be un-applied and re-applied (see `toggle` method) as long as node tree is in the same revision.
    // Also revision is used to tell what nodes are visible.
    this.revision = null
    this.classIndex = null
    this.marks = null
    this.enabled = false
  }
  update (nodes, revision, enable) {
    if (this.revision === revision && this.enabled) {
      this.apply(false)
    }
    const empty = !nodes || !nodes.length
    this.revision = revision
    this.classIndex = empty ? null : this.highlightClass.getIndex()
    this.marks = empty ? null : NodeHighlight.nodeMarks(nodes, revision)
    this.enabled = null === enable ? this.enabled : !!enable
    if (this.enabled) {
      this.apply(true)
    }
  }
  reset () {
    this.revision = null
    this.classIndex = null
    this.marks = null
    this.enabled = false
  }
  toggle (revision, enable) {
    const enabled = !!enable
    if (this.enabled !== enabled) {
      if (this.revision === revision) {
        this.apply(enabled)
      }
      this.enabled = enabled
    }
  }
  // This is a low-level method that doesn't perform `revision` and `enabled` checks, assuming that
  // caller did the homework. It also will not update `enabled` state.
  apply (enable) {
    if (this.marks) {
      const classIndex = this.classIndex
      this.marks.forEach(function (mark, node, map) {
        node.element.classList.toggle(classIndex[mark], enable)
      })
    }
  }
  static nodeMarks (nodes, revision) {
    const marks = new Map()
    for (let i = nodes.length; 0 < i--;) {
      let node = nodes[i]
      if (revision === node.rev) {
        marks.set(node, marks.get(node) | nodeMarked)
      } else {
        // This will look for a closest visible parent. It would be nice to cache result of this search,
        // but I didn't come up with a efficient mechanism to invalidate such cache.
        while ((node = node.parent)) {
          if (revision === node.rev) {
            const value = marks.get(node)
            if (!(value & nodeHiddenDescendantMarked)) {
              marks.set(node, value | nodeHiddenDescendantMarked)
            }
            break
          }
        }
      }
    }
    return marks
  }
}
