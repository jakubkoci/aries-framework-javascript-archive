import { Agent } from './Agent';

export interface InboundTransporter {
  start(agent: Agent): void;
}
