import { Connection, ConnectionState, InitConfig } from '../types';
import { Wallet } from './Wallet';
import { createInvitation, MessageType } from './messages';

class ConnectionService {
  config: InitConfig;
  wallet: Wallet;
  connections: Connection[] = [];

  constructor(config: any, wallet: Wallet) {
    this.config = config;
    this.wallet = wallet;
  }

  async createConnectionWithInvitation(): Promise<Connection> {
    const connection = await this.createConnection();
    const invitationDetails = this.getInvitationDetails(connection);
    const invitation = await createInvitation(invitationDetails);
    connection.state = ConnectionState.INVITED;
    connection.invitation = invitation;
    return connection;
  }

  async createConnection(): Promise<Connection> {
    const [did, verkey] = await this.wallet.createDid();
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

  private getInvitationDetails(connection: Connection) {
    const { verkey } = connection;
    return {
      label: this.config.label,
      recipientKeys: [verkey],
      serviceEndpoint: this.getEndpoint(),
      routingKeys: this.getRoutingKeys(),
    };
  }

  private getEndpoint() {
    const { routingConnection } = this.config;
    return routingConnection ? `${routingConnection.endpoint}` : `${this.config.url}:${this.config.port}/msg`;
  }

  private getRoutingKeys() {
    const { agencyVerkey, routingConnection } = this.config;
    return agencyVerkey ? [agencyVerkey] : [];
  }
}

export { ConnectionService };
