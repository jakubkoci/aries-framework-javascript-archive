import * as dotenv from 'dotenv';
dotenv.config();

export default {
  label: process.env.WALLET_LABEL || '',
  walletId: process.env.WALLET_ID || '',
  walletSeed: process.env.WALLET_SEED || '',
  port: process.env.PORT || 3000,
  url: process.env.AGENCY_URL || '',
  did: 'VsKV7grR1BUE29mG2Fm2kX', // TODO Replace with value from app config
  didSeed: '0000000000000000000000000Forward', // TODO Replace with value from app config
};
