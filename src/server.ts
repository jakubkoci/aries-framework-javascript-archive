import express from 'express';
import bodyParser from 'body-parser';
import config from './config';
import logger from './logger';
import * as service from './service';

const PORT = config.port;
const app = express();

app.use(bodyParser.text());

app.get('/', (req, res) => {
  res.json(config);
});

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const { invitation } = await service.createConnectionWithInvitation();
  const encodedInvitation = Buffer.from(JSON.stringify(invitation)).toString('base64');
  const invitationUrl = `https://example.com/ssi?c_i=${encodedInvitation}`;
  res.send(invitationUrl);
});

// Process incomming invitation from inviter as invitee
app.post('/invitation', async (req, res) => {
  const message = req.body;
  const [, encodedInvitation] = message.split('c_i=');
  const invitation = JSON.parse(Buffer.from(encodedInvitation, 'base64').toString());
  await service.recieveMessage(invitation);
  res.status(200).end();
});

app.post('/msg', async (req, res) => {
  const message = req.body;
  const packedMessage = JSON.parse(message);
  await service.recieveMessage(packedMessage);
  res.status(200).end();
});

app.get('/connections', async (req, res) => {
  const connections = JSON.stringify(service.getConnections(), null, 2);
  res.send(connections);
});

app.post('/api/connections/:verkey/send-message', async (req, res) => {
  const verkey = req.params.verkey;
  const content = req.body;
  const connection = service.findByVerkey(verkey);
  if (!connection) {
    throw new Error(`Connection for verkey ${verkey} not found!`);
  }
  const outboundMessage = await service.createBasicMessage(connection, content);
  await service.sendMessage(outboundMessage);
  res.status(200).end();
});

app.get('/api/connections/:verkey/messages', async (req, res) => {
  const verkey = req.params.verkey;
  const messages = JSON.stringify(service.getMessages(verkey), null, 2);
  res.send(messages);
});

app.get('/agency', async (req, res) => {
  const agencyInfo = service.getConfigAsAgency();
  res.json(agencyInfo);
});

app.listen(PORT, async () => {
  await service.init();
  logger.log(`Application started on port ${PORT}`);
});
