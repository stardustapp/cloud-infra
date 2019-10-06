const { runWorker, shortenUrl, notify } = require('./_lib');

function processMessage(data) {
  console.log('slackjack webhook data:', JSON.stringify(data));

  const {channel, text, username} = data.payload;
  if (channel && username && text) {

    var linesToSkip = 0;
    if (username === 'plexpy') {
      linesToSkip = 1;
    }

    notify(channel,
        `[\x0307${username}\x0F] `+
        text.replace(/\r/g, '')
          .split('\n').slice(linesToSkip)
          .join(' - ').slice(0, 140));
  }
}

// start working
if (!module.parent) {
  runWorker(processMessage);
}
