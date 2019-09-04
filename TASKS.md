# Tasks

- [ ] Implement search
- [ ] Collapse recursion
- [ ] Implement clipboard copy
- [ ] Implement state saves
- [ ] Name tab "Selection" only when not everything is selected
- [ ] Introduce concept of `current` traits for `Deck` and when setting traits only current traits for current active page change.
- [ ] Deck must have an option for setting minimum node width
- [ ] Set node cursor to arrow (default) or pointer, shouldn't be selectable
- [x] Review elements hierarchy in FlattenView
- [x] Remove redundant width/height:100% in deckpage splitview left/right
- [ ] Use string table for node names
- [ ] Compare boot args
- [ ] Integrate `Terser` npm to compute constants and get some other optimizations
- [ ] Don't add fake "All" node in ardiff python (this item seems invalid now).
- [ ] Ensure updateTooltipPosition is as high/late in hierarchy as possible.
- [ ] [NTBF] Don't use 70% as initial split view proportions, since it results in fractional sizes
- [ ] [NTBF] Need to invalidate nodeContentState when delta changes, since layout is not neccessary in this case.

# Notes

## Initial state of `StateInput.status`

It's not settled that setting initial `status` of `StateInput` to `pending` is better than `changed`. Initially, `changed` was used, because newly created inputs need to be processed by their states. However, having initial value of `changed` means that certain `StateInputTraits` callbacks will not be called (specifically `reset()`). To allow use of `StateInputTraits` as a mediator between two states (e.g. to send `width` value from producer to consumer), initial value of `StateInput.status` was (artificially?) changed to `pending`, so those callbacks are called for newly created inputs. Following helper was added and then removed to facilitate such use of `StateInput`.

```javascript
// Returns `StateInputTraits`-like object that can be used to transfer information
// from one `State` to another via `StateInput`. Example:
//   consumer.state.input(provider.state, StateInput.updater(() => { consumer.value = provider.value }))
static updater (updater) {
  return {send: updater, reset: updater}
}
```

Later it was decided that it's better to use explicit extra `State` object for such purposes.