export function logInfo(message, meta = {}, req = null) {
  console.log(JSON.stringify({
    level: 'info',
    message,
    requestId: req?.id || null,
    ...meta,
    timestamp: new Date().toISOString()
  }));
}

export function logError(message, meta = {}, req = null) {
  console.error(JSON.stringify({
    level: 'error',
    message,
    requestId: req?.id || null,
    ...meta,
    timestamp: new Date().toISOString()
  }));
}