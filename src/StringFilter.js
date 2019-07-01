export const stringFilterPlaceholder = 'Filter: contains, /regexp or #equal match (!case sensitive)'
export const stringFilterTooltip = 'Matches any string that has specified string as a substring (case insensitive, prefix with "!" for case sensitive match). When prefixed with "/", rest of the string is interpreted as a regular expression (case insensitive, prefix with "!" for case sensitive match). When prefixed with "#", matches any string that is equal to the rest of specified string.'

export function stringFilterPredicate (term) {
  if (!term) {
    return null
  }
  if (typeof term === 'function') {
    return term
  }
  let expression = String(term)
  const length = expression.length
  if (!length) {
    return null
  }
  let caseSensitive = false
  let begin = 0
  if ('\\' !== expression[begin]) {
    if (begin < length && '!' === expression[begin]) {
      ++begin
      caseSensitive = true
    }
    if (begin < length && '#' === expression[begin]) {
      ++begin
      const exact = expression.slice(begin)
      return exact.length ? function (s) { return s === exact } : null
    }
    if (begin < length && '/' === expression[begin]) {
      ++begin
      const regexp = expression.slice(begin)
      try {
        const re = new RegExp(regexp, caseSensitive ? '' : 'i')
        return function (s) { return re.test(s) }
      } catch (error) {
        return null
      }
    }
  }
  if (length <= begin) {
    return null
  }
  const containsCS = expression.slice(begin)
  if (caseSensitive) {
    return function (s) { return s.includes(containsCS) }
  }
  const containsCI = containsCS.toLowerCase()
  return function (s) { return s.toLowerCase().includes(containsCI) }
}
