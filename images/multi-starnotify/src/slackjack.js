const { shortenUrl, notify } = require('./_lib');

exports.processMessage = function processMessage(data) {
  console.log('slackjack webhook data:', JSON.stringify(data));

  const {channel, text, username, url} = data.payload;
  if (channel && username && text) {

    var linesToSkip = 0;
    if (username === 'plexpy') {
      linesToSkip = 1;
    }

    const urlSuffix = url
      ? `\x0F \x0302\x1F${shortenUrl(url)}\x0F`
      : '';

    notify(channel,
        `[\x0307${username}\x0F] `+
        text.replace(/\r/g, '')
          .split('\n').slice(linesToSkip)
          .join(' - ').slice(0, 140)+
        urlSuffix);
  }
}
