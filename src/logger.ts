/* eslint-disable no-console */
export default {
  log: (...args: any[]) => {
    console.log(...args);
  },
  logJson: (message: string, json: {}) => {
    console.log(`${message}\n`, JSON.stringify(json, null, 2), '\n');
  },
};
