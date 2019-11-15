import logger from './logger';
import { Connection, InitConfig, Handler, OutboundTransporter } from './types';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from './helpers';
import { IndyWallet } from './Wallet';
import {
  handleInvitation,
  handleConnectionRequest,
  handleConnectionResponse,
  handleAckMessage,
} from './protocols/connections/handlers';
import { ConnectionService } from './protocols/connections/ConnectionService';
import { MessageType as ConnectionsMessageType } from './protocols/connections/messages';
import { handleBasicMessage } from './protocols/basicmessage/handlers';
import { MessageType as BasicMessageMessageType } from './protocols/basicmessage/messages';
import { handleForwardMessage, handleRouteUpdateMessage } from './protocols/routing/handlers';
import { MessageType as RoutingMessageType } from './protocols/routing/messages';
import { ProviderRoutingService } from './protocols/routing/ProviderRoutingService';
import { BasicMessageService } from './protocols/basicmessage/BasicMessageService';
import { ConsumerRoutingService } from './protocols/routing/ConsumerRoutingService';
import { Context } from './Context';
import { MessageReceiver } from './MessageReceiver';
import { BasicDispatcher } from './BasicDispatcher';
import { MessageSender } from './MessageSender';

class Agent {
  context: Context;
  messageReceiver: MessageReceiver;
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;
  providerRoutingService: ProviderRoutingService;
  consumerRoutingService: ConsumerRoutingService;
  handlers: { [key: string]: Handler } = {};

  constructor(config: InitConfig, outboundTransporter: OutboundTransporter) {
    logger.logJson('Creating agent with config', config);

    const wallet = new IndyWallet({ id: config.walletName }, { key: config.walletKey });
    const messageSender = new MessageSender(wallet, outboundTransporter);

    this.context = {
      config,
      wallet,
      messageSender,
    };

    this.connectionService = new ConnectionService(this.context);
    this.basicMessageService = new BasicMessageService();
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.context);

    this.registerHandlers();

    const dispatcher = new BasicDispatcher(this.handlers, messageSender);
    this.messageReceiver = new MessageReceiver(config, wallet, dispatcher);
  }

  async init() {
    await this.context.wallet.init();

    const { publicDid, publicDidSeed } = this.context.config;
    if (publicDid && publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      this.context.wallet.initPublicDid(publicDid, publicDidSeed);
    }
  }

  getPublicDid() {
    return this.context.wallet.getPublicDid();
  }

  async createInvitationUrl() {
    const connection = await this.connectionService.createConnectionWithInvitation();
    const { invitation } = connection;

    if (!invitation) {
      throw new Error('Connection has no invitation assigned.');
    }

    // If agent has inbound connection, which means it's using agency, we need to create a route for newly created
    // connection verkey at agency.
    if (this.context.inboundConnection) {
      this.consumerRoutingService.createRoute(connection.verkey);
    }

    return encodeInvitationToUrl(invitation);
  }

  async acceptInvitationUrl(invitationUrl: string) {
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const verkey = await this.messageReceiver.receiveMessage(invitation);
    return verkey;
  }

  async receiveMessage(inboundPackedMessage: any) {
    this.messageReceiver.receiveMessage(inboundPackedMessage);
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
    return this.providerRoutingService.getRoutes();
  }

  establishInbound(agencyVerkey: Verkey, connection: Connection) {
    this.context.inboundConnection = { verkey: agencyVerkey, connection };
  }

  async sendMessageToConnection(connection: Connection, message: string) {
    const outboundMessage = this.basicMessageService.send(message, connection);
    await this.context.messageSender.sendMessage(outboundMessage);
  }

  private registerHandlers() {
    const handlers = {
      [ConnectionsMessageType.ConnectionInvitation]: handleInvitation(
        this.connectionService,
        this.consumerRoutingService
      ),
      [ConnectionsMessageType.ConnectionRequest]: handleConnectionRequest(this.connectionService),
      [ConnectionsMessageType.ConnectionResposne]: handleConnectionResponse(this.connectionService),
      [ConnectionsMessageType.Ack]: handleAckMessage(this.connectionService),
      [BasicMessageMessageType.BasicMessage]: handleBasicMessage(this.connectionService, this.basicMessageService),
      [RoutingMessageType.RouteUpdateMessage]: handleRouteUpdateMessage(
        this.connectionService,
        this.providerRoutingService
      ),
      [RoutingMessageType.ForwardMessage]: handleForwardMessage(this.providerRoutingService),
    };

    this.handlers = handlers;
  }
}

export { Agent, OutboundTransporter };
