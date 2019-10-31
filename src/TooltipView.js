export class TooltipView {
  constructor (container) {
    const element = this.element = document.createElement('div')
    const style = element.style
    style.visibility = 'hidden'
    style.position = 'absolute'
    style.zIndex = '2'
    style.left = '0'
    style.top = '0'
    this.eventXOffset = 0
    this.eventYOffset = 0
    this.shown = false
    if (container) {
      container.appendChild(element)
    }
  }
  show (target, event) {
    const element = this.element
    const style = element.style
    style.visibility = 'hidden'
    const targetRect = target.getBoundingClientRect()
    const insideRect = element.parentElement.getBoundingClientRect()
    const tipRect = element.getBoundingClientRect()
    const clientWidth = document.documentElement.clientWidth
    const clientHeight = document.documentElement.clientHeight
    const px = event ? event.clientX : targetRect.x
    const py = event ? event.clientY : targetRect.y
    const pd = targetRect.height
    let x = event ? px + pd : px
    let y = py + pd
    if (clientWidth < x + tipRect.width) {
      x = clientWidth - tipRect.width
    }
    if (clientHeight < y + tipRect.height) {
      y = py - pd - tipRect.height
    }
    x -= insideRect.left
    y -= insideRect.top
    this.eventXOffset = px - x
    this.eventYOffset = py - y
    style.transform = 'translate(' + x + 'px,' + y + 'px)'
    style.visibility = 'visible'
    this.shown = true
  }
  hide () {
    if (this.shown) {
      this.element.style.visibility = 'hidden'
      this.shown = false
    }
  }
  move (event) {
    if (this.shown) {
      const x = event.clientX - this.eventXOffset
      const y = event.clientY - this.eventYOffset
      this.element.style.transform = 'translate(' + x + 'px,' + y + 'px)'
    }
  }
}
