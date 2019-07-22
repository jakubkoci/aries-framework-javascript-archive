import * as dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  label: process.env.WALLET_LABEL,
  walletId: process.env.WALLET_ID,
  walletSeed: process.env.WALLET_SEED,
};
