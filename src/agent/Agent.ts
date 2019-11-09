import logger from '../logger';
import { Connection, OutboundMessage, InitConfig, Agency, Handler } from './types';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from './helpers';
import { IndyWallet } from './Wallet';
import {
  handleInvitation,
  handleConnectionRequest,
  handleConnectionResponse,
  handleAckMessage,
} from './messaging/connections/handlers';
import { ConnectionService } from './messaging/connections/ConnectionService';
import { MessageType as ConnectionsMessageType } from './messaging/connections/messages';
import { handleBasicMessage } from './messaging/basicmessage/handlers';
import { MessageType as BasicMessageMessageType, createBasicMessage } from './messaging/basicmessage/messages';
import { handleForwardMessage, handleRouteUpdateMessage } from './messaging/routing/handlers';
import {
  MessageType as RoutingMessageType,
  createForwardMessage,
  createRouteUpdateMessage,
} from './messaging/routing/messages';
import { RoutingService } from './messaging/routing/RoutingService';
import { createOutboundMessage } from './messaging/helpers';
import { Context } from './Context';

class Agent {
  context: Context;
  messageSender: MessageSender;
  connectionService: ConnectionService;
  routingService: RoutingService;
  handlers: { [key: string]: Handler } = {};

  constructor(config: InitConfig, messageSender: MessageSender) {
    logger.logJson('Creating agent with config', config);

    this.messageSender = messageSender;

    const wallet = new IndyWallet({ id: config.walletName }, { key: config.walletKey });

    this.context = {
      config,
      wallet,
    };

    this.connectionService = new ConnectionService(this.context);
    this.routingService = new RoutingService();

    this.registerHandlers();
  }

  async init() {
    await this.context.wallet.init();
  }

  /**
   * This method will be probably used only when agent is running as routing agency
   */
  async setAgentDid() {
    this.context.wallet.initPublicDid(this.context.config.publicDid, this.context.config.publicDidSeed);
  }

  /**
   * This method will be probably used only when agent is running as routing agency
   */
  getAgentDid() {
    return this.context.wallet.getPublicDid();
  }

  async createInvitationUrl() {
    const connection = await this.connectionService.createConnectionWithInvitation();
    const { invitation } = connection;

    if (!invitation) {
      throw new Error('Connection has no invitation assigned.');
    }

    // If agent is using agency, we need to create a route for newly created connection verkey at agency.
    if (this.context.agency) {
      this.createRoute(connection.verkey, this.context.agency.connection);
    }

    return encodeInvitationToUrl(invitation);
  }

  async acceptInvitationUrl(invitationUrl: string) {
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const verkey = await this.receiveMessage(invitation);
    return verkey;
  }

  async receiveMessage(inboundPackedMessage: any) {
    logger.logJson(`Agent ${this.context.config.label} received message:`, inboundPackedMessage);
    let inboundMessage;

    if (!inboundPackedMessage['@type']) {
      inboundMessage = await this.context.wallet.unpack(inboundPackedMessage);

      if (!inboundMessage.message['@type']) {
        // TODO In this case we assume we got forwarded JWE message (wire message?) to this agent from agency. We should
        // perhaps try to unpack message in some loop until we have a Aries message in here.
        logger.logJson('Forwarded message', inboundMessage);

        // @ts-ignore
        inboundMessage = await this.context.wallet.unpack(inboundMessage.message);
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
    this.context.agency = { verkey: agencyVerkey, connection };
  }

  async sendMessageToConnection(connection: Connection, message: string) {
    // TODO I don't like so much logic in here. It would be probably better to put it into some service. It could be
    // possible to execute it by some handler, but handler is currently only for processing inbound messages.

    const basicMessage = createBasicMessage(message);
    const outboundMessage = createOutboundMessage(connection, basicMessage);
    await this.sendMessage(outboundMessage);
  }

  private async dispatch(inboundMessage: any): Promise<OutboundMessage | null> {
    const messageType: string = inboundMessage.message['@type'];
    const handler = this.handlers[messageType];

    if (!handler) {
      throw new Error(`No handler for message type "${messageType}" found`);
    }

    const outboundMessage = await handler(inboundMessage);

    // TODO I don't like create route logic is here. It should be in handler, but currently, it's not possible to send
    // message directly from handler. If agent is using agency, we need to create a route for newly created connection
    // verkey at agency.
    if (messageType === ConnectionsMessageType.ConnectionInvitation && this.context.agency) {
      if (!outboundMessage) {
        throw new Error("No outbound message for connection invitation. It won't be possible to create a route.");
      }
      const { verkey } = outboundMessage.connection;
      this.createRoute(verkey, this.context.agency.connection);
    }

    return outboundMessage;
  }

  private async sendMessage(outboundMessage: OutboundMessage) {
    const {
      connection: { verkey, theirKey, endpoint },
      routingKeys,
      recipientKeys,
      senderVk,
      payload,
    } = outboundMessage;

    logger.logJson('outboundMessage', { verkey, theirKey, routingKeys, endpoint, payload });

    const outboundPackedMessage = await this.context.wallet.pack(payload, recipientKeys, senderVk);

    let message = outboundPackedMessage;
    if (routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys;
        const forwardMessage = createForwardMessage(recipientKey, message);
        logger.logJson('Forward message created', forwardMessage);
        message = await this.context.wallet.pack(forwardMessage, [routingKey], senderVk);
      }
    }

    this.messageSender.sendMessage(message, outboundMessage);
  }

  private async createRoute(verkey: Verkey, routingConnection: Connection) {
    // TODO I don't like so much logic in here. It would be probably better to put it into some service. It could be
    // possible to execute it by some handler, but handler is currently only for processing inbound messages.

    logger.log('Creating route...');
    const routeUpdateMessage = createRouteUpdateMessage(verkey);

    const outboundMessage = createOutboundMessage(routingConnection, routeUpdateMessage);
    await this.sendMessage(outboundMessage);
  }

  private registerHandlers() {
    const handlers = {
      [ConnectionsMessageType.ConnectionInvitation]: handleInvitation(this.connectionService),
      [ConnectionsMessageType.ConnectionRequest]: handleConnectionRequest(this.connectionService),
      [ConnectionsMessageType.ConnectionResposne]: handleConnectionResponse(this.connectionService),
      [ConnectionsMessageType.Ack]: handleAckMessage(this.connectionService),
      [BasicMessageMessageType.BasicMessage]: handleBasicMessage(this.connectionService),
      [RoutingMessageType.RouteUpdateMessage]: handleRouteUpdateMessage(this.connectionService, this.routingService),
      [RoutingMessageType.ForwardMessage]: handleForwardMessage(this.routingService),
    };

    this.handlers = handlers;
  }
}

type $FixMe = any;
type WireMessage = $FixMe;

interface MessageSender {
  sendMessage(message: WireMessage, outboundMessage?: OutboundMessage): any;
}

export { Agent };
