const { spawn } = require('child_process');
const querystring = require('querystring');

const AWS = require('aws-sdk');
const clients = require('restify-clients');

// Allow injecting 'starnotify' options e.g. server URL
const process = require('process');
const {STARNOTIFY_FLAGS} = process.env;
const extraFlags = STARNOTIFY_FLAGS ? STARNOTIFY_FLAGS.split(' ') : [];
console.log('Using extra starnotify opts:', extraFlags);

const sqs = new AWS.SQS();
const s3 = new AWS.S3();

// shell out to starnotify
exports.notify = function notify(channel, message) {
  console.log('Sending to', channel, '-', message);

  // Certain channels should use the new bot
  if (['##danopia', '#robigalia', '#stardust-test'].includes(channel)) {
    const payload = JSON.stringify({ "ver": 1,
      "protocol": "irc", "network": "freenode",
      "target": channel, "message": message,
    });

    const {SQS_QUEUE_URL_BASE, SQS_QUEUE_IRC_OUTBOUND} = process.env;
    sqs.sendMessage.sync(sqs, {
      QueueUrl: SQS_QUEUE_URL_BASE + SQS_QUEUE_IRC_OUTBOUND,
      MessageBody: payload,
      MessageDeduplicationId: Math.random().toString().slice(2),
      MessageGroupId: ['irc', 'freenode', channel].map(encodeURIComponent).join('/')
    });

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

  const code = (cb => {
    app.on('close', (code) => {
      cb(null, code);
    });
  }).sync();

  console.log(`child process exited with code ${code}!`);
  if (code !== 0) throw new Error(
    `'starnotify' process exited with code ${code}`);
};

exports.storeSpeciman = function storeSpeciman(key, body) {
  const fullKey = `skyhook-specimans/${key}-${new Date().toISOString()}.json`;
  const url = `s3://stardust/${fullKey}`;
  console.log('storing speciman to', url);
  s3.putObject.sync(s3, {
    Bucket: 'stardust',
    Key: fullKey,
    Body: JSON.stringify(body, null, 2),
    ContentType: 'application/json',
  });
  return url;
}

// support URL shortening through da.gd
// never fails, just returns the long URL instead
const dagdClient = clients.createStringClient({
  url: process.env.DAGD_ROOT_URL || 'https://da.gd',
});
exports.shortenUrl = function shortenUrl(url) {
  const fullPath = '/s?' + querystring.encode({url});
  try {
    return (cb => {
      dagdClient.get(fullPath, (err, req, res, data) => {
        // TODO: record latency
        if (err) { cb(err); }
        else if (res.statusCode === 200) {
          if (data.includes('://')) cb(null, data.trim())
          else cb(new Error(
            `da.gd response seemed bad: ${JSON.stringify(data)}`));
        }
        else { cb(new Error(`da.gd returned status code ${res.statusCode}`)); }
      });
    }).sync();
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
