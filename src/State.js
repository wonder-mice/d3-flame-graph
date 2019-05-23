import { Metrics } from './Metrics'
export const inputUnchanged = 0
export const inputPending = 1
export const inputChanged = 2

// Sets status of each `pending` output input to `unchanged`. If state that owns
// the input (consumer) now has all its inputs in `unchanged` status, repeat
// procedure recursively for all output inputs of this state. Note, that if
// input is `changed`, it will remain `changed`.
function outputSetClean (state) {
  const queue = [state.outputInputs]
  for (let k = queue.length; k--;) {
    const outputInputs = queue[k]
    for (let i = outputInputs.length; i--;) {
      const input = outputInputs[i]
      if (inputPending === input.status) {
        input.status = inputUnchanged
        const state = input.consumer
        if (!--state.inputsChanged) {
          queue[k++] = state.outputInputs
        }
      }
    }
  }
}

// Sets input status to `unchanged`. If this causes owning state (consumer) to
// have no `dirty` inputs, calls `outputSetClean()` on it to mark its output
// inputs as clean. Behavior is different (but only for provided `input`) from
// `outputSetClean()` in that it will always change input's status to
// `unchanged`, even when it's current status is `changed`.
function inputSetClean (input) {
  if (inputUnchanged !== input.status) {
    input.status = inputUnchanged
    const state = input.consumer
    if (!--state.inputsChanged) {
      outputSetClean(state)
    }
  }
}

// Set status of each `unchanged` output input to `pending`. If state that owns
// the input (consumer) previosuly had all its inputs `unchanged` (was clean),
// repeat procedure recursively for all output inputs of this state. Note, that
// if input is `changed`, it will remain changed (because `changed` is `dirty`
// too).
function outputSetDirty (state) {
  // console.log('Invalidate (start): ' + state.name)
  const queue = [state.outputInputs]
  for (let k = queue.length; k--;) {
    const outputInputs = queue[k]
    for (let i = outputInputs.length; i--;) {
      const input = outputInputs[i]
      // console.log('Invalidate (input consumer, status ' + input.status + '): ' + (input.consumer && input.consumer.name))
      if (inputUnchanged === input.status) {
        input.status = inputPending
        const consumer = input.consumer
        if (!consumer.inputsChanged++) {
          // console.log('Invalidate (consumer): ' + consumer.name)
          queue[k++] = consumer.outputInputs
        }
      }
    }
  }
}

// Sets input status to `changed`. If this causes owning state (consumer) to
// transition from 0 `dirty` inputs to 1 `dirty` input, calls `outputSetDirty()`
// on it to mark its output inputs as `dirty`. Behavior is different (but only
// for provided `input`) from `outputSetDirty()` in that it will always change
// input's status to `changed`, even when it's current status is `pending`.
function inputSetDirty (input) {
  if (inputUnchanged === input.status) {
    const state = input.consumer
    if (!state.inputsChanged++) {
      outputSetDirty(state)
    }
  }
  input.status = inputChanged
}

function inputConsume (input) {
  const traits = input.traits
  if (traits && traits.consumed) {
    traits.consumed(input)
  }
}

function inputReset (input) {
  const traits = input.traits
  if (traits && traits.reset) {
    traits.reset(input)
  }
}

function inputUpdate (input, value) {
  const traits = input.traits
  if (traits && traits.update) {
    traits.update(input, value)
  }
}

function inputAttach (input, producer) {
  producer.outputInputs.push(input)
  const traits = input.traits
  if (traits && traits.attached) {
    traits.attached(input, producer)
  }
}

function stateConsumeInputs (state) {
  const inputs = state.inputs
  for (let i = inputs.length; i--;) {
    const input = inputs[i]
    input.status = inputUnchanged
    inputConsume(input)
  }
  state.inputsChanged = 0
}

function stateProduceOutput (state, value) {
  const outputInputs = state.outputInputs
  for (let i = outputInputs.length; i--;) {
    const input = outputInputs[i]
    // Callback is called for all output inputs, regardless of their state.
    // That's because callback must be able to reliably assign latest value to
    // all of them, while their status is just whether consumer will interpret
    // updated value as a new one.
    inputUpdate(input, value)
    // However, output input status will be updated to `changed` only if it's
    // still `pending`, because:
    // - Callback is allowed to explicitly set `unchanged` status on certain
    //   inputs.
    // - Upstream states are allowed to produce output for downstream states
    //   inside their update action callback (e.g. if they can compute it more
    //   efficiently). When this happens, all inputs of downstream state will
    //   be marked as `unchanged` indicating that state is clean and there is no
    //   need to call its update action callback. While we want `callback`
    //   above to update the output input value, we don't want to transition
    //   associated consumer state into dirty state and cause its update action
    //   callback to be called.
    if (inputPending === input.status) {
      input.status = inputChanged
    }
  }
}

function stateProduceOutputReset (state) {
  const outputInputs = state.outputInputs
  for (let i = outputInputs.length; i--;) {
    const input = outputInputs[i]
    // See comment in `stateProduceOutput()` on why we keep `unchanged` inputs
    // unchanged.
    if (inputPending === input.status) {
      input.status = inputChanged
      inputReset(input)
    }
  }
}

function stateUpdate (state) {
  const action = state.action
  if (!action || (action(state), state.inputsChanged)) {
    stateProduceOutputReset(state)
    stateConsumeInputs(state)
  }
}

function statesCollect (states) {
  // Traverse the subgraph and assign correct `outputInputsMarked` values to states
  // inside the subgraph. For each state, `outputInputsMarked` is number of dirty
  // next states (states that depend on this one) **in the subgraph**. Each state
  // from `states` gets a `+1` for being in `states` list, which is basically
  // simulates virtual state that depends on all states from `states`.
  const queue = states.slice()
  for (let k = queue.length; k--;) {
    const state = queue[k]
    if (state.inputsChanged && !state.outputInputsMarked++) {
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { queue[k++] = producer }
      }
    }
  }
  // Topological sort using computed `outputInputsMarked`. Each time state with
  // `outputInputsMarked` equal to `1` is found, add it to the `sorted` list and
  // add its dependencies (previous states) to the queue. For each encountered
  // state, decrease its `outputInputsMarked` by `1`.
  const sorted = []
  for (let k = states.length, n = sorted.length; k--;) {
    const state = states[k]
    if (state.inputsChanged && !--state.outputInputsMarked) {
      sorted[n++] = state
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { states[k++] = producer }
      }
    }
  }
  // Algorithm here can be imrpoved.
  return sorted
}

function statesUpdate (states) {
  if (Metrics.statesUpdate) {
    Metrics.statesUpdate(...states)
  }
  Metrics.begin('StateUpdate')
  const queue = statesCollect(states)
  const dirtyN = queue.length
  let updatedN = 0
  for (let k = dirtyN; k--;) {
    const state = queue[k]
    if (state.inputsChanged) {
      ++updatedN
      Metrics.begin(state.name)
      stateUpdate(state)
      Metrics.end('' + state.inputsChanged + '/' + state.inputs.length + ' inputs changed')
    }
  }
  Metrics.end('' + updatedN + '/' + dirtyN + ' states updated')
}

export function statesPlot (states) {
  const queue = states.slice()
  for (let k = queue.length; k--;) {
    const state = queue[k]
    if (!state.outputInputsMarked++) {
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { queue[k++] = producer }
      }
    }
  }
  const sorted = []
  for (let k = states.length, n = sorted.length; k--;) {
    const state = states[k]
    if (!--state.outputInputsMarked) {
      sorted[n++] = state
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { states[k++] = producer }
      }
    }
  }
  let uid = 0
  for (let k = sorted.length; k--;) {
    sorted[k].uid = ++uid
  }
  let dot = '# State graph:\ndigraph G {\n'
  for (let k = sorted.length; k--;) {
    const state = sorted[k]
    const stateName = `${state.name} (${state.uid})`
    if (state.inputsChanged) {
      dot += `    "${stateName}" [color=red]\n`
    }
    const inputs = state.inputs
    for (let i = inputs.length; i--;) {
      const input = inputs[i]
      const status = input.status
      const producer = input.producer
      const producerName = producer ? `${producer.name} (${producer.uid})` : `None (${++uid})`
      if (!producer) {
        dot += `    "${producerName}" [color=grey]\n`
      }
      dot += `    "${producerName}" -> "${stateName}"`
      if (inputUnchanged !== status) {
        dot += ` [color=${inputChanged === status ? 'red' : 'orange'}]`
      }
      dot += '\n'
    }
    state.outputInputsMarked = 0
  }
  dot += '}\n'
  return dot
}

export class StateInputTraits {
  static reset (input) { input.value = null }
  static update (input, value) { input.value = value }
  static attached (input) { this.reset(input) }
  static detached (input) { this.reset(input) }
  static consumed (input) { this.reset(input) }
}

// `StateInput` is a mechanism `State` can use to get fine grained information
// about why it was invalidated. `StateInput` is owned by exactly one `State`,
// specified as `consumer` in `StateInput` constructor (required). It can be
// connected (optional) to exactly one output state (`producer` constructor
// parameter).
export class StateInput {
  constructor (consumer, producer, traits) {
    this.consumer = consumer
    this.producer = producer
    this.traits = traits
    this.status = inputChanged
  }
  get changed () {
    // Status `pending` is not considered `changed` here.
    return inputChanged === this.status
  }
  send (value) {
    inputUpdate(this, value)
    inputSetDirty(this)
  }
  // Regardles of current status, sets it to `unchanged` and propagates
  // `unchanged` status downstream for all `pending` output inputs.
  cancel () {
    inputSetClean(this)
  }
}

export class State {
  constructor (name, action) {
    this.name = name
    this.action = action
    this.inputs = []
    this.inputsChanged = 1
    this.outputInputs = []
    this.outputInputsMarked = 0
  }
  update () {
    if (this.inputsChanged) {
      statesUpdate([this])
    }
  }
  // Adds a new input and connects it to output of `producer` state (optional,
  // if not specified created input will not be connected to any state).
  input (producer, traits) {
    const input = new StateInput(this, producer, traits)
    this.inputs.push(input)
    if (!this.inputsChanged++) {
      outputSetDirty(this)
    }
    if (producer) {
      inputAttach(input, producer)
    }
    return input
  }
  setter (callback) {
    const input = new StateInput(this)
    this.inputs.push(input)
    if (!this.inputsChanged++) {
      outputSetDirty(this)
    }
    return (value) => {
      callback(value)
      inputSetDirty(input)
    }
  }
  get dirty () {
    return this.inputsChanged
  }
  // Invalidates state directly, regardless of status of its inputs. Invalidated
  // state can only by validated during state graph update phase.
  invalidate () {
    if (!this.inputsChanged++) {
      outputSetDirty(this)
    }
  }
  // Updates state output. Calls `callback` for each `unchanged` output input as
  // `callback(value, output)`.
  // Must only be used
  send (value) {
    if (this.inputsChanged) {
      stateConsumeInputs(this)
    }
    stateProduceOutput(this, value)
  }
  cancel () {
    if (this.inputsChanged) {
      stateConsumeInputs(this)
    }
    outputSetClean(this)
  }
  static update (...states) { statesUpdate(states) }
  static plot (...states) { return statesPlot(states) }
}
