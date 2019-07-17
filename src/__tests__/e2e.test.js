/* eslint-disable */
const fetch = require('node-fetch');

test('make a connection', async () => {
  const invitation = await get('http://localhost:3000/invitation');
  const connectinRequest = await post('http://localhost:3000/invitation', invitation);
  const connectionResponse = await post('http://localhost:3000/msg', connectinRequest);
  const ack = await post('http://localhost:3000/msg', connectionResponse);
  const connectionsResponse = await get('http://localhost:3000/connections');
  console.log(connectionsResponse);

  const connections = JSON.parse(connectionsResponse);

  expect(connections.length).toBe(2);
  expect(connections[0].did).toBe(connections[1].theirDid);
  expect(connections[0].verkey).toBe(connections[1].theirKey);
  expect(connections[1].did).toBe(connections[0].theirDid);
  expect(connections[1].verkey).toBe(connections[0].theirKey);
});

async function get(url) {
  const response = await fetch(url);
  return response.text();
}

async function post(url, body) {
  const response = await fetch(url, { method: 'POST', body });
  return response.text();
}
