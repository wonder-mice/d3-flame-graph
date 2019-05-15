// Keeps track of current callstack frames and facilitates recursion detection.
// Initial `level` is 0 (callstack is empty). Frames are usually strings that
// contain both function and module name (e.g. "fread @ libc")
export class Callstack {
  constructor () {
    this.stack = []
    this.frameCounts = new Map()
    this.depth = 0
  }
  push (frame) {
    const frameCounts = this.frameCounts
    const record = frameCounts.get(frame)
    if (record) {
      this.stack[this.depth++] = record
      return 0 < record.n++
    }
    frameCounts.set(frame, (this.stack[this.depth++] = {n: 1}))
    return false
  }
  pop (level) {
    let depth = this.depth
    if (level < depth) {
      const stack = this.stack
      do { --stack[--depth].n } while (level < depth)
      this.depth = depth
    }
  }
  recursive (frame) {
    const record = this.frameCounts.get(frame)
    return record && 0 < record.n
  }
  update (level, frame, persistent) {
    this.pop(level)
    return persistent ? this.push(frame) : this.recursive(frame)
  }
}
