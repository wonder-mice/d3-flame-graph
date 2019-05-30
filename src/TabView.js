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

    /*
    const contentElement = this.contentElement = document.createElement('div')
    const contentElementStyle = contentElement.style
    contentElementStyle.width = '100%'
    contentElementStyle.position = 'relative'
    contentElementStyle.display = 'flex'
    */
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
    const plusTab = this.plusTab = new TabViewItem(false)
    tabsElement.appendChild(plusTab.element)
    this.activeTab = plusTab
    if (parent) {
      parent.appendChild(element)
    }
  }
  addTab (active) {
    const tab = new TabViewItem(active)
    this.tabsElement.insertBefore(tab.element, this.plusTab.element)
    return tab
  }
  removeTab (tab) {
    if (tab === this.activeTab) {
      // FIXME: Maybe find another active tab?
      this.activeTab = null
    }
    this.tabsElement.removeChild(tab.element)
  }
  setActive (tab) {
    const activeTab = this.activeTab
    if (activeTab) {
      activeTab.setActive(false)
    }
    if (tab) {
      tab.setActive(true)
    }
    this.activeTab = tab
  }
}
