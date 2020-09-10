'use strict';

// DynamoDB utils
const ddbFind = async (client, params, acc = { Items: [], ScannedCount: 0 }) => {
  if (params.Map && params.Reduce) {
    throw new Error('Only Map or Reduce is permited');
  }
  if (params.Reduce && !params.InitialValue) {
    throw new Error('Reduce InitialValue is required');
  }
  if (params.Reduce && !acc.Accumulator) {
    acc.Accumulator = params.InitialValue;
  }

  const data = (params.KeyConditionExpression) ? await client.query(params).promise() : await client.scan(params).promise();

  acc.ScannedCount += data.ScannedCount;

  if (params.Filter) {
    data.Items = data.Items.filter(params.Filter);
  }

  if (params.Map) {
    data.Items = await Promise.all(data.Items.map(params.Map));
  }

  if (params.Reduce) {
    acc.Accumulator = await data.Items.reduce(params.Reduce, acc.Accumulator);
  } else {
    acc.Items = acc.Items.concat(data.Items);
    acc.Count = acc.Items.length;
  }

  if (params.Limit) {
    params.Limit -= data.Items.length;
  }

  if (data.LastEvaluatedKey) {
    if (params.Limit === undefined || params.Limit > 0) {
      params.ExclusiveStartKey = data.LastEvaluatedKey;
      await ddbFind(client, params, acc);
    } else {
      acc.LastEvaluatedKey = data.LastEvaluatedKey;
    }
  }

  return acc;
};

/**
 * 
 * @param {*} client
 * @param {*} params
 */
const ddbBatchGet = async (client, params) => {
  const data = await client.batchGet(params).promise();
  if (Object.keys(data.UnprocessedKeys).length) {
    params.RequestItems = data.UnprocessedKeys;
    const res = await ddbBatchGet(client, params);
    for (const t in res.Responses) {
      if (!data.Responses[t]) { data.Responses[t] = []; }
      data.Responses[t] = data.Responses[t].concat(res.Responses[t]);
    }
  }
  return data;
};

/**
 * 
 * @param {*} client
 * @param {*} tableKeys
 */
const ddbBatchGets = async (client, params) => {
  const res = { Responses: {} };

  const tableKeys = [];
  const RequestItems = {};
  for (const t in params.RequestItems) {
    params.RequestItems[t].Keys.map(k => tableKeys.push({ t, k }));
    const { Keys, ...RequestItem } = params.RequestItems[t];
    RequestItems[t] = RequestItem;
    res.Responses[t] = [];
  }

  const len = tableKeys.length / 100;
  for (let x = 0, i = 0; x < len; i += 100, x++) {
    params.RequestItems = {};
    tableKeys.slice(i, i + 100).map(ti => {
      if (!params.RequestItems[ti.t]) {
        params.RequestItems[ti.t] = RequestItems[ti.t];
        params.RequestItems[ti.t].Keys = [];
      }
      params.RequestItems[ti.t].Keys.push(ti.k);
    });
    const data = await ddbBatchGet(client, params);
    for (const t in data.Responses) {
      res.Responses[t] = res.Responses[t].concat(data.Responses[t]);
    }
    // TODO
  }

  return res;
};

/**
 * 
 * @param {*} client 
 * @param {*} params 
 */
const ddbBatchWrite = async (client, params) => {
  const data = await client.batchWrite(params).promise();
  if (Object.keys(data.UnprocessedItems).length) {
    params.RequestItems = data.UnprocessedItems;
    await ddbBatchWrite(client, params);
  }
  return data;
};

const ddbBatchWrites = async (client, params) => {
  const res = {};

  const tableItems = [];
  for (const t in params.RequestItems) {
    for (const i of params.RequestItems[t]) {
      if (i.DeleteRequest) {
        tableItems.push({ t, k: i.DeleteRequest.Key });
      } else if (i.PutRequest) {
        tableItems.push({ t, i: i.PutRequest.Item });
      }
    }
  }

  const len = tableItems.length / 25;
  for (let x = 0, i = 0; x < len; i += 25, x++) {
    params.RequestItems = {};
    tableItems.slice(i, i + 25).map(ti => {
      if (!params.RequestItems[ti.t]) {
        params.RequestItems[ti.t] = [];
      }
      if (ti.k) {
        params.RequestItems[ti.t].push({ DeleteRequest: { Key: ti.k } });
      } else if (ti.i) {
        params.RequestItems[ti.t].push({ PutRequest: { Item: ti.i } });
      }
    });
    await ddbBatchWrite(client, params);
    // TODO
  }

  return res;
}

module.exports.ddbFind = ddbFind;
module.exports.ddbBatchGet = ddbBatchGet;
module.exports.ddbBatchGets = ddbBatchGets;
module.exports.ddbBatchWrite = ddbBatchWrite;
module.exports.ddbBatchWrites = ddbBatchWrites;
