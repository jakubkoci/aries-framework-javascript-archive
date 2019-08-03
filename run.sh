#!/bin/bash

AGENT="$1"

if [ "$AGENT" = "alice" ]; then
  PORT=3001
  WALLET_ID=wallet1
  WALLET_SEED=00000000000000000000000000000Test01
  WALLET_LABEL=Alice
  AGENCY_URL=http://localhost:3003
elif [ "$AGENT" = "bob" ]; then
  PORT=3002
  WALLET_ID=wallet2
  WALLET_SEED=00000000000000000000000000000Test02
  WALLET_LABEL=Bob
  AGENCY_URL=http://localhost:3003
elif [ "$AGENT" = "agency" ]; then
  PORT=3003
  WALLET_ID=wallet3
  WALLET_SEED=00000000000000000000000000000Test03
  WALLET_LABEL=Agency
else
  echo "Please specify which agent you want to run. Choose from 'alice' or 'bob'."
  exit 1
fi

PORT=$PORT WALLET_ID=$WALLET_ID WALLET_SEED=$WALLET_SEED WALLET_LABEL=$WALLET_LABEL AGENCY_URL=$AGENCY_URL yarn prod
