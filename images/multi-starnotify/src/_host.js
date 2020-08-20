const Sync = require('sync');
const AWS = require('aws-sdk');
const { runWorker, notify } = require('./_lib');
const sleep = (ms, cb) => { setTimeout(cb, ms); };

const allProcessors = [
  { queue: 'hooks-from-bugsnag', ...require('./bugsnag.js') },
  { queue: 'hooks-from-cloudwatch', ...require('./cloudwatch.js') },
  { queue: 'hooks-from-grafana', ...require('./grafana.js') },
  { queue: 'hooks-from-github', ...require('./github.js') },
  { queue: 'hooks-from-gitlab', ...require('./gitlab.js') },
  { queue: 'hooks-from-mailgun', ...require('./mailgun.js') },
  { queue: 'hooks-from-radarr', ...require('./radarr.js') },
  { queue: 'hooks-from-slackjack', ...require('./slackjack.js') },
  { queue: 'hooks-from-sonarr', ...require('./sonarr.js') },
  { queue: 'hooks-from-travisci', ...require('./travisci.js') },
  { queue: 'hooks-from-upcheck', ...require('./upcheck.js') },
];

// start working
if (!module.parent) {
  if (!process.env.AWS_REGION) throw new Error(
    `Missing AWS configuration!`);

  const sqs = new AWS.SQS();
  const {SQS_QUEUE_URL_BASE} = process.env;

  function doOneWork(processor) {
    const queueUrl = SQS_QUEUE_URL_BASE + processor.queue;

    const {Messages} = sqs.receiveMessage.sync(sqs, {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
    });

    if (Messages && Messages.length) {
      const msg = Messages[0];
      console.log("Processing message", msg.MessageId);
      processor.processMessage(JSON.parse(msg.Body));

      sqs.deleteMessage.sync(sqs, {
        QueueUrl: queueUrl,
        ReceiptHandle: msg.ReceiptHandle,
      });
      sleep.sync(null, 1000);
    }
  }

  // make sure we have a queue
  if (!SQS_QUEUE_URL_BASE) {
    console.log("I don't have SQS info in my environment! Pls fix");
    process.exit(2);
  }

  // the actual loop
  for (const processor of allProcessors) {
    Sync(() => {
      console.log(`Starting main SQS loop for`, processor.queue);
      while (true) {
        try {
          doOneWork(processor);
        } catch (err) {
          notify('#stardust-noise',
            processor.queue+' CRASH: '+
            err.stack.slice(0, 400).replace(/\n/g, '␤')); // NL char
          sleep.sync(null, 10*1000);
        }
      }
    }, (err, res) => {
      console.log(`SQS loop for ${processor.queue} ended somehow?`);
      console.log(res || err);
      process.exit(err ? 1 : 0);
    });
  }

};
