import type { InboundEnvelope } from '../../shared/src/types.js';

/**
 * Connector interface — all channel connectors implement this.
 * Normalizes incoming messages into InboundEnvelope format.
 */
export interface Connector {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Handler function that processes an InboundEnvelope and returns a response.
 */
export type MessageHandler = (envelope: InboundEnvelope) => Promise<string>;
