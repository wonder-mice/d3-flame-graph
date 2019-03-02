/*

= Flame graph update stages =

General idea is that downstream stages should be cheaper / faster then previous stages, because they will be executed much more often.
Thus earlier stages should try to preprocess data to speed up downstream stages. Any piece of work must be placed as high upstream
as possible. Earlier stages invalidate following stages, so after each stage run, all following stages must run too.

It looks interesting to have `revision` not only for rendering stage, but share it with other stages too. Each time modification is made
that requires stage re-run, stage's revision can be incremented. Then, `update` function just needs to find lowest stage with revision
that is greater than what is being displayed / renedered and re-run this stage and all stages above it. Some customizable changes can have
an optional parameter that describe what stages they impact. E.g. change in delta color doesn't require layout, but change in item valuation
does.

== Node creation ==

Node is a visual unit that can be rendered. Nodes can be created all at once or lazily (e.g. as parts of tree are expanded).
If item (cost) aggregation need to happen, it should be performed on this stage.

== Node value update ==

Node children sorting must be done on this stage. Currently it's done during layout, which is not optimal.

== Node layout ==

Invalidates:
- Highlight, because it changes node visibility.

== Node rendering ==

Invalidates:
- Highlight, because elements are fully reconfigured (properties are assigned, not adjusted).

== Element visual adjustments ==

Things that can happen:
- Highlight changes.

*/

function hsv2rbg (h, s, v) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r, g, b
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')'
}

export function deltaColor (delta, maxDelta) {
  const s = delta && maxDelta ? Math.abs(delta / maxDelta) : 0
  // Use of HSL colorspace would be more appropriate, since its saturation better models
  // kind of effect we are after. However, HSV colorspace is computationaly simpler and
  // we can emulate desired effect by adjusting brightness (value) based on `s`.
  // return hsv2rbg(0 <= delta ? 0 : 0.67, s, 0.7 + 0.3 * s)
  // FIXME: Looks like CSS knows has built-in support for HSL colors, need to try it!
  return hsv2rbg(0 <= delta ? 0 : 0.28, s, 0.8 + 0.2 * s)
}

export function nameColor (name) {
  // Name based color supposed to give similar colors for similar names.
  let tone = 0
  if (name) {
    const maxLength = 6
    const n = maxLength < name.length ? maxLength : name.length
    const mod = 10
    let range = 0
    for (let i = 0, weight = 1; i < n; ++i, weight *= 0.7) {
      tone += weight * (name.charCodeAt(i) % mod)
      range += weight * (mod - 1)
    }
    if (range > 0) {
      tone /= range
    }
  }
  const r = 200 + Math.round(55 * tone)
  const g = Math.round(230 * (1 - tone))
  const b = Math.round(55 * (1 - tone))
  return 'rgb(' + r + ',' + g + ',' + b + ')'
}

export class Metrics {
  static enable () {
    Metrics.stack = []
  }
  static begin (name) {
    const stack = Metrics.stack
    if (stack) {
      const p = stack.length
      stack.push(name)
      const alias = stack[p] = stack.join('/')
      console.time(alias)
      console.profile(alias)
    }
  }
  static end () {
    const stack = Metrics.stack
    if (stack) {
      const alias = stack.pop()
      console.profileEnd(alias)
      console.timeEnd(alias)
    }
  }
}

// Keeps track of current callstack frames and facilitates recursion detection.
// Initial `level` is 0 (callstack is empty). Frames are usually strings that
// contain both function and module name (e.g. "fread @ libc")
export class Callstack {
  constructor () {
    this.stack = []
    this.frameCounts = new Map()
    this.depth = 0
  }
  push (frame) {
    const frameCounts = this.frameCounts
    const record = frameCounts.get(frame)
    if (record) {
      this.stack[this.depth++] = record
      return 0 < record.n++
    }
    frameCounts.set(frame, (this.stack[this.depth++] = {n: 1}))
    return false
  }
  pop (level) {
    let depth = this.depth
    if (level < depth) {
      const stack = this.stack
      do { --stack[--depth].n } while (level < depth)
      this.depth = depth
    }
  }
  recursive (frame) {
    const record = this.frameCounts.get(frame)
    return record && 0 < record.n
  }
}

export class ItemTraits {
  constructor () {
    this.selfValue = false
    this.hasDelta = false
    this.getRoot = ItemTraits.defaultGetRoot
    this.getChildren = ItemTraits.defaultGetChildren
    this.getName = ItemTraits.defaultGetName
    this.getValue = ItemTraits.defaultGetValue
    this.getDelta = ItemTraits.defaultGetDelta
    this.createAggregate = ItemTraits.defaultCreateAggregate
    this.addAggregateItem = ItemTraits.defaultAddAggregateItem
    this.getAggregateValue = ItemTraits.defaultGetAggregateValue
    this.getAggregateDelta = ItemTraits.defaultGetAggregateDelta
    this.collectSiblings = ItemTraits.defaultCollectSiblings
    this.preorderDFS = ItemTraits.defaultPreorderDFS
  }
  static defaultGetRoot (datum) { return datum }
  static defaultGetChildren (item) { return item.c || item.children }
  static defaultGetName (item) { return item.n || item.name }
  static defaultGetValue (item) { return item.v || item.value }
  static defaultGetDelta (item) { return item.d || item.delta }
  static defaultCreateAggregate (item) { return { items: [item] } }
  static defaultAddAggregateItem (aggregate, item) { aggregate.items.push(item) }
  static defaultGetAggregateValue (aggregate) { ItemTraits.defaultGetAggregateTotal(aggregate, this.getValue) }
  static defaultGetAggregateDelta (aggregate) { ItemTraits.defaultGetAggregateTotal(aggregate, this.getDelta) }
  static defaultGetAggregateTotal (aggregate, getter) {
    let total = null
    const items = aggregate.items
    for (let i = items.length; i--;) {
      const value = getter.call(this, items[i])
      if (null !== value) { total += value }
    }
    return total
  }
  static defaultCollectSiblings (parents) {
    const result = []
    for (let n = parents.length; n--;) {
      const children = this.getChildren(parents[n])
      if (children) {
        for (let i = children.length; i--;) {
          result.push(children[i])
        }
      }
    }
    return result
  }
  static defaultPreorderDFS (queue, callback) {
    let k = queue.length
    const levels = Array(k).fill(0)
    while (k--) {
      const item = queue[k]
      const level = levels[k]
      const children = this.getChildren(item)
      const childrenCount = children ? children.length : 0
      callback(item, level, childrenCount)
      if (childrenCount) {
        const childrenLevel = level + 1
        let i = childrenCount - 1
        do {
          queue[k] = children[i]
          levels[k] = childrenLevel
          ++k
        } while (i--)
      }
    }
  }
}

// `Node.mark` flags:
export const nodeMarked = 0b0001 // node is marked
export const nodeDescendantMarked = 0b0010 // node has a descendant that is marked
export const nodeAncestorMarked = 0b0100 // node has an ancestor that is marked
export const nodeHiddenDescendantMarked = 0b1000 // node has marked descendants that are not visible (e.g. too small)

// `Node.bits` flags:
export const nodeFocused = 0b11 // node is focused
export const nodeDescendantFocused = 0b10 // node is on the path from focused node to the root

export class Node {
  constructor (parent, item, name) {
    this.parent = parent
    this.item = item
    this.name = name
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
  }
}

export class NodeContext {
  constructor () {
    this.hasDelta = false
    this.maxDelta = 0
  }
}

export class NodeIndexEntry {
  constructor (nodes, aggregate) {
    this.nodes = nodes
    this.aggregate = aggregate
  }
}

function nodeIndexAggregate (index, key) {
  let entry
  return index && (entry = index.get(key)) && entry.aggregate
}

function createNodeNameIndex (rootNodes, traits) {
  const aggregateRecursive = traits.selfValue
  const callstack = aggregateRecursive ? null : new Callstack()
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
    const aggregate = callstack ? !(callstack.pop(level), childrenCount ? callstack.push(name) : callstack.recursive(name)) : true
    let entry = index.get(name)
    if (entry) {
      entry.nodes.push(node)
      if (aggregate) {
        traits.addAggregateItem(entry.aggregate, node.item)
      }
    } else {
      entry = new NodeIndexEntry([node], traits.createAggregate(node.item))
      index.set(name, entry)
    }
  }
  return index
}

export class NodeSelection {
  constructor () {
    this.nodes = null
    this.index = null
  }
  update (nodes, traits) {
    if (nodes && nodes.length) {
      this.nodes = nodes
      this.index = createNodeNameIndex(nodes, traits)
    } else {
      this.reset()
    }
  }
  reset () {
    this.nodes = null
    this.index = null
  }
}

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

export function markingPredicate (term) {
  if (!term) {
    return null
  }
  if (typeof term === 'function') {
    return term
  }
  term = String(term)
  if (!term.length) {
    return null
  } else if (term.startsWith('#')) {
    const str = term.slice(1)
    return function (node) { return node.name === str }
  } else if (1 < term.length && ('"' === term[0] || '\'' === term[0]) && term[0] === term[term.length - 1]) {
    const str = term.slice(1, -1)
    return function (node) { return node.name.includes(str) }
  }
  const re = new RegExp(term)
  return function (node) { return re.test(node.name) }
}

export function markNodes (rootNodes, predicate) {
  let nodes, i, node, children, ancestor
  const queue = [rootNodes]
  const marked = []
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      ancestor = node.parent
      if (predicate && predicate(node)) {
        marked.push(node)
        node.mark = ancestor && (ancestor.mark & 0b0101) ? 0b0101 : 0b0001
        for (; ancestor && !(ancestor.mark & 0b0010); ancestor = ancestor.parent) {
          ancestor.mark |= 0b0010
        }
      } else {
        node.mark = ancestor && (ancestor.mark & 0b0101) ? 0b0100 : 0b0000
      }
      children = node.children
      if (children && children.length) {
        queue.push(children)
      }
    }
  }
  return marked
}

export function selectNodes (rootNodes, predicate) {
  const selected = []
  let nodes, i, node, children
  const queue = [rootNodes]
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      if (predicate(node)) {
        selected.push(node)
      }
      children = node.children
      if (children && children.length) {
        queue.push(children)
      }
    }
  }
  return selected
}

export function markedNodes (rootNodes) {
  const marked = []
  let nodes, i, node, mark
  const queue = [rootNodes]
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      mark = node.mark
      if (mark & 0b0001) {
        marked.push(node)
      }
      if (mark & 0b0010) {
        queue.push(node.children)
      }
    }
  }
  return marked
}

export function markedNodesAggregate (rootNodes, traits) {
  let nodes, i, node, mark
  let aggregate = null
  const queue = [rootNodes]
  const aggregateRecursive = traits.selfValue
  const traitsCreateAggregate = traits.createAggregate
  const traitsAddAggregateItem = traits.addAggregateItem
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      mark = node.mark
      if (mark & nodeMarked) {
        if (aggregate) {
          traitsAddAggregateItem.call(traits, aggregate, node.item)
        } else {
          aggregate = traitsCreateAggregate.call(traits, node.item)
        }
        if (!aggregateRecursive) {
          continue
        }
      }
      if (mark & nodeDescendantMarked) {
        queue.push(node.children)
      }
    }
  }
  return aggregate
}

export function flamegraph () {
  const nodeFocusHighlightClass = new NodeHighlightClass('fg-fc', ' ')
  const nodeMarkHighlightClass = new NodeHighlightClass('fg-mk', ' ')
  const nodeHoverHighlightClass = new NodeHighlightClass('fg-hv')
  const nodeSelectionHighlightClass = new NodeHighlightClass('fg-sl')
  const nodeHoverHighlight = new NodeHighlight(nodeHoverHighlightClass)
  const nodeSelectionHighlight = new NodeHighlight(nodeSelectionHighlightClass)
  const nodeSelection = new NodeSelection()

  let hoveredNode = null
  let rootNodeIndex = null

  let itemTraits = new ItemTraits()
  let selectionItems = null

  let nodeWidthSmall = 35
  let nodeClassBase = 'node'
  let nodeClassBaseSmall = 'node-sm'

  function getNodeColor (node, context) {
    return context.hasDelta && context.maxDelta ? deltaColor(node.delta, context.maxDelta) : nameColor(node.name)
  }

  function getNodeTitle (node, context) {
    let title = node.name + ', total: ' + node.toal + ', self: ' + node.self
    if (context.hasDelta) {
      title += ', Δ: ' + node.delta
    }
    return title
  }

  function setNodeContent (node, context) {
    const small = node.width <= nodeWidthSmall
    let classes = small ? nodeClassBaseSmall : nodeClassBase
    const focus = node.bits & 0b11
    if (focus) { classes += nodeFocusHighlightClass.getClass(focus) }
    const mark = node.mark & 0b1001
    if (mark) { classes += nodeMarkHighlightClass.getClass(mark) }
    this.className = classes
    this.textContent = small ? '' : node.name
  }

  function setNodeTip (node, context) {
    this.innerText = getNodeTitle(node, context)
  }

  function setSearchContent (marked, aggregated, markedFocus, aggregatedFocus) {
    const traits = itemTraits
    let html = 'Total: ' + marked.length + ' items'
    if (aggregated) {
      html += ', value=' + traits.getAggregateValue(aggregated)
      if (traits.hasDelta) {
        html += ', delta=' + traits.getAggregateDelta(aggregated)
      }
    }
    html += '; Focus: ' + markedFocus.length + ' items'
    if (aggregatedFocus) {
      html += ', value=' + traits.getAggregateValue(aggregatedFocus)
      if (traits.hasDelta) {
        html += ', delta=' + traits.getAggregateDelta(aggregatedFocus)
      }
    }
    this.innerHTML = html
  }

  // Aggregates descendants of `rootItems` (but not `rootItems` themselves) with the
  // same name, regardless of their place in items hierarchy.
  function aggregatedNodesByFlatteningItems (parentNode, rootItems) {
    const nodes = new Map()
    const traits = itemTraits
    const aggregateRecursive = traits.selfValue
    const callstack = new Callstack()
    traits.preorderDFS(traits.collectSiblings(rootItems), function (item, level, hasChildren) {
      const name = traits.getName(item)
      callstack.pop(level)
      const recursive = hasChildren ? callstack.push(name) : callstack.recursive(name)
      if (aggregateRecursive || !recursive) {
        let node = nodes.get(name)
        if (!node) {
          node = new Node(parentNode, traits.createAggregate(item), name)
          node.roots = [item]
          node.dir = true
          nodes.set(name, node)
        } else {
          traits.addAggregateItem(node.item, item)
          if (!recursive) {
            node.roots.push(item)
          }
        }
      }
    })
    return nodes.size ? Array.from(nodes.values()) : null
  }

  // Performs pre-layout stage by updating `node.total`, `node.self` and `node.delta`
  // fields using ItemTraits `getValue()` and `getDelta()` methods. Updated fields don't
  // have any intrinsic semantic meaning other than how layout interprets them. Nodes
  // will be laid out in space allowed by `parent.total - parent.self` proportionally
  // to their `total` value.
  // Item value (returned from `getValue()`) can be negative (e.g. when value
  // represents some kind of delta, though not necessary the same as `getDelta()`).
  // Keep in mind, that following is NOT neccessary true:
  //   parent.total == parent.self + sum([child.total for child in parent.children])
  //   node.total >= node.self
  // Layout is free to interpret such cases as it sees fit (pun intended).
  function updateItemViewNodeValues (rootNodes) {
    if (!rootNodes || !rootNodes.length) {
      return
    }
    let i, node, children, nodes, nodesTotal, k, parent
    const traits = itemTraits
    const hasTotal = !traits.selfValue
    const traitsGetValue = traits.getValue
    const traitsGetDelta = traits.hasDelta ? traits.getDelta : null
    const queue = []
    const siblingsList = []
    // These bootstrap loop allows to use more efficient algorithm in main processing
    // loop (that would require to check for `node.parent` to be not null, which also
    // is not a reliable indicator in case of mixed-view node hierarchies we plan for).
    for (i = rootNodes.length; i--;) {
      node = rootNodes[i]
      node.total = node.self = traitsGetValue.call(traits, node.item)
      if (traitsGetDelta) {
        node.delta = traitsGetDelta.call(traits, node.item)
      }
      children = node.children
      if (children && children.length) {
        queue.push(children)
        siblingsList.push(children)
      }
    }
    // If `hasTotal`, update `node.total` and compute `node.self` values. Otherwise,
    // update `node.self` and populate `siblingsList` that will be processed later.
    while ((nodes = queue.pop())) {
      nodesTotal = 0
      i = nodes.length
      while (i--) {
        node = nodes[i]
        nodesTotal += (node.total = node.self = traitsGetValue.call(traits, node.item))
        if (traitsGetDelta) {
          node.delta = traitsGetDelta.call(traits, node.item)
        }
        children = node.children
        if (children && children.length) {
          queue.push(children)
          siblingsList.push(children)
        }
      }
      if (hasTotal) {
        parent = node.parent
        parent.self = parent.self - nodesTotal
      }
    }
    // If neccessary, traverse the tree in reverse order and compute `total` fields.
    if (!hasTotal) {
      for (i = siblingsList.length; i--;) {
        nodesTotal = 0
        nodes = siblingsList[i]
        for (k = nodes.length; k--;) {
          nodesTotal += nodes[k].total
        }
        parent = nodes[0].parent
        parent.total = parent.total + nodesTotal
      }
    }
  }

  // Same as `updateItemViewNodeValues()`, but for flatten view.
  function updateFlattenViewNodeValues (rootNodes) {
    let nodes, i, node, children
    const traits = itemTraits
    const traitsGetAggregateValue = traits.getAggregateValue
    const traitsGetAggregateDelta = traits.hasDelta ? traits.getAggregateDelta : null
    const queue = [rootNodes]
    while ((nodes = queue.pop())) {
      for (i = nodes.length; i--;) {
        node = nodes[i]
        node.self = 0
        node.total = Math.abs(traitsGetAggregateValue.call(traits, node.item))
        if (traitsGetAggregateDelta) {
          node.delta = traitsGetAggregateDelta.call(traits, node.item)
        }
        children = node.children
        if (children && children.length) {
          queue.push(children)
        }
      }
    }
  }

  function expandFlattenViewNode (node) {
    let expandedNodes = null
    if (undefined === node.children) {
      expandedNodes = node.children = aggregatedNodesByFlatteningItems(node, node.roots)
    }
    return expandedNodes
  }

  function resetView () {
    hoveredNode = null
    rootNodeIndex = null
    nodeHoverHighlight.reset()
    nodeSelectionHighlight.reset()
    nodeSelection.reset()
    if (rootNode) {
      hierarchyView.recycle([rootNode])
    }
  }

  function createItemViewNode (datum) {
    const rootIndex = new Map()
    const selectedItems = selectionItems && selectionItems.size ? selectionItems : null
    const selectedNodes = selectedItems ? [] : null
    const traits = itemTraits
    const nodes = []
    const parents = [null]
    const aggregateRecursive = traits.selfValue
    const callstack = aggregateRecursive ? null : new Callstack()
    traits.preorderDFS([traits.getRoot(datum)], function (item, level, hasChildren) {
      const name = traits.getName(item)
      const parent = parents[level]
      const node = new Node(parent, item, name)
      if (hasChildren) {
        node.children = []
        parents[level + 1] = node
      } else {
        node.children = null
      }
      if (parent) {
        parent.children.push(node)
      }
      nodes.push(node)
      const aggregate = callstack ? !(callstack.pop(level), hasChildren ? callstack.push(name) : callstack.recursive(name)) : true
      if (aggregate) {
        let indexEntry = rootIndex.get(name)
        if (indexEntry) {
          indexEntry.nodes.push(node)
          traits.addAggregateItem(indexEntry.aggregate, item)
        } else {
          indexEntry = new NodeIndexEntry([node], traits.createAggregate(item))
          rootIndex.set(name, indexEntry)
        }
      }
      if (selectedItems && selectedItems.has(item)) {
        selectedNodes.push(node)
      }
    })
    rootNodeIndex = rootIndex
    nodeSelection.update(selectedNodes, traits)
    return nodes[0]
  }

  function createFlattenViewNode (datum) {
    const traits = itemTraits
    const rootItem = traits.getRoot(datum)
    const rootNode = new Node(null, traits.createAggregate(rootItem), traits.getName(rootItem))
    rootNode.roots = [rootItem]
    rootNode.children = aggregatedNodesByFlatteningItems(rootNode, rootNode.roots)
    rootNode.dir = true
    return rootNode
  }

  // Default node sorting function orders by `node.total` with larger nodes on the left.
  function nodesTotalOrder (nodeA, nodeB) {
    return nodeA.total - nodeB.total
  }

  class HierarchyLayoutResult {
    constructor () {
      this.nodes = null
      this.height = 0
      this.rowHeight = 0
      this.context = new NodeContext()
      this.revision = 0
    }
  }

  class HierarchyLayout {
    constructor () {
      this.totalWidth = 0
      this.nodeWidthMin = 0
      this.rowHeight = 18
      this.hasDelta = false
      this.order = nodesTotalOrder
    }
    layout (rootNode, focusNode, revision) {
      let node, i, children, childrenY, n, directory
      let subtotal, abstotal, ratio, child, childX, childWidth, delta
      let totalHeight = 0
      const nodes = []
      const totalWidth = this.totalWidth
      const nodeWidthMin = this.nodeWidthMin
      const rowHeight = this.rowHeight
      const hasDelta = this.hasDelta
      const order = this.order
      // Layout stem nodes.
      const stemNodes = []
      node = focusNode || rootNode
      do { stemNodes.push(node) } while ((node = node.parent))
      for (i = stemNodes.length; i--;) {
        node = stemNodes[i]
        node.width = totalWidth
        node.x = 0
        node.y = totalHeight
        node.mark &= 0b0111
        node.bits = (node.bits & 0b11111100) | (0 === i ? 0b11 : 0b10)
        node.rev = revision
        nodes.push(node)
        totalHeight += rowHeight
      }
      let maxDelta = hasDelta ? Math.abs(node.delta) : 0
      // Layout branches.
      const queue = [focusNode]
      while ((node = queue.pop())) {
        children = node.children
        if (!children || !(n = children.length)) {
          continue
        }
        if (order) {
          children.sort(order)
        }
        childrenY = node.y + rowHeight
        directory = node.dir
        if (directory) {
          for (subtotal = 0, i = n; i--;) {
            subtotal = subtotal < (abstotal = Math.abs(children[i].total)) ? abstotal : subtotal
          }
        } else {
          for (subtotal = Math.abs(node.self), i = n; i--;) {
            subtotal += Math.abs(children[i].total)
          }
        }
        ratio = 0 < subtotal ? node.width / subtotal : 0
        for (childX = node.x, i = n; i--;) {
          child = children[i]
          childWidth = Math.floor(Math.abs(child.total) * ratio)
          if (childWidth < nodeWidthMin) {
            if (child.mark & 0b0011) {
              node.mark |= 0b1000
            }
            continue
          }
          child.width = childWidth
          child.x = childX
          child.y = childrenY
          if (directory) {
            childrenY += rowHeight
          } else {
            childX += childWidth
            queue.push(child)
          }
          if (hasDelta) {
            delta = Math.abs(child.delta)
            if (maxDelta < delta) {
              maxDelta = delta
            }
          }
          child.mark &= 0b0111
          child.bits &= 0b11111100
          child.rev = revision
          nodes.push(child)
        }
        if (totalHeight < childrenY) {
          totalHeight = childrenY
        }
      }
      const result = new HierarchyLayoutResult()
      result.nodes = nodes
      result.height = totalHeight
      result.rowHeight = rowHeight
      result.context.hasDelta = hasDelta
      result.context.maxDelta = maxDelta
      result.revision = revision
      return result
    }
  }

  class HierarchyView {
    constructor (container) {
      this.container = container
      this.nodeColor = getNodeColor
      this.nodeTitle = null
      this.nodeContent = setNodeContent
      this.inverted = false
      this.context = null
      this.nodes = null
      this.revision = null
      this.unusedElements = []
    }
    render (layout) {
      let nodes, i, node, element
      const revision = layout.revision
      const unusedElements = this.unusedElements
      if ((nodes = this.nodes) && revision !== this.revision) {
        // Hide currently visible elements that don't have their node in `layout`.
        for (i = nodes.length; i--;) {
          node = nodes[i]
          if (node.rev !== revision) {
            node.element.style.display = 'none'
          }
        }
      }
      const container = this.container
      const nodeColor = this.nodeColor
      const nodeTitle = this.nodeTitle
      const nodeContent = this.nodeContent
      const fixY = this.inverted ? layout.height - layout.rowHeight : 0
      const context = this.context = layout.context
      this.nodes = nodes = layout.nodes
      this.revision = revision
      for (i = nodes.length; i--;) {
        element = (node = nodes[i]).element
        if (!element) {
          if (!(element = unusedElements.pop())) {
            element = document.createElement('div')
            element.addEventListener('click', nodeClick)
            element.addEventListener('mouseenter', nodeMouseEnter)
            element.addEventListener('mouseleave', nodeMouseLeave)
            element.addEventListener('mousemove', nodeMouseMove)
            container.appendChild(element)
          }
          node.element = element
          element.__node__ = node
        }
        element.style.width = node.width + 'px'
        element.style.left = node.x + 'px'
        element.style.top = Math.abs(node.y - fixY) + 'px'
        element.style.backgroundColor = nodeColor(node, context)
        element.title = nodeTitle ? nodeTitle(node, context) : ''
        nodeContent.call(element, node, context)
        element.style.display = 'block'
      }
    }
    recycle (roots) {
      let nodes, i, node, element, children
      const queue = [roots]
      while ((nodes = queue.pop())) {
        for (i = nodes.length; i--;) {
          node = nodes[i]
          if ((element = node.element)) {
            // No need to reset `node.element` to `null`, since one more extra reference on `element` is not an issue.
            // That's because elements are recycled and never released anyway. However we don't want references on nodes,
            // since node structures can be pretty big.
            element.__node__ = null
            this.unusedElements.push(element)
          }
          if ((children = node.children)) {
            queue.push(children)
          }
        }
      }
    }
  }

  class TooltipView {
    constructor (container) {
      this.shown = false
      this.nodeTip = null
      this.element = document.createElement('div')
      this.element.className = 'tip'
      this.tipDx = 0
      this.tipDy = 0
      container.appendChild(this.element)
      // Safari is very annoying with its default tooltips for text with ellipsis.
      // The only way to disable it is to add dummy block element inside.
      this.deterringElement = document.createElement('div')
    }
    show (event, element, node, context) {
      const elementRect = element.getBoundingClientRect()
      const insideRect = element.parentElement.getBoundingClientRect()
      this.nodeTip.call(this.element, node, context)
      // Need to reset `display` here, so `getBoundingClientRect()` will actually layout the tip element.
      this.element.visibility = 'hidden'
      this.element.style.display = 'block'
      const tipRect = this.element.getBoundingClientRect()
      const clientWidth = document.documentElement.clientWidth
      const clientHeight = document.documentElement.clientHeight
      const px = event.clientX
      const py = event.clientY
      const pd = elementRect.height
      let x = px + pd
      let y = py + pd
      if (clientWidth < x + tipRect.width) {
        x = clientWidth - tipRect.width
      }
      if (clientHeight < y + tipRect.height) {
        y = py - pd - tipRect.height
      }
      x -= insideRect.left
      y -= insideRect.top
      this.tipDx = px - x
      this.tipDy = py - y
      element.appendChild(this.deterringElement)
      this.element.style.transform = 'translate(' + x + 'px,' + y + 'px)'
      this.element.visibility = 'visible'
      this.shown = true
    }
    hide () {
      if (this.shown) {
        const deterringParent = this.deterringElement.parentElement
        if (deterringParent) {
          deterringParent.removeChild(this.deterringElement)
        }
        this.element.style.display = 'none'
        this.shown = false
      }
    }
    update (event) {
      if (this.shown) {
        const x = event.clientX - this.tipDx
        const y = event.clientY - this.tipDy
        this.element.style.transform = 'translate(' + x + 'px,' + y + 'px)'
      }
    }
  }

  class SearchController {
    constructor (element) {
      this.element = element
      this.searchContent = setSearchContent
      this.predicate = null
      this.marked = null
    }
    search (term) {
      this.predicate = markingPredicate(term)
    }
    updateSearch (rootNode) {
      if (this.predicate || this.marked) {
        const marked = markNodes([rootNode], this.predicate)
        this.marked = this.predicate ? marked : null
      }
    }
    updateView (focusNode) {
      if (this.marked) {
        const markedFocus = markedNodes([focusNode])
        const aggregated = markedNodesAggregate([rootNode], itemTraits)
        const aggregatedFocus = markedNodesAggregate([focusNode], itemTraits)
        this.searchContent.call(this.element, this.marked, aggregated, markedFocus, aggregatedFocus)
        this.element.style.display = 'block'
      } else {
        this.element.style.display = 'none'
      }
    }
  }

  const containerElement = document.createElement('div')
  const searchElement = document.createElement('div')
  const nodesSpaceElement = document.createElement('div')
  const nodesElement = document.createElement('div')
  containerElement.className = 'flamegraph'
  searchElement.className = 'search'
  nodesSpaceElement.className = 'nodes-space'
  nodesElement.className = 'nodes'
  nodesSpaceElement.appendChild(nodesElement)
  containerElement.appendChild(searchElement)
  containerElement.appendChild(nodesSpaceElement)

  const hierarchyLayout = new HierarchyLayout()
  const searchController = new SearchController(searchElement)
  const hierarchyView = new HierarchyView(nodesElement)
  const tooltipView = new TooltipView(nodesSpaceElement)

  let rootNode = null
  let focusNode = null
  let updateNodeValues = null
  let expandNode = null
  let chartWidth = null
  let chartHeight = null
  let clickHandler = null
  let viewRevision = 0

  function updateHoverHighlight () {
    let nodes = null
    if (rootNodeIndex && hoveredNode && hoveredNode.rev === viewRevision) {
      const indexEntry = rootNodeIndex.get(hoveredNode.name)
      if (indexEntry) {
        nodes = indexEntry.nodes
      }
    }
    nodeHoverHighlight.update(nodes, viewRevision, true)
  }

  function updateView () {
    const nodesRect = nodesElement.getBoundingClientRect()
    hierarchyLayout.totalWidth = nodesRect.width
    hierarchyLayout.hasDelta = itemTraits.hasDelta
    const layout = hierarchyLayout.layout(rootNode, focusNode, ++viewRevision)
    nodesElement.style.height = layout.height + 'px'
    hierarchyView.render(layout)
    updateHoverHighlight()
    nodeSelectionHighlight.update(nodeSelection.nodes, viewRevision, true)
    // FIXME: Looks like `searchController.updateView` does more then minimally required.
    searchController.updateView(focusNode)
  }

  const externalState = {
    shiftKey: false,
    handleEvent (event) {
      switch (event.type) {
        case 'keydown':
        case 'keyup':
          this.shiftKey = event.shiftKey
          break
      }
    },
    listen () {
      document.addEventListener('keydown', this, false)
      document.addEventListener('keyup', this, false)
    },
    textSelected () {
      return window.getSelection().type === 'Range'
    }
  }
  externalState.listen()

  function zoom (node) {
    focusNode = node
    if (expandNode) {
      const expandedNodes = expandNode(node)
      if (expandedNodes) {
        updateNodeValues(expandedNodes)
      }
      searchController.updateSearch(rootNode)
    }
    updateView()
  }

  function nodeClick () {
    if (!externalState.textSelected()) {
      tooltipView.hide()
      const node = this.__node__
      zoom(node)
      if (clickHandler) {
        clickHandler.call(this, node)
      }
    }
  }

  function nodeMouseEnter (event) {
    if (!externalState.shiftKey) {
      const node = hoveredNode = this.__node__
      if (tooltipView.nodeTip) {
        tooltipView.show(event, this, node, hierarchyView.context)
      }
      updateHoverHighlight()
    }
  }

  function nodeMouseLeave (event) {
    if (!externalState.shiftKey) {
      hoveredNode = null
      tooltipView.hide()
      updateHoverHighlight()
    }
  }

  function nodeMouseMove (event) {
    if (!externalState.shiftKey && tooltipView.shown) {
      tooltipView.update(event)
    }
  }

  function optionalGetter (getter, on, off) {
    return typeof getter === 'function' ? getter : (getter ? on : off)
  }

  function chart (element) {
    nodesElement.style.width = chartWidth ? chartWidth + 'px' : '100%'
    nodesElement.style.height = chartHeight ? chartHeight + 'px' : '0px'
    element.appendChild(containerElement)
    return chart
  }

  chart.itemTraits = function (_) {
    if (!arguments.length) { return itemTraits }
    itemTraits = _
    return chart
  }

  chart.getNodeColor = function (_) {
    if (!arguments.length) { return hierarchyView.nodeColor }
    hierarchyView.nodeColor = _ || getNodeColor
    return chart
  }

  chart.getNodeTitle = function (_) {
    if (!arguments.length) { return hierarchyView.nodeTitle }
    hierarchyView.nodeTitle = optionalGetter(_, getNodeTitle, null)
    return chart
  }

  chart.setNodeContent = function (_) {
    if (!arguments.length) { return hierarchyView.nodeContent }
    hierarchyView.nodeContent = _ || setNodeContent
    return chart
  }

  chart.setNodeTip = function (_) {
    if (!arguments.length) { return tooltipView.nodeTip }
    tooltipView.nodeTip = optionalGetter(_, setNodeTip, null)
    return chart
  }

  chart.setSearchContent = function (_) {
    if (!arguments.length) { return searchController.searchContent }
    searchController.searchContent = optionalGetter(_, setSearchContent, null)
    return chart
  }

  chart.cellHeight = function (_) {
    if (!arguments.length) { return hierarchyLayout.rowHeight }
    hierarchyLayout.rowHeight = _
    return chart
  }

  chart.cellWidthMin = function (_) {
    if (!arguments.length) { return hierarchyLayout.nodeWidthMin }
    hierarchyLayout.nodeWidthMin = _
    return chart
  }

  chart.sort = function (_) {
    if (!arguments.length) { return hierarchyLayout.order }
    hierarchyLayout.order = optionalGetter(_, nodesTotalOrder, null)
    return chart
  }

  chart.inverted = function (_) {
    if (!arguments.length) { return hierarchyView.inverted }
    hierarchyView.inverted = _
    return chart
  }

  chart.height = function (_) {
    if (!arguments.length) { return chartHeight }
    chartHeight = _
    return chart
  }

  chart.width = function (_) {
    if (!arguments.length) { return chartWidth }
    chartWidth = _
    return chart
  }

  chart.createItemsView = function (datum) {
    resetView()
    focusNode = rootNode = createItemViewNode(datum)
    updateNodeValues = updateItemViewNodeValues
    expandNode = null
    // Code below is identical for all current view types
    updateNodeValues([rootNode])
    searchController.updateSearch(rootNode)
    updateView()
    return chart
  }

  chart.createFlattenView = function (datum) {
    resetView()
    focusNode = rootNode = createFlattenViewNode(datum)
    updateNodeValues = updateFlattenViewNodeValues
    expandNode = expandFlattenViewNode
    // Code below is identical for all current view types
    updateNodeValues([rootNode])
    searchController.updateSearch(rootNode)
    updateView()
    return chart
  }

  chart.updateValues = function () {
    updateNodeValues([rootNode])
    updateView()
    return chart
  }

  chart.rootNode = function () {
    return rootNode
  }

  chart.focusNode = function () {
    return focusNode
  }

  chart.expandNode = function (node) {
    if (expandNode) {
      const expandedNodes = expandNode(node)
      if (expandedNodes) {
        updateNodeValues(expandedNodes)
      }
    }
  }

  chart.search = function (term) {
    searchController.search(term)
    searchController.updateSearch(rootNode)
    updateView()
  }

  chart.clear = function () {
    searchController.search(null)
    searchController.updateSearch(rootNode)
    updateView()
  }

  chart.onClick = function (_) {
    if (!arguments.length) { return clickHandler }
    clickHandler = _
    return chart
  }

  chart.zoomTo = function (node) {
    zoom(node)
  }

  chart.resetZoom = function () {
    zoom(rootNode)
  }

  chart.rootNameAggregate = function (name) {
    return nodeIndexAggregate(rootNodeIndex, name)
  }

  chart.selectedNameAggregate = function (name) {
    return nodeIndexAggregate(nodeSelection.index || rootNodeIndex, name)
  }

  chart.selectedItems = function (_) {
    if (!arguments.length) { return selectionItems }
    const selectedItems = selectionItems = _
    const selectedNodes = rootNode && selectedItems && selectedItems.size ? selectNodes([rootNode], (node) => selectedItems.has(node.item)) : null
    nodeSelection.update(selectedNodes, itemTraits)
    nodeSelectionHighlight.update(nodeSelection.nodes, viewRevision, true)
    return chart
  }

  chart.hoveredNode = function () {
    return hoveredNode
  }

  return chart
}
