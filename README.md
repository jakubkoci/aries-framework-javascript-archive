# Project Description

Main goal of this implementation is to run 2 independent Edge Agents (clients), running on mobile or desktop, which are able to make a connection and send basic messages to each other via Routing Agent with these restrictions:

- Edge Agent is independent on underlying communication layer. It can communicate via either HTTP request-response, WebSockets or Push Notifications.
- Edge Agent can go offline and still receive its messages when goes back to online.
- There should be an option to connect more clients (Edge Agents) to one Routing Agent.
- Prevent correlation.

## Basic Explanation of Implementation

Agent class has method `receiveMessage` which **unpacks** incoming **inboud message** and then pass it to the `dispatch` method. This method just tries to find particular `handler` according to message `@type` attribute. Handler then process the message, calls services if needed and also creates **outbound message** to be send by sender, if it's required by protocol.

If handler returns an outbound message then method `sendMessage` **packs** the message with defined recepient and routing keys. This method also creates **forwardMessage** when routing keys are available. The way an outbound message is send depends on the implementation of MessageSender interface. Outbound message just need to contain all information which is needed for given comminucation (e. g. HTTP endpoint for HTTP protocol).

# Install dependencies

```
yarn
```

# Running tests

Start agency

```
./run.sh agency01
```

Run all tests

```
yarn test
```

Run e2e tests with HTTP routing agency

```
yarn test -t "with agency"
```

Run e2e tests with in memory messaging via RxJS subscriptions (you don't need to start agency for these tests)

```
yarn test -t "agents"
```
