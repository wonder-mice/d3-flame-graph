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

// Keeps track of current callstack frames and facilitates recursion detection.
// Initial `level` is 0 (callstack is empty). Frames are usually strings that
// contain both function and module name (e.g. "fread @ libc")
export class Callstack {
  constructor () {
    this.frames = []
    this.frameCounts = new Map()
  }
  push (frame) {
    const n = this.frameCounts.get(frame)
    this.frameCounts.set(frame, n ? n + 1 : 1)
    this.frames.push(frame)
  }
  pop (level) {
    let frame, n
    while (level < this.frames.length) {
      frame = this.frames.pop()
      n = this.frameCounts.get(frame)
      if (n > 1) {
        this.frameCounts.set(frame, n - 1)
      } else {
        this.frameCounts.delete(frame)
      }
    }
  }
  recursive (frame) {
    return 0 < this.frameCounts.get(frame)
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
  }
}

export class NodeContext {
  constructor () {
    this.hasDelta = false
    this.maxDelta = 0
  }
}

export class NodeHighlightClass {
  constructor (name, prefix) {
    this.name = name || null
    this.prefix = prefix || null
    this._cluster = null
  }
  setName (name) {
    this.name = name
    this._cluster = null
  }
  getClass (index) {
    return (this._cluster || this.generateCluster())[index]
  }
  getCluster () {
    return this._cluster || this.generateCluster()
  }
  generateCluster () {
    const name = this.prefix ? this.prefix + this.name : this.name
    return (this._cluster = Array.from({length: 16}, (v, k) => name + k))
  }
}

export class NodeHighlighter {
  constructor () {
    this.mapping = new Map()
  }
  addNode (key, node) {
    const mapping = this.mapping
    let nodes = mapping.get(key)
    if (nodes) {
      nodes.push(node)
    } else {
      mapping.set(key, [node])
    }
  }
  getHighlight (key, revision, highlightClass) {
    const nodes = this.mapping.get(key)
    if (!nodes) {
      return null
    }
    const marks = new Map()
    for (let i = nodes.length; 0 < i--;) {
      let node = nodes[i]
      if (revision === node.rev) {
        marks.set(node, marks.get(node) | nodeMarked)
      } else {
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
    return { revision: revision, cluster: highlightClass.getCluster(), marks: marks }
  }
  static applyHighlight (highlight, revision, enable) {
    if (highlight && revision === highlight.revision) {
      const cluster = highlight.cluster
      highlight.marks.forEach(function (mark, node, map) {
        node.element.classList.toggle(cluster[mark], enable)
      })
    }
  }
}

export function aggregateItems (roots, traits, aggregator) {
  const traitsGetChildren = traits.getChildren
  const traitsGetName = traits.getName
  let children, i, item, level, name, recursive
  const queue = []
  for (let n = roots.length; n--;) {
    children = traitsGetChildren.call(traits, roots[n])
    if (children && (i = children.length)) {
      while (i--) {
        queue.push(children[i])
      }
    }
  }
  const aggregateRecursive = traits.selfValue
  const levels = Array(queue.length).fill(0)
  const callstack = new Callstack()
  while ((item = queue.pop())) {
    level = levels.pop()
    name = traitsGetName.call(traits, item)
    recursive = callstack.recursive(name)
    if (aggregateRecursive || !recursive) {
      aggregator(item, name, recursive)
    }
    children = traitsGetChildren.call(traits, item)
    if (children && (i = children.length)) {
      callstack.pop(level++)
      callstack.push(name)
      while (i--) {
        queue.push(children[i])
        levels.push(level)
      }
    }
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
      if (mark & 0b0001) {
        if (aggregate) {
          traitsAddAggregateItem.call(traits, aggregate, node.item)
        } else {
          aggregate = traitsCreateAggregate.call(traits, node.item)
        }
        if (!aggregateRecursive) {
          continue
        }
      }
      if (mark & 0b0010) {
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
  let nodeNameHighlighter = null
  let nodeHoverHighlight = null
  let itemTraits = new ItemTraits()

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
    const traitsCreateAggregate = traits.createAggregate
    const traitsAddAggregateItem = traits.addAggregateItem
    aggregateItems(rootItems, itemTraits, function (item, name, recursive) {
      let node = nodes.get(name)
      if (!node) {
        node = new Node(parentNode, traitsCreateAggregate.call(traits, item), name)
        node.roots = [item]
        node.dir = true
        nodes.set(name, node)
      } else {
        traitsAddAggregateItem.call(traits, node.item, item)
        if (!recursive) {
          node.roots.push(item)
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
    nodeHoverHighlight = null
    nodeNameHighlighter = null
    if (rootNode) {
      hierarchyView.recycle([rootNode])
    }
  }

  function createItemViewNode (datum) {
    let name, nodes, i, node, itemChildren, k, nodeChildren, childItem, childNode
    const traits = itemTraits
    const traitsGetName = traits.getName
    const traitsGetChildren = traits.getChildren
    nodeNameHighlighter = new NodeHighlighter()
    const rootItem = traits.getRoot(datum)
    const rootNode = new Node(null, rootItem, (name = traitsGetName.call(traits, rootItem)))
    nodeNameHighlighter.addNode(name, rootNode)
    const queue = [[rootNode]]
    const siblingsList = []
    while ((nodes = queue.pop())) {
      for (i = nodes.length; i--;) {
        node = nodes[i]
        itemChildren = traitsGetChildren.call(traits, node.item)
        if (itemChildren && (k = itemChildren.length)) {
          nodeChildren = []
          while (k--) {
            childItem = itemChildren[k]
            childNode = new Node(node, childItem, (name = traitsGetName.call(traits, childItem)))
            nodeNameHighlighter.addNode(name, childNode)
            nodeChildren.push(childNode)
          }
          node.children = nodeChildren
          queue.push(nodeChildren)
          siblingsList.push(nodeChildren)
        }
      }
    }
    return rootNode
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

  function updateView () {
    const nodesRect = nodesElement.getBoundingClientRect()
    hierarchyLayout.totalWidth = nodesRect.width
    hierarchyLayout.hasDelta = itemTraits.hasDelta
    const layout = hierarchyLayout.layout(rootNode, focusNode, ++viewRevision)
    nodesElement.style.height = layout.height + 'px'
    hierarchyView.render(layout)
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
    const node = this.__node__
    if (nodeNameHighlighter) {
      nodeHoverHighlight = nodeNameHighlighter.getHighlight(node.name, viewRevision, nodeHoverHighlightClass)
      NodeHighlighter.applyHighlight(nodeHoverHighlight, viewRevision, true)
    }
    if (tooltipView.nodeTip) {
      if (!(externalState.shiftKey && tooltipView.shown)) {
        tooltipView.show(event, this, node, hierarchyView.context)
      }
    }
  }

  function nodeMouseLeave (event) {
    NodeHighlighter.applyHighlight(nodeHoverHighlight, viewRevision, false)
    if (!externalState.shiftKey) {
      tooltipView.hide()
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
    // Code below is identical for all view types
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
    // Code below is identical for all view types
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

  return chart
}
