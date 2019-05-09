function defaultGetName (item) {
  return item.n
}

function defaultGetChildren (item) {
  return item.c
}

function defaultGetCost (item) {
  return item
}

function defaultPreorderDFS (queue, callback) {
  let k = queue.length
  const levels = Array(k).fill(0)
  while (k--) {
    const item = queue[k]
    const level = levels[k]
    const children = this.getChildren(item)
    const childrenCount = children ? children.length : 0
    callback(item, level, childrenCount)
    if (childrenCount) {
      const childrenLevel = level + 1
      let i = childrenCount - 1
      do {
        queue[k] = children[i]
        levels[k] = childrenLevel
        ++k
      } while (i--)
    }
  }
}

function defaultCollectSiblings (parents) {
  const result = []
  for (let n = parents.length; n--;) {
    const children = this.getChildren(parents[n])
    if (children) {
      for (let i = children.length; i--;) {
        result.push(children[i])
      }
    }
  }
  return result
}

function defaultCopyCost (cost) {
  const copy = {}
  const v = cost.v
  const d = cost.d
  if (undefined !== v) { copy.v = v }
  if (undefined !== d) { copy.d = d }
  return copy
}

function defaultAddCost (aggregate, cost, recursive) {
  // FIXME: I'm not sure why `addRecursive` check is here, because based on
  // FIXME: naive interpretation of comment for `addRecursive` contract is
  // FIXME: such, that `addCost()` will not be called at all for recursive
  // FIXME: costs when `addRecursive` is `false`. I.e. if `addRecursive` is
  // FIXME: `false`, then `recursive` will be always `false` when this
  // FIXME: function is called.
  if (!recursive || this.addRecursive) {
    const v = cost.v
    const d = cost.d
    if (v) { aggregate.v = (aggregate.v || 0) + v }
    if (d) { aggregate.d = (aggregate.d || 0) + d }
  }
}

function defaultSubCost (aggregate, cost) {
  // FIXME: I'm not sure why `subRecursive` check is here, just followed the
  // FIXME: same pattern as in `defaultAddCost()` (see detailed comment there).
  if (this.subRecursive) {
    const v = cost.v
    const d = cost.d
    if (v) { aggregate.v = (aggregate.v || 0) - v }
    if (d) { aggregate.d = (aggregate.d || 0) - d }
  }
}

function defaultGetValue (cost) {
  return cost.v
}

function defaultGetDelta (cost) {
  return cost.d
}

// Item is an element of source data hierarchy. It has name, children and associated cost.
// Name and cost can be queried directly via `getName()` and `getCost()`. Cost by itself
// can be anything, but appropriate `CostTraits` instance must be provided that will be to
// access cost values. While interface has a method to get list of  children, current plan
// is not to use it and to rely exclusively on methods for structure traversal, like
// `preorderDFS()` and `collectSiblings()`. Item cost is... (FINISH ME)
export class StructureTraits {
  constructor () {
    // Given `item`, returns its name as a string.
    this.getName = defaultGetName
    // Given `item`, returns its cost. Cost is any entity that `CostTraits` can work with. It can be
    // `null` or `undefined` as well, it's up to `CostTraits` to handle such cases correctly.
    this.getCost = defaultGetCost
    // Given `item`, returns list of its direct children as an array. It would be nice not to rely
    // on it, and to have it only for the sake of convenient default implementations of
    // 'preorderDFS' and 'collectSiblings'. In other words, no code (except default implementations
    // of traits methods) should use it. But whether it's realistic is to be seen.
    this.getChildren = defaultGetChildren
    // Given initial list of items as an array, call callback for each item and their descendants in
    // DFS pre-order (aka NLR - node, left, rigth). Initial list of items can be used as DFS queue -
    // callers must expect that it will be mutated.
    this.preorderDFS = defaultPreorderDFS
    // Given list of items as an array, returns array that contains all their direct children.
    this.collectSiblings = defaultCollectSiblings
  }
}

export class CostTraits {
  constructor () {
    // When `addRecursive` is `false`, `addCost()` will be only called for non-recursive costs
    // (when `recursive` parameter is `false`). When `addRecursive` is `true`, `addCost()` will
    // be called for both recursive and non-recursive costs with `recursive` parameter specifying
    // whether cost is recursive. Set it to `false` when costs are exclusively transitive
    // (non-direct). For direct and mixed (contains both direct and transitive values) costs set
    // it to `true`.
    // When `subRecursive` is `false`, `subCost()` will NOT be called. Set it to `true` when
    // costs are transitive (non-direct) or mixed (contains both direct and transitive values).
    // For direct costs set it to `false`.
    // Summary:
    //    Cost        | addRecursive | subRecursive
    //   -------------+--------------+--------------
    //     Mixed      |  true        |  true
    //     Direct     |  true        |  false
    //     Transitive |  false       |  true
    //     Other*     |  false       |  false
    // Last combination (*), while not generally practical, can be used for costs with unusual
    // semantics.
    this.addRecursive = false
    this.subRecursive = true
    // Creates copy of cost instance.
    this.copyCost = defaultCopyCost
    // Adds cost to previously created copy.
    this.addCost = defaultAddCost
    // Substracts cost from previously created copy. Only recursive costs can be substracted.
    this.subCost = defaultSubCost
  }
}

export class ValueTraits {
  constructor () {
    // When `true`, value is intrinsic item value that doesn't include values of its descendants. When
    // `false, value is transitive and includes both intrinsic item value and values of its descendants
    // (i.e. includes transitive values of its children).
    this.direct = false
    // When `true`, specifies that cost instances have `delta` values associated with them. While
    // `delta` has this specific historical name, it doesn't have any specific meaning. It's just a
    // numeric value (can be negative, positive or 0) that can be used to color nodes on the graph.
    // It could be named `temperature` with the same success. During layout minimum and maximum deltas
    // of on-screen nodes will be computed and during rendering delta can be used to derive node color.
    this.delta = false
    // Returns `value` of cost. Value can be negative, positive, 0 or `null` (can NOT be `undefined`).
    this.getValue = defaultGetValue
    // Returns `delta` of cost. Delta can be negative, positive, 0, `null` or `undefined`.
    this.getDelta = defaultGetDelta
  }
}
