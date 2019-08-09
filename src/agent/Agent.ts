import { Connection, OutboundMessage } from '../types';
import { IndyWallet, Wallet } from './Wallet';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from '../helpers';
import logger from '../logger';
import { ConnectionService } from './ConnectionService';
import { Handler, handlers } from './handlers';
import { createForwardMessage, createBasicMessage } from './messages';

type AgentWalletConfig = {
  walletId: string;
  walletSeed: string;
};

type AgentConfig = {
  did?: Did;
  verkey?: Verkey;
};

class Agent {
  label: string;
  messageSender: MessageSender;
  wallet: Wallet;
  connectionService: ConnectionService;
  agentConfig: AgentConfig;
  handlers: { [key: string]: Handler } = {};

  config = {
    url: 'TODO',
    port: 'TODO',
    did: 'VsKV7grR1BUE29mG2Fm2kX', // TODO Replace with value from app config
    didSeed: '0000000000000000000000000Forward', // TODO Replace with value from app config
  };

  constructor(label: string, agentWalletConfig: AgentWalletConfig, messageSender: MessageSender) {
    this.label = label;
    this.messageSender = messageSender;
    this.agentConfig = {};

    const walletConfig = { id: agentWalletConfig.walletId };
    const walletCredentials = { key: agentWalletConfig.walletSeed };
    this.wallet = new IndyWallet(walletConfig, walletCredentials);
    this.connectionService = new ConnectionService(this.config, this.wallet);
    this.handlers = handlers;
  }

  async init() {
    await this.wallet.init();
  }

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
    await this.receiveMessage(invitation);
  }

  async receiveMessage(inboundPackedMessage: any) {
    logger.logJson(`Agent ${this.label} received message:`, inboundPackedMessage);
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
  }

  getConnections() {
    return this.connectionService.getConnections();
  }

  findConnectionByMyKey(verkey: Verkey) {
    return this.connectionService.findByVerkey(verkey);
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

    this.messageSender.sendMessage(outboundPackedMessage);
  }
}

interface MessageSender {
  sendMessage(message: any): any;
}

export { Agent };
