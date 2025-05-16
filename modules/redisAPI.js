import { createClient } from 'redis';

// const client = await createClient()
//   .on('error', (err) => console.log('Redis Client Error', err))
//   .connect();

// await client.set('key', 'value');
// const value = await client.get('key');
// await client.disconnect();

const setKeyValue = async (key, value) => {
  return await client.get('key');
};
const getValue = async (key) => {
  await client.set('key', 'value');
};

module.exports = {
  setKeyValue,
  getValue,
};
