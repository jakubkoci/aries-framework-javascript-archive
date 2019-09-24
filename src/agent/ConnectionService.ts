import { Connection, ConnectionState, InitConfig, Agency } from './types';
import { Wallet } from './Wallet';
import { createInvitation } from './messages';

class ConnectionService {
  config: InitConfig;
  wallet: Wallet;
  connections: Connection[] = [];

  constructor(config: InitConfig, wallet: Wallet) {
    this.config = config;
    this.wallet = wallet;
  }

  async createConnectionWithInvitation(agency?: Agency): Promise<Connection> {
    const connection = await this.createConnection(agency);
    const invitationDetails = this.getInvitationDetails(connection, agency);
    const invitation = await createInvitation(invitationDetails);
    connection.state = ConnectionState.INVITED;
    connection.invitation = invitation;
    return connection;
  }

  async createConnection(agency?: Agency): Promise<Connection> {
    const [did, verkey] = await this.wallet.createDid();
    const did_doc = {
      '@context': 'https://w3id.org/did/v1',
      service: [
        {
          id: 'did:example:123456789abcdefghi#did-communication',
          type: 'did-communication',
          priority: 0,
          recipientKeys: [verkey],
          routingKeys: this.getRoutingKeys(agency),
          serviceEndpoint: this.getEndpoint(agency),
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

  private getInvitationDetails(connection: Connection, agency?: Agency) {
    const { verkey } = connection;
    return {
      label: this.config.label,
      recipientKeys: [verkey],
      serviceEndpoint: this.getEndpoint(agency),
      routingKeys: this.getRoutingKeys(agency),
    };
  }

  private getEndpoint(agency?: Agency) {
    const connection = agency && agency.connection;
    return connection ? `${connection.endpoint}` : `${this.config.url}:${this.config.port}/msg`;
  }

  private getRoutingKeys(agency?: Agency) {
    const verkey = agency && agency.verkey;
    return verkey ? [verkey] : [];
  }
}

export { ConnectionService };
