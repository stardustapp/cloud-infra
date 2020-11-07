const AWS = require('aws-sdk');
const { notify, sleep } = require('./_lib');

const allProcessors = [
  { queue: 'hooks-from-bugsnag', ...require('./bugsnag.js'), passive: true },
  { queue: 'hooks-from-cloudwatch', ...require('./cloudwatch.js'), passive: true },
  { queue: 'hooks-from-grafana', ...require('./grafana.js'), passive: true },
  { queue: 'hooks-from-github', ...require('./github.js'), passive: true },
  { queue: 'hooks-from-gitlab', ...require('./gitlab.js'), passive: true },
  { queue: 'hooks-from-mailgun', ...require('./mailgun.js'), passive: true },
  { queue: 'hooks-from-ombi', ...require('./ombi.js'), passive: true },
  { queue: 'hooks-from-radarr', ...require('./radarr.js'), passive: true },
  { queue: 'hooks-from-slackjack', ...require('./slackjack.js'), passive: true },
  { queue: 'hooks-from-sonarr', ...require('./sonarr.js'), passive: true },
  { queue: 'hooks-from-travisci', ...require('./travisci.js'), passive: true },
  { queue: 'hooks-from-upcheck', ...require('./upcheck.js'), passive: true },

  // Special queue that reroutes to the proper processor
  { queue: 'skyhook-webhook-inbound.fifo', async processMessage(data) {
    const fakeQueueName = `hooks-from-${data.hookFlavor}`;
    const processor = allProcessors.find(x => x.queue === fakeQueueName);
    if (processor) {
      console.log(`Rerouting general inbound hook to ${fakeQueueName}`);
      return processor.processMessage(data);
    }

    await notify('#stardust-noise',
      `Payload received for unregistered hook '${data.hookFlavor}'`);
    return false; // don't delete message
  }},
];

// start working
if (!module.parent) {
  if (!process.env.AWS_REGION) throw new Error(
    `Missing AWS configuration!`);

  const sqs = new AWS.SQS();
  const {SQS_QUEUE_URL_BASE} = process.env;

  async function doOneWork(processor) {
    const queueUrl = SQS_QUEUE_URL_BASE + processor.queue;

    const {Messages} = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
    }).promise();

    if (Messages && Messages.length) {
      const msg = Messages[0];
      console.log("Processing message", msg.MessageId);
      const result = await processor.processMessage(JSON.parse(msg.Body));

      if (result !== false) {
        await sqs.deleteMessage({
          QueueUrl: queueUrl,
          ReceiptHandle: msg.ReceiptHandle,
        }).promise();
      }
      await sleep(1000);
    }
  }

  // make sure we have a queue
  if (!SQS_QUEUE_URL_BASE) {
    console.log("I don't have SQS info in my environment! Pls fix");
    process.exit(2);
  }

  // the actual loop
  for (const processor of allProcessors) {
    if (processor.passive) continue;

    (async () => {
      console.log(`Starting main SQS loop for`, processor.queue);
      while (true) {
        try {
          await doOneWork(processor);
        } catch (err) {
          await notify('#stardust-noise',
            processor.queue+' CRASH: '+
            err.stack.slice(0, 400).replace(/\n/g, '␤')); // NL char
          await sleep(10*1000);
        }
      }
    })().then(res => {
      console.log(`SQS loop for ${processor.queue} ended somehow?`);
      console.log(res);
      process.exit(0);
    }, err => {
      console.log(`SQS loop for ${processor.queue} crashed:`);
      console.log(err);
      process.exit(1);
    });
  }

};
