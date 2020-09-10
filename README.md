# Utils for AWS SDK

## Installation

```shell script
# NPM
npm install aws-sdk-utils --save

```

## DynamoDB Utils for DocumentClient

# ddbFind(client, params)

Like query or scan but managing the LastEvaluatedKey value. Furthermore filter, map and reduce funtions over Items results.

# ddbBatchGet(client, params)

Like batchGet but managing the UnprocessedKeys values.

# ddbBatchGets(client, params)

Like ddbBatchGet but without limit of RequestItems.

# ddbBatchWrite(client. params)

Like batchWrite but managing the UnprocessedKeys values.

# ddbBatchWrites(client, params)

Like ddbBatchWrite but without limit of RequestItems.

## Example

Get and Delete 1000 Items from dynamodb table with hash 'JobId' and range 'Id'.

```typescript
const { ddbFind, ddbBatchWrites } = require('aws-sdk-utils');
const AWS = require('aws-sdk');

const client = new AWS.DynamoDB.DocumentClient();

// Some code ...

const TableName = 'JobsTasksTable';
let params = {
    TableName,
    KeyConditionExpression: '#JobId = :JobId',
    ExpressionAttributeNames: { '#JobId': 'JobId' },
    ExpressionAttributeValues: { ':JobId': 'some value' },
    Limit: 1000,
    Map: item => ({ JobId: item.JobId, Id: item.Id }) // Map Items into Item Key
};

const { Items: Keys } = await ddbFind(client, params);

// Delete Items
params = { RequestItems: {} };
params.RequestItems[TableName] = Keys.map(Key => ({ DeleteRequest: { Key } }));

await ddbBatchWrites(client, params);

```
