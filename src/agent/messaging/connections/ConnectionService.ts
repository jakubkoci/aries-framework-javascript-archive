import { Connection, ConnectionState, InitConfig, Agency, InvitationDetails, Message } from '../../types';
import { Wallet } from '../../Wallet';
import { createInvitationMessage, createConnectionRequestMessage } from './messages';
import { Context } from '../../Context';
import { createOutboundMessage } from '../helpers';

class ConnectionService {
  context: Context;
  connections: Connection[] = [];

  constructor(context: Context) {
    this.context = context;
  }

  async acceptInvitation(invitation: Message) {
    const connection = await this.createConnection();
    const connectionRequest = createConnectionRequestMessage(connection, this.context.config.label);

    connection.state = ConnectionState.REQUESTED;

    return createOutboundMessage(connection, connectionRequest, invitation);
  }

  async createConnectionWithInvitation(): Promise<Connection> {
    const connection = await this.createConnection();
    const invitationDetails = this.createInvitationDetails(this.context.config, connection);
    const invitation = await createInvitationMessage(invitationDetails);
    connection.state = ConnectionState.INVITED;
    connection.invitation = invitation;
    return connection;
  }

  async createConnection(): Promise<Connection> {
    const [did, verkey] = await this.context.wallet.createDid();
    const did_doc = {
      '@context': 'https://w3id.org/did/v1',
      service: [
        {
          id: 'did:example:123456789abcdefghi#did-communication',
          type: 'did-communication',
          priority: 0,
          recipientKeys: [verkey],
          routingKeys: this.getRoutingKeys(),
          serviceEndpoint: this.getEndpoint(),
        },
      ],
    };

    const connection = {
      did,
      didDoc: did_doc,
      verkey,
      state: ConnectionState.INIT,
      messages: [],
    };

    this.connections.push(connection);

    return connection;
  }

  getConnections() {
    return this.connections;
  }

  findByVerkey(verkey: Verkey) {
    return this.connections.find(connection => connection.verkey === verkey);
  }

  findByTheirKey(verkey: Verkey) {
    return this.connections.find(connection => connection.theirKey === verkey);
  }

  // TODO Temporarily get context from service until this code will be move into connection service itself
  getContext() {
    return this.context;
  }

  private createInvitationDetails(config: InitConfig, connection: Connection) {
    const { didDoc } = connection;
    return {
      label: config.label,
      recipientKeys: didDoc.service[0].recipientKeys,
      serviceEndpoint: didDoc.service[0].serviceEndpoint,
      routingKeys: didDoc.service[0].routingKeys,
    };
  }

  private getEndpoint() {
    const connection = this.context.agency && this.context.agency.connection;
    const endpoint = connection && connection.theirDidDoc && connection.theirDidDoc.service[0].serviceEndpoint;
    return endpoint ? `${endpoint}` : `${this.context.config.url}:${this.context.config.port}/msg`;
  }

  private getRoutingKeys() {
    const verkey = this.context.agency && this.context.agency.verkey;
    return verkey ? [verkey] : [];
  }
}

export { ConnectionService };
