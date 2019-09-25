import { InboundMessage, OutboundMessage, Agency } from '../types';
import { Wallet } from '../Wallet';

// TODO This would be replaced by Handler interface, but we also need to change current handlers from function
// into classes. I don't want to do this now to keep this commit focused.
export type Handler = (inboudMessage: InboundMessage, context: Context) => Promise<OutboundMessage | null>;

export interface Context {
  config: any;
  wallet: Wallet;
  agency?: Agency;
}
