import express from 'express';
import bodyParser from 'body-parser';
import config from './config';
import logger from './logger';
import { Agent } from './agent/Agent';
import { OutboundMessage, Connection } from './types';

class StorageMessageSender {
  messages: { [key: string]: any } = {};

  async sendMessage(message: OutboundMessage, connection?: Connection) {
    // TODO Store message for given connection
    console.log('Storing message...');
    console.log(message);

    if (connection) {
      if (!connection.theirKey) {
        throw new Error('Trying to save message without theirKey!');
      }

      if (!this.messages[connection.theirKey]) {
        this.messages[connection.theirKey] = [];
      }

      this.messages[connection.theirKey].push(message);
    }
  }

  takeFirstMessage(verkey: Verkey) {
    if (this.messages[verkey]) {
      return this.messages[verkey].shift();
    }
    return null;
  }
}

const PORT = config.port;
const app = express();

const messageSender = new StorageMessageSender();
const agent = new Agent(config, messageSender);

app.use(bodyParser.text());

app.get('/', async (req, res) => {
  const agentDid = agent.getAgentDid();
  res.send(agentDid);
});

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const invitationUrl = await agent.createInvitationUrl();
  res.send(invitationUrl);
});

app.post('/msg', async (req, res) => {
  const message = req.body;
  const packedMessage = JSON.parse(message);
  await agent.receiveMessage(packedMessage);
  res.status(200).end();
});

app.get('/api/connections/:verkey/message', async (req, res) => {
  // TODO Return first message for connection by their verkey.
  const verkey = req.params.verkey;
  const message = messageSender.takeFirstMessage(verkey);
  res.send(message);
});

app.get('/api/connections/:verkey', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return agency connection by their verkey.
  const verkey = req.params.verkey;
  const connection = agent.findConnectionByTheirKey(verkey);
  res.send(connection);
});

app.get('/api/messages', async (req, res) => {
  // TODO This endpoint is for testing purpose only.
  res.send(messageSender.messages);
});

app.listen(PORT, async () => {
  await agent.init();
  await agent.setAgentDid();
  logger.log(`Application started on port ${PORT}`);
});
