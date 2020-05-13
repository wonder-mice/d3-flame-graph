import {State} from './State'
import {generateElementId, elementWithId} from './EnvironmentState'

const buttons = {
  // Reset selection
  setNode: {
    title: 'Reset selection to include only this node.',
    content: 'Σ¹',
    callback: (selection, node) => { selection.setNode(node) }
  },
  setSubtree: {
    title: 'Reset selection to include only this node and its descendants.',
    content: 'Σᛦ¹',
    callback: (selection, node) => { selection.setSubtree(node) }
  },
  setAncestors: {
    title: 'Reset selection to include only this node and its ancestors.',
    content: 'Σᛘ¹',
    callback: (selection, node) => { selection.setAncestors(node) }
  },
  setNamedNodes: {
    title: 'Reset selection to include only nodes with the same name.',
    content: 'Σⁿ',
    callback: (selection, node) => { selection.setNamedNodes(node.name) }
  },
  setNamedSubtrees: {
    title: 'Reset selection to include only nodes with the same name and their descendants.',
    content: 'Σᛦⁿ',
    callback: (selection, node) => { selection.setNamedSubtrees(node.name) }
  },
  setNamedAncestors: {
    title: 'Reset selection to include only nodes with the same name and their ancestors.',
    content: 'Σᛘⁿ',
    callback: (selection, node) => { selection.setNamedAncestors(node.name) }
  },
  // Add to selection (node based)
  includeNode: {
    title: 'Add node to selection.',
    content: '+Σ¹',
    callback: (selection, node) => { selection.modifyNode(node, true) }
  },
  includeSubtree: {
    title: 'Add node and its descendants to selection.',
    content: '+Σᛦ¹',
    callback: (selection, node) => { selection.modifySubtree(node, true) }
  },
  includeAncestors: {
    title: 'Add node and its ancestors to selection.',
    content: '+Σᛘ¹',
    callback: (selection, node) => { selection.modifyAncestors(node, true) }
  },
  // Remove from selection (node based)
  excludeNode: {
    title: 'Remove node from selection.',
    content: '-Σ¹',
    callback: (selection, node) => { selection.modifyNode(node, false) }
  },
  excludeSubtree: {
    title: 'Remove node and its descendants from selection.',
    content: '-Σᛦ¹',
    callback: (selection, node) => { selection.modifySubtree(node, false) }
  },
  excludeAncestors: {
    title: 'Remove node and its ancestors from selection.',
    content: '-Σᛘ¹',
    callback: (selection, node) => { selection.modifyAncestors(node, false) }
  },
  // Add to selection (name based)
  includeNamed: {
    title: 'Add nodes with the same name to selection.',
    content: '+Σⁿ',
    callback: (selection, node) => { selection.modifyNamedNodes(node.name, true) }
  },
  includeNamedSubtrees: {
    title: 'Add nodes with the same name and their descendants to selection.',
    content: '+Σᛦⁿ',
    callback: (selection, node) => { selection.modifyNamedSubtrees(node.name, true) }
  },
  includeNamedAncestors: {
    title: 'Add nodes with the same name and their ancestors to selection.',
    content: '+Σᛘⁿ',
    callback: (selection, node) => { selection.modifyNamedAncestors(node.name, true) }
  },
  // Remove from selection (name based)
  excludeNamed: {
    title: 'Remove nodes with the same name from selection.',
    content: '-Σⁿ',
    callback: (selection, node) => { selection.modifyNamedNodes(node.name, false) }
  },
  excludeNamedSubtrees: {
    title: 'Remove nodes with the same name and their descendants from selection.',
    content: '-Σᛦⁿ',
    callback: (selection, node) => { selection.modifyNamedSubtrees(node.name, false) }
  },
  excludeNamedAncestors: {
    title: 'Remove nodes with the same name and their ancestors from selection.',
    content: '-Σᛘⁿ',
    callback: (selection, node) => { selection.modifyNamedAncestors(node.name, false) }
  }
}

export class NodeTooltipView {
  constructor (container, causalDomain) {
    this.container = container
    this.contentCallback = null
    this.selectionInterface = null
    this.node = null
    this.named = true
    this.header = null
    this.body = null
    this.elementState = new State('NodeTooltipView::Element', (state) => { this.updateElement(state) })
    this.contentState = new State('NodeTooltipView::Content', (state) => { this.updateContent(state) })
    this.contentState.input(this.elementState)
    this.causalDomain = causalDomain || this.contentState
  }
  setNode (node) {
    this.node = node
    this.contentState.invalidate()
  }
  setContentCallback (contentCallback) {
    this.contentCallback = contentCallback
    this.contentState.invalidate()
  }
  setSelectionInterface (selectionInterface) {
    this.selectionInterface = selectionInterface
    this.elementState.invalidate()
  }
  setNamed (named) {
    this.named = named
    this.elementState.invalidate()
  }
  updateElement (state) {
    const named = this.named
    const headerId = generateElementId('tooltip-header')
    const bodyId = generateElementId('tooltip-body')

    const buttonIds = {}
    for (const name in buttons) {
      buttonIds[name] = generateElementId('tooltip-button')
    }
    let contentHTML = (`
      <div class='fg-tooltip'>`)
    if (named) {
      contentHTML += (`
        <div style="display: flex">
          <div id="${headerId}" class="fg-tooltip-header" style="flex: 1 1 auto"></div>
          <div class="fg-dropdown"  style="flex: 0 0 auto; margin-left: 0.5rem">
            <span class="fg-btn fg-btn-sm">
              <svg class="fg-icon" style="flex: 0 0 auto; fill: currentColor; width: 14px; height: 16px" viewBox="0 0 14 16" version="1.1" width="14" height="16" aria-hidden="true">
                <path fill-rule="evenodd" d="M2 13h4v1H2v-1zm5-6H2v1h5V7zm2 3V8l-3 3 3 3v-2h5v-2H9zM4.5 9H2v1h2.5V9zM2 12h2.5v-1H2v1zm9 1h1v2c-.02.28-.11.52-.3.7-.19.18-.42.28-.7.3H1c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h3c0-1.11.89-2 2-2 1.11 0 2 .89 2 2h3c.55 0 1 .45 1 1v5h-1V6H1v9h10v-2zM2 5h8c0-.55-.45-1-1-1H8c-.55 0-1-.45-1-1s-.45-1-1-1-1 .45-1 1-.45 1-1 1H3c-.55 0-1 .45-1 1z"></path>
              </svg>
            </span>
            <div class="fg-dropdown-content fg-dropdown-content-rt" style="display: flex; flex-direction: column">
              <span class="fg-btn fg-btn-sm" style="align-self:stretch">Copy callstack</span>
              <span class="fg-btn fg-btn-sm" style="align-self:stretch">Copy subframes</span>
              <span class="fg-btn fg-btn-sm" style="align-self:stretch">Copy view state</span>
            </div>
          </div>
        </div>`)
    }
    contentHTML += (`
        <div id="${bodyId}" class="fg-tooltip-body"></div>
        <div>
          <div style="display: flex">`)
    contentHTML += (`
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.setSubtree}" title="${buttons.setSubtree.title}">${buttons.setSubtree.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.setAncestors}" title="${buttons.setAncestors.title}">${buttons.setAncestors.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.setNode}" title="${buttons.setNode.title}">${buttons.setNode.content}</span>
              </div>
            </div>`)
    if (named) {
      contentHTML += (`
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.setNamedSubtrees}" title="${buttons.setNamedSubtrees.title}">${buttons.setNamedSubtrees.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.setNamedAncestors}" title="${buttons.setNamedAncestors.title}">${buttons.setNamedAncestors.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.setNamedNodes}" title="${buttons.setNamedNodes.title}">${buttons.setNamedNodes.content}</span>
              </div>
            </div>`)
    }
    contentHTML += (`
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.includeNode}" title="${buttons.includeNode.title}">${buttons.includeNode.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeSubtree}" title="${buttons.includeSubtree.title}">${buttons.includeSubtree.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeAncestors}" title="${buttons.includeAncestors.title}">${buttons.includeAncestors.content}</span>
              </div>
            </div>`)
    if (named) {
      contentHTML += (`
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.includeNamed}" title="${buttons.includeNamed.title}">${buttons.includeNamed.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeNamedSubtrees}" title="${buttons.includeNamedSubtrees.title}">${buttons.includeNamedSubtrees.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeNamedAncestors}" title="${buttons.includeNamedAncestors.title}">${buttons.includeNamedAncestors.content}</span>
              </div>
            </div>`)
    }
    contentHTML += (`
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.excludeNode}" title="${buttons.excludeNode.title}">${buttons.excludeNode.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeSubtree}" title="${buttons.excludeSubtree.title}">${buttons.excludeSubtree.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeAncestors}" title="${buttons.excludeAncestors.title}">${buttons.excludeAncestors.content}</span>
              </div>
            </div>`)
    if (named) {
      contentHTML += (`
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.excludeNamed}" title="${buttons.excludeNamed.title}">${buttons.excludeNamed.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeNamedSubtrees}" title="${buttons.excludeNamedSubtrees.title}">${buttons.excludeNamedSubtrees.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeNamedAncestors}" title="${buttons.excludeNamedAncestors.title}">${buttons.excludeNamedAncestors.content}</span>
              </div>
            </div>`)
    }
    contentHTML += (`
          </div>
          <div class="fg-tooltip-hint">
            <div class="fg-tooltip-hint-mouse-out">Hold <kbd>Shift</kbd> to move mouse inside.</div>
            <div class="fg-tooltip-hint-mouse-in">Release <kbd>Shift</kbd> to select text.</div>
          </div>
        </div>
      </div>`)
    const container = this.container
    container.innerHTML = contentHTML
    this.header = elementWithId(container, headerId)
    this.body = elementWithId(container, bodyId)

    const causalDomain = this.causalDomain
    for (const name in buttons) {
      const buttonElement = elementWithId(container, buttonIds[name])
      if (buttonElement) {
        buttonElement.addEventListener('click', (event) => {
          buttons[name].callback(this.selectionInterface, this.node)
          causalDomain.update()
        })
      }
    }
  }
  updateContent (state) {
    const node = this.node
    if (node) {
      if (this.named) {
        this.header.textContent = node.name
      }
      const contentCallback = this.contentCallback
      if (contentCallback) {
        contentCallback(this, node)
      }
    } else {
      state.cancel()
    }
  }
}
