const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this._caching = true;
  this._hashkey = JSON.stringify(options.key || '');
  return this;
}

mongoose.Query.prototype.exec = async function() {
  if (!this._caching) return exec.apply(this, arguments);

  const key = JSON.stringify({
    ...this.getQuery(),
    collection: this.mongooseCollection.name
  })

  const cacheValue = await client.hget(this._hashkey, key);

  if (cacheValue) {
    const doc = JSON.parse(cacheValue);
    console.log('Getting from cache!');

    return Array.isArray(doc) 
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }

  const results = await exec.apply(this, arguments);
  client.hset(this._hashkey, key, JSON.stringify(results), 'EX', 10);

  return results; 
}

module.exports = {
  clearHash(hashkey) {
    client.del(JSON.stringify(hashkey));
  }
}