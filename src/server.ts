import express from 'express';
import bodyParser from 'body-parser';
import * as service from './service';

const PORT = 3000;
const app = express();

app.use(bodyParser.text());

app.get('/', (req, res) => {
  res.send('Hello World');
});

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const { invitation } = await service.createInvitation();
  const encodedInvitation = Buffer.from(JSON.stringify(invitation)).toString('base64');
  const invitationUrl = `https://example.com/ssi?c_i=${encodedInvitation}`;
  res.send(invitationUrl);
});

// Process incomming invitation from inviter as invitee
app.post('/invitation', async (req, res) => {
  const message = req.body;
  const [, encodedInvitation] = message.split('c_i=');
  const invitation = JSON.parse(Buffer.from(encodedInvitation, 'base64').toString());
  console.log(JSON.stringify(invitation, null, 2));
  const outboundMessage = await service.processMessage(invitation);
  console.log(outboundMessage);
  res.send(outboundMessage);
});

app.post('/msg', async (req, res) => {
  const message = req.body;
  const packedMessage = JSON.parse(message);
  const outboundMessage = await service.processMessage(packedMessage);
  console.log(outboundMessage);
  res.send(outboundMessage);
});

app.get('/connections', async (req, res) => {
  const connections = JSON.stringify(service.getConnections(), null, 2);
  res.send(connections);
});

app.listen(PORT, async () => {
  await service.init();
  console.log(`Application started on port ${PORT}`);
});
