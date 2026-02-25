import { PIIDetectorGuard } from './guards/pii-detector.js';

const piiDetector = new PIIDetectorGuard();

export function createSafeLogger(baseLogger: any) {
  return {
    info: (msg: string, data?: any) => {
      baseLogger.info(piiDetector.redact(msg).redacted, redactData(data));
    },
    warn: (msg: string, data?: any) => {
      baseLogger.warn(piiDetector.redact(msg).redacted, redactData(data));
    },
    error: (msg: string, data?: any) => {
      baseLogger.error(piiDetector.redact(msg).redacted, redactData(data));
    },
  };
}

function redactData(data: any): any {
  if (!data) return data;
  if (typeof data === 'string') return piiDetector.redact(data).redacted;
  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        result[key] = piiDetector.redact(value).redacted;
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return data;
}
