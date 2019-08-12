import { Connection, OutboundMessage } from '../types';
import { IndyWallet, Wallet } from './Wallet';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from '../helpers';
import logger from '../logger';
import { ConnectionService } from './ConnectionService';
import { Handler, handlers } from './handlers';
import { createForwardMessage, createBasicMessage } from './messages';

type InitConfig = {
  url: string;
  port: string | number;
  label: string;
  walletId: string;
  walletSeed: string;
  did: Did;
  didSeed: string;
};

type AgentConfig = {
  did?: Did;
  verkey?: Verkey;
};

class Agent {
  config: InitConfig;
  messageSender: MessageSender;
  wallet: Wallet;
  connectionService: ConnectionService;
  agentConfig: AgentConfig;
  handlers: { [key: string]: Handler } = {};

  constructor(config: InitConfig, messageSender: MessageSender) {
    this.config = config;
    this.messageSender = messageSender;
    this.agentConfig = {};

    const walletConfig = { id: config.walletId };
    const walletCredentials = { key: config.walletSeed };
    this.wallet = new IndyWallet(walletConfig, walletCredentials);
    this.connectionService = new ConnectionService(this.config, this.wallet);
    this.handlers = handlers;
  }

  async init() {
    await this.wallet.init();
  }

  /**
   * This method will be probably used only when agent is running as routing agency
   */
  async setAgentDid() {
    try {
      const [did, verkey] = await this.wallet.createDid({ did: this.config.did, seed: this.config.didSeed });
      this.agentConfig = { did, verkey };
      console.log('Agent config', this.agentConfig);
    } catch (error) {
      if (error.indyName && error.indyName === 'DidAlreadyExistsError') {
        // This is not a problem, we just reuse it.
        logger.log(error.indyName);
        const did = this.config.did;
        const verkey = await this.wallet.keyForLocalDid(this.config.did);
        this.agentConfig = { did, verkey };
      } else {
        throw error;
      }
    }
  }

  /**
   * This method will be probably used only when agent is running as routing agency
   */
  getAgentDid() {
    return this.agentConfig;
  }

  async createInvitationUrl() {
    const connection = await this.connectionService.createConnectionWithInvitation();
    const { invitation } = connection;

    if (!invitation) {
      throw new Error('Connection has no invitation assigned.');
    }

    return encodeInvitationToUrl(invitation);
  }

  async acceptInvitationUrl(invitationUrl: string) {
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const verkey = await this.receiveMessage(invitation);
    return verkey;
  }

  async receiveMessage(inboundPackedMessage: any) {
    logger.logJson(`Agent ${this.config.label} received message:`, inboundPackedMessage);
    let inboundMessage;

    if (!inboundPackedMessage['@type']) {
      inboundMessage = await this.wallet.unpack(inboundPackedMessage);
    } else {
      inboundMessage = { message: inboundPackedMessage };
    }

    logger.logJson('inboundMessage', inboundMessage);
    const outboundMessage = await this.dispatch(inboundMessage);

    if (outboundMessage) {
      this.sendMessage(outboundMessage);
    }

    return outboundMessage && outboundMessage.connection.verkey;
  }

  getConnections() {
    return this.connectionService.getConnections();
  }

  findConnectionByMyKey(verkey: Verkey) {
    return this.connectionService.findByVerkey(verkey);
  }

  findConnectionByTheirKey(verkey: Verkey) {
    return this.connectionService.findByTheirKey(verkey);
  }

  async sendMessageToConnection(connection: Connection, message: string) {
    const basicMessage = await createBasicMessage(connection, message);
    await this.sendMessage(basicMessage);
  }

  private dispatch(inboundMessage: any): Promise<OutboundMessage | null> {
    const messageType: string = inboundMessage.message['@type'];
    const handler = this.handlers[messageType];

    if (!handler) {
      throw new Error(`No handler for message type "${messageType}" found`);
    }

    const context = {
      config: this.config,
      wallet: this.wallet,
      connectionService: this.connectionService,
    };

    return handler(inboundMessage, context);
  }

  private async sendMessage(outboundMessage: OutboundMessage) {
    logger.logJson('outboundMessage', outboundMessage);

    const { payload, routingKeys, recipientKeys, senderVk } = outboundMessage;
    const outboundPackedMessage = await this.wallet.pack(payload, recipientKeys, senderVk);

    let message = outboundPackedMessage;
    if (routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const forwardMessage = createForwardMessage('did:sov:1234abcd#4', message);
        message = await this.wallet.pack(forwardMessage, [routingKey], senderVk);
      }
    }

    this.messageSender.sendMessage(outboundPackedMessage, outboundMessage.connection);
  }
}

interface MessageSender {
  sendMessage(message: any, connection?: Connection): any;
}

export { Agent };
