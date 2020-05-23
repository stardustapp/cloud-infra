const { spawn } = require('child_process');
const querystring = require('querystring');

const Sync = require('sync');
const AWS = require('aws-sdk');
const clients = require('restify-clients');

// Allow injecting 'starnotify' options e.g. server URL
const process = require('process');
const {STARNOTIFY_FLAGS} = process.env;
const extraFlags = STARNOTIFY_FLAGS ? STARNOTIFY_FLAGS.split(' ') : [];
console.log('Using extra starnotify opts:', extraFlags);

// shell out to starnotify
exports.notify = function notify(channel, message) {
  console.log('Sending to', channel, '-', message);
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

// execute a main loop to process SQS messages in a blocking fashion
exports.runWorker = function runWorker(processMessage) {
  const sqs = new AWS.SQS();
  const {SQS_QUEUE_URL} = process.env;

  function doOneWork() {
    const {Messages} = sqs.receiveMessage.sync(sqs, {
      QueueUrl: SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
    });

    if (Messages && Messages.length) {
      const msg = Messages[0];
      console.log("Processing message", msg.MessageId);
      processMessage(JSON.parse(msg.Body));
      sqs.deleteMessage.sync(sqs, {
        QueueUrl: SQS_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle,
      });

      sleep = (cb) => { setTimeout(cb, 1000); };
      sleep.sync();
    }
  }

  // make sure we have a queue
  if (!SQS_QUEUE_URL) {
    console.log("I don't have SQS info in my environment! Pls fix");
    process.exit(2);
  }

  // the actual loop
  Sync(() => {
    console.log(`Starting main SQS loop`)
    while (true) {
      doOneWork();
    }
  }, (err, res) => {
    console.log(`Main SQS loop ended`);
    console.log(res || err);
    process.exit(err ? 1 : 0);
  });
};


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
          if (data.includes('://')) cb(null, data)
          else throw new Error(
            `da.gd response seemed bad: ${JSON.stringify(data)}`);
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
