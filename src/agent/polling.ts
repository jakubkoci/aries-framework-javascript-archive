import logger from './logger';

export async function poll(fn: any, fnCondition: any, ms: number) {
  let result = await fn();
  while (fnCondition(result)) {
    await wait(ms);
    result = await fn();
  }
  return result;
}

export function wait(ms = 1000) {
  return new Promise(resolve => {
    logger.log(`waiting ${ms} ms...`);
    setTimeout(resolve, ms);
  });
}
