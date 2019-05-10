let metricsEnabled = null
let metricsStack = null
let metricsTimes = null
let metricsConsoleLog = null
let metricsConsoleTime = null
let metricsConsoleProfile = null

function metricsBegin (name) {
  const p = metricsStack.length
  const alias = 0 === p ? name : metricsStack[p - 1] + ' / ' + name
  metricsStack[p] = alias
  metricsTimes[p] = window.performance.now()
  if (metricsConsoleProfile) { console.profile(alias) }
  if (metricsConsoleTime) { console.time(alias) }
}

function metricsEnd (message) {
  const t2 = window.performance.now()
  const t1 = metricsTimes.pop()
  const alias = metricsStack.pop()
  if (metricsConsoleTime) { console.timeEnd(alias) }
  if (metricsConsoleProfile) { console.profileEnd(alias) }
  if (metricsConsoleLog) {
    console.log('[' + alias + ']: ' + ((t2 - t1) / 1000).toFixed(3) + 's' + (message ? ' (' + message + ')' : ''))
  }
}

export class Metrics {
  static enable (consoleLog, consoleTime, consoleProfile) {
    if (!metricsEnabled) {
      metricsEnabled = true
      metricsStack = []
      metricsTimes = []
      Metrics.enabled = true
      Metrics.begin = metricsBegin
      Metrics.end = metricsEnd
    }
    if (undefined !== consoleLog) { metricsConsoleLog = consoleLog }
    if (undefined !== consoleTime) { metricsConsoleTime = consoleTime }
    if (undefined !== consoleProfile) { metricsConsoleProfile = consoleProfile }
  }
  static begin (name) {}
  static end (message) {}
}
