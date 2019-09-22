import { Connection, OutboundMessage, InitConfig, Agency } from '../types';
import { IndyWallet, Wallet } from './Wallet';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from '../helpers';
import logger from '../logger';
import { ConnectionService } from './ConnectionService';
import { Handler, handlers } from './handlers';
import { createForwardMessage, createBasicMessage, MessageType, createRouteUpdateMessage } from './messages';
import { RoutingService } from './RoutingService';

class Agent {
  config: InitConfig;
  messageSender: MessageSender;
  wallet: Wallet;
  connectionService: ConnectionService;
  routingService: RoutingService;
  agency?: Agency;
  handlers: { [key: string]: Handler } = {};

  constructor(config: InitConfig, messageSender: MessageSender) {
    logger.logJson('Creating agent with config', config);

    this.config = config;
    this.messageSender = messageSender;

    this.wallet = new IndyWallet({ id: config.walletName }, { key: config.walletKey });
    this.connectionService = new ConnectionService(this.config, this.wallet);
    this.routingService = new RoutingService();
    this.handlers = handlers;
  }

  async init() {
    await this.wallet.init();
  }

  /**
   * This method will be probably used only when agent is running as routing agency
   */
  async setAgentDid() {
    this.wallet.initPublicDid(this.config.publicDid, this.config.publicDidSeed);
  }

  /**
   * This method will be probably used only when agent is running as routing agency
   */
  getAgentDid() {
    return this.wallet.getPublicDid();
  }

  async createInvitationUrl() {
    const connection = await this.connectionService.createConnectionWithInvitation(this.agency);
    const { invitation } = connection;

    if (!invitation) {
      throw new Error('Connection has no invitation assigned.');
    }

    // If agent is using agency, we need to create a route for newly created connection verkey at agency.
    if (this.agency) {
      this.createRoute(connection.verkey, this.agency.connection);
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

      if (!inboundMessage.message['@type']) {
        // TODO In this case we assume we got forwarded JWE message (wire message?) to this agent from agency. We should
        // perhaps try to unpack message in some loop until we have a Aries message in here.
        logger.logJson('Forwarded message', inboundMessage);

        // @ts-ignore
        inboundMessage = await this.wallet.unpack(inboundMessage.message);
      }
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

  getRoutes() {
    return this.routingService.getRoutes();
  }

  setAgency(agencyVerkey: Verkey, connection: Connection) {
    this.agency = { verkey: agencyVerkey, connection };
  }

  async sendMessageToConnection(connection: Connection, message: string) {
    const basicMessage = createBasicMessage(connection, message);
    await this.sendMessage(basicMessage);
  }

  private async dispatch(inboundMessage: any): Promise<OutboundMessage | null> {
    const messageType: string = inboundMessage.message['@type'];
    const handler = this.handlers[messageType];

    if (!handler) {
      throw new Error(`No handler for message type "${messageType}" found`);
    }

    const context = {
      config: this.config,
      wallet: this.wallet,
      agency: this.agency,
      connectionService: this.connectionService,
      routingService: this.routingService,
    };

    const outboundMessage = await handler(inboundMessage, context);

    // TODO I don't like create route logic is here. It should be in handler, but currently, it's not possible to send
    // message directly from handler. If agent is using agency, we need to create a route for newly created connection
    // verkey at agency.
    if (messageType === MessageType.ConnectionInvitation && this.agency) {
      if (!outboundMessage) {
        throw new Error("No outbound message for connection invitation. It won't be possible to create a route.");
      }
      const { verkey } = outboundMessage.connection;
      this.createRoute(verkey, this.agency.connection);
    }

    return outboundMessage;
  }

  private async sendMessage(outboundMessage: OutboundMessage) {
    const {
      connection: { verkey, theirKey },
      payload,
    } = outboundMessage;

    const { routingKeys, recipientKeys, senderVk } = outboundMessage;

    logger.logJson('outboundMessage', { verkey, theirKey, routingKeys, payload });

    const outboundPackedMessage = await this.wallet.pack(payload, recipientKeys, senderVk);

    let message = outboundPackedMessage;
    if (routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys;
        const forwardMessage = createForwardMessage(recipientKey, message);
        logger.logJson('Forward message created', forwardMessage);
        message = await this.wallet.pack(forwardMessage, [routingKey], senderVk);
      }
    }

    this.messageSender.sendMessage(message, outboundMessage.connection);
  }

  private async createRoute(verkey: Verkey, routingConnection: Connection) {
    logger.log('Creating route...');
    const saveRouteMessage = createRouteUpdateMessage(routingConnection, verkey);
    await this.sendMessage(saveRouteMessage);
  }
}

interface MessageSender {
  sendMessage(message: any, connection?: Connection): any;
}

export { Agent };
