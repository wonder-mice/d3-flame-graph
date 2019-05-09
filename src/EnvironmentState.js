export class EnvironmentState {
}

let lastId = 0

function newId (tag) {
  return 'fg-' + (tag || 'id') + '-' + (++lastId)
}

function textSelected () {
  return window.getSelection().type === 'Range'
}

function onKeyUpDown (event) {
  switch (event.type) {
    case 'keydown':
    case 'keyup':
      EnvironmentState.shiftKey = event.shiftKey
      break
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', onKeyUpDown, false)
  document.addEventListener('keyup', onKeyUpDown, false)
}

EnvironmentState.newId = newId
EnvironmentState.shiftKey = false
EnvironmentState.textSelected = textSelected
