const { spawn } = require('child_process');
const querystring = require('querystring');

const fetch = require('node-fetch');
const AWS = require('aws-sdk');

// Allow injecting 'starnotify' options e.g. server URL
const process = require('process');
const {STARNOTIFY_FLAGS} = process.env;
const extraFlags = STARNOTIFY_FLAGS ? STARNOTIFY_FLAGS.split(' ') : [];
console.log('Using extra starnotify opts:', extraFlags);

const sqs = new AWS.SQS();
const s3 = new AWS.S3();

// await sleep(1000);
exports.sleep = (ms) => new Promise(ok => setTimeout(ok, ms));

// shell out to starnotify
exports.notify = async function notify(channel, message) {
  console.log('Sending to', channel, '-', message);

  // Certain channels should use the new bot
  if ([
    '##danopia',
    '#dagd', '#dagd-ops',
    '#relrodtest',
    '#robigalia',
    '#hledger', '#hledger-bots',
    '#stardust-test', '#stardust-noise',
  ].includes(channel)) {
    let network = 'libera';
    if (channel == '#robigalia') network = 'oftc';
    const payload = JSON.stringify({ "ver": 1,
      "protocol": "irc", "network": network,
      "target": channel, "message": message,
    });

    const {SQS_QUEUE_URL_BASE, SQS_QUEUE_IRC_OUTBOUND} = process.env;
    await sqs.sendMessage({
      QueueUrl: SQS_QUEUE_URL_BASE + SQS_QUEUE_IRC_OUTBOUND,
      MessageBody: payload,
      MessageDeduplicationId: Math.random().toString().slice(2),
      MessageGroupId: ['irc', 'freenode', channel].map(encodeURIComponent).join('/')
    }).promise();

    return;
  }

  const app = spawn('starnotify', [
    ...extraFlags,
    '-irc-channel', channel,
    '-message', message || '',
  ]);
  app.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });
  app.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
  });

  const code = await new Promise(ok => {
    app.on('close', ok);
  });

  console.log(`child process exited with code ${code}!`);
  if (code !== 0) throw new Error(
    `'starnotify' process exited with code ${code}`);
};

exports.storeSpeciman = async function storeSpeciman(key, body) {
  const fullKey = `skyhook-specimans/${key}-${new Date().toISOString()}.json`;
  const url = `s3://stardust/${fullKey}`;
  console.log('storing speciman to', url);
  await s3.putObject({
    Bucket: 'stardust',
    Key: fullKey,
    Body: JSON.stringify(body, null, 2),
    ContentType: 'application/json',
  }).promise();
  return url;
}

// support URL shortening through da.gd
// never fails, just returns the long URL instead
const dagdUrl = process.env.DAGD_ROOT_URL || 'https://da.gd';
exports.shortenUrl = async function shortenUrl(url) {
  const fullUrl = new URL('/s?' + querystring.encode({url}), dagdUrl);
  try {

    const resp = await fetch(fullUrl, {
      headers: {
        accept: 'text/plain',
      },
    });
    if (resp.status !== 200) {
      throw new Error(`da.gd returned status code ${resp.status} ${resp.statusText}`);
    }

    const text = await resp.text();
    if (!text.includes('://')) {
      throw new Error(`da.gd response seemed bad: ${JSON.stringify(text)}`);
    }

    return text.trim();

  } catch (err) {
    console.log('WARN: could not shorten URL', url, '-', err);
    return url;
  }
};

exports.trimText = (text, maxLen) => {
  const cleaned = (text||'(n/a)').replace(/[\x00\x02\x03\x0F\x1F\x07\r]/g, '');
  const lines = cleaned.split('\n');
  const [firstLine] = lines;

  if (lines.length > 1 || cleaned.length > maxLen) {
    return firstLine.slice(0, maxLen-2)+'...';
  }
  return firstLine;
}
