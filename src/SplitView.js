function onMouseDown (view, event) {
  event.preventDefault()
  document.addEventListener('mousemove', view.onMouseMove)
  document.addEventListener('mouseup', view.onMouseUp)
  view.element.style.cursor = view.cursor
  view.left.style.pointerEvents = 'none'
  view.right.style.pointerEvents = 'none'
  view.width = view.liveWidth = view.left.offsetWidth
  view.maxWidth = view.element.offsetWidth - view.handle.offsetWidth
  view.pos = event.clientX
}

function onMouseMove (view, event) {
  const collapse = view.collapse || 0
  const pos = event.clientX
  let width = view.liveWidth += pos - view.pos
  if (width < collapse) {
    width = 0
  } else if (view.maxWidth - collapse < width) {
    width = view.maxWidth
  }
  if (view.width !== width) {
    view.left.style.width = width + 'px'
    view.width = width
  }
  view.pos = pos
}

function onMouseUp (view, event) {
  document.removeEventListener('mousemove', view.onMouseMove)
  document.removeEventListener('mouseup', view.onMouseUp)
  view.element.style.cursor = ''
  view.left.style.pointerEvents = 'auto'
  view.right.style.pointerEvents = 'auto'
  if (view.resized) {
    view.resized()
  }
}

export class SplitView {
  constructor (parent) {
    this.cursor = 'col-resize'
    // When pannel is smaller than `collapse` its width will collapse to 0.
    this.collapse = 20
    // When set, will be called on mouse up.
    this.resized = null
    this.onMouseDown = (event) => { onMouseDown(this, event) }
    this.onMouseMove = (event) => { onMouseMove(this, event) }
    this.onMouseUp = (event) => { onMouseUp(this, event) }
    this.width = null
    this.liveWidth = null
    this.maxWidth = null
    this.pos = null
    const element = this.element = document.createElement('div')
    const left = this.left = document.createElement('div')
    const right = this.right = document.createElement('div')
    const handle = this.handle = document.createElement('div')
    element.style.display = 'flex'
    element.className = 'fg-split'
    left.style.overflow = 'hidden'
    left.style.width = '75%'
    left.className = 'fg-split-left'
    right.style.overflow = 'hidden'
    right.style.flex = '1 1 0'
    right.className = 'fg-split-right'
    handle.style.flexGrow = '0'
    handle.style.flexShrink = '0'
    handle.style.cursor = this.cursor
    handle.className = 'fg-split-handle'
    handle.addEventListener('mousedown', this.onMouseDown)
    element.appendChild(left)
    element.appendChild(handle)
    element.appendChild(right)
    if (parent) {
      parent.appendChild(element)
    }
  }
}
