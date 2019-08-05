import { Connection, ConnectionState } from '../types';
import { Wallet } from './Wallet';

class ConnectionService {
  config: any;
  wallet: Wallet;
  connections: Connection[] = [];

  constructor(config: any, wallet: Wallet) {
    this.config = config;
    this.wallet = wallet;
  }

  async createConnectionWithInvitation(): Promise<Connection> {
    const connection = await this.createConnection();
    const invitation = await this.createInvitation(connection);
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
          routingKeys: [],
          serviceEndpoint: `${this.config.url}:${this.config.port}/msg`,
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

  private async createInvitation(connection: Connection) {
    const { verkey } = connection;
    const invitation = {
      '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation',
      '@id': '12345678900987654321',
      label: this.config.label,
      recipientKeys: [verkey],
      serviceEndpoint: `${this.config.url}:${this.config.port}/msg`,
      routingKeys: [],
    };
    return invitation;
  }
}

export { ConnectionService };
