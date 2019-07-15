import express from 'express';

const PORT = 3000;
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.get('/invitation', (req, res) => {
  const invitation = {
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation',
    '@id': '12345678900987654321',
    label: 'Alice',
    recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
    serviceEndpoint: 'https://example.com/endpoint',
    routingKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
  };

  const encodedInvitation = Buffer.from(JSON.stringify(invitation)).toString('base64');
  const invitationUrl = `https://example.com/ssi?c_i=${encodedInvitation}`;
  res.send(invitationUrl);
});

app.listen(PORT, () => {
  console.log(`Application started on port ${PORT}`);
});
