import { NodeHighlightClass } from './NodeHighlight'
import { nodeFlagSelected } from './Node'

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

function getNodeColor (node, context) {
  return context.hasDelta && context.maxDelta ? deltaColor(node.delta, context.maxDelta) : nameColor(node.name)
}

function setNodeContent (node, context) {
  const small = node.width <= nodeWidthSmall
  let classes = small ? nodeClassBaseSmall : nodeClassBase
  const focus = node.bits & 0b11
  if (focus) { classes += nodeFocusHighlightClass.getClass(focus) }
  const mark = node.mark & 0b1001
  if (mark) { classes += nodeMarkHighlightClass.getClass(mark) }
  if (!(node.flags & nodeFlagSelected)) { classes += ' fg-nsel' }
  this.className = classes
  this.textContent = small ? '' : node.name
}

let nodeWidthSmall = 35
let nodeClassBase = 'fg-node'
let nodeClassBaseSmall = 'fg-node-sm'

const nodeFocusHighlightClass = new NodeHighlightClass('fg-fc', ' ')
const nodeMarkHighlightClass = new NodeHighlightClass('fg-mk', ' ')

export class NodeRenderer {
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
    this.nodeClickListener = null
    this.nodeMouseEnterListener = null
    this.nodeMouseLeaveListener = null
    this.nodeMouseMoveListener = null
  }
  render (layout) {
    let nodes, i, node, element
    const revision = this.revision
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
    const nodeClickListener = this.nodeClickListener
    const nodeMouseEnterListener = this.nodeMouseEnterListener
    const nodeMouseLeaveListener = this.nodeMouseLeaveListener
    const nodeMouseMoveListener = this.nodeMouseMoveListener
    const fixY = this.inverted ? layout.height - layout.rowHeight : 0
    const context = this.context = layout.context
    this.nodes = nodes = layout.nodes
    this.revision = revision
    for (i = nodes.length; i--;) {
      element = (node = nodes[i]).element
      if (!element) {
        if (!(element = unusedElements.pop())) {
          element = document.createElement('div')
          element.addEventListener('click', nodeClickListener)
          element.addEventListener('mouseenter', nodeMouseEnterListener)
          element.addEventListener('mouseleave', nodeMouseLeaveListener)
          element.addEventListener('mousemove', nodeMouseMoveListener)
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
      element.style.display = ''
    }
  }
  updateSelection (nodes) {
    const revision = this.revision
    for (let i = nodes.length; i--;) {
      const node = nodes[i]
      if (revision === node.rev) {
        node.element.classList.toggle('fg-nsel', !(node.flags & nodeFlagSelected))
      }
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
