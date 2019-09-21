export interface InitConfig {
  url: string;
  port: string | number;
  label: string;
  walletId: string;
  walletSeed: string;
  did: Did;
  didSeed: string;
  agencyVerkey?: Verkey;
}

export interface AgentConfig {
  did?: Did;
  verkey?: Verkey;
}

export enum ConnectionState {
  INIT,
  INVITED,
  REQUESTED,
  RESPONDED,
  COMPLETE,
}

export interface Connection {
  did: Did;
  didDoc: DidDoc;
  verkey: Verkey;
  theirDid?: Did;
  theirKey?: Verkey;
  invitation?: ConnectionInvitation;
  state: ConnectionState;
  endpoint?: string;
  messages: any[];
}

export interface ConnectionInvitation {
  serviceEndpoint: string;
  recipientKeys: string[];
}

export interface InvitationDetails {
  label: string;
  serviceEndpoint: string;
  recipientKeys: Verkey[];
  routingKeys: Verkey[];
}

export interface DidDoc {
  '@context': string;
  service: Service[];
}

interface Service {
  routingKeys: Verkey[];
}

export interface Message {
  '@id': string;
  '@type': string;
  [key: string]: any;
}

export interface InboundMessage {
  message: Message;
  sender_verkey: Verkey; // TODO make it optional
  recipient_verkey: Verkey; // TODO make it optional
}

export interface OutboundMessage {
  connection: Connection;
  endpoint?: string;
  payload: Message;
  recipientKeys: Verkey[];
  routingKeys: Verkey[];
  senderVk: Verkey | null;
}

export interface Agency {
  verkey: Verkey;
  connection: Connection;
}
