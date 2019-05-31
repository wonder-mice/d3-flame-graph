export class TabViewItem {
  constructor (active) {
    const element = this.element = document.createElement('div')
    const style = element.style
    style.float = 'left'
    style.userSelect = 'none'
    style.cursor = 'pointer'
    style.whiteSpace = 'nowrap'
    style.padding = '2px 12px 2px'
    style.border = '1px solid transparent'
    style.borderRadius = '3px 3px 0 0'
    style.borderTop = '3px solid transparent'
    style.borderColor = '#e36209 #e1e4e8 transparent'
    this.setActive(active)
  }
  setActive (active) {
    if (active) {
      const style = this.element.style
      style.color = '#24292e'
      style.backgroundColor = '#fff'
      style.borderTopColor = '#e36209'
    } else {
      const style = this.element.style
      style.color = '#586069'
      style.backgroundColor = 'transparent'
      style.borderTopColor = 'rgba(27,31,35,.3)'
    }
  }
}

export class TabView {
  constructor (parent) {
    const element = this.element = document.createElement('div')
    element.style.borderBottom = '1px solid #e1e4e8'
    element.style.width = '100%'
    const tabsElement = this.tabsElement = element.appendChild(document.createElement('div'))
    tabsElement.style.position = 'relative'
    tabsElement.style.top = '1px'
    if (parent) {
      parent.appendChild(element)
    }
  }
  addTab (before, active) {
    const tab = new TabViewItem(active)
    if (before) {
      this.tabsElement.insertBefore(tab.element, before.element)
    } else {
      this.tabsElement.appendChild(tab.element)
    }
    return tab
  }
  removeTab (tab) {
    this.tabsElement.removeChild(tab.element)
  }
}
