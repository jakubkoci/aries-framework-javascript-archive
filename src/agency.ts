import express from 'express';
import bodyParser from 'body-parser';
import config from './config';
import logger from './logger';
import { Agent } from './agent/Agent';

class StorageMessageSender {
  async sendMessage(message: any) {
    // TODO Store message for given connection
    console.log('Storing message...');
    console.log(message);
  }
}

const PORT = config.port;
const app = express();

const walletConfig = {
  walletId: config.walletId,
  walletSeed: config.walletSeed,
};

const agent = new Agent(config.label, walletConfig, new StorageMessageSender());

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
  // TODO return first message for connection by verkey
  const message = '';
  res.send(message);
});

app.listen(PORT, async () => {
  await agent.init();
  await agent.setAgentDid();
  logger.log(`Application started on port ${PORT}`);
});
