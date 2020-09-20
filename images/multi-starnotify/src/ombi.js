const { runWorker, shortenUrl, notify, storeSpeciman } = require('./_lib');

exports.processMessage = function processMessage(data) {
  console.log('ombi webhook payload:', JSON.stringify(data.payload));
  const {notificationType} = data.payload;

  var channel = '##danopia';
  if (data.parameters) {
    channel = data.parameters.channel || channel;
  }

  var output;
  switch (notificationType) {

    case 'RequestAvailable':
      var {requestedUser, title, type, year} = data.payload;
      switch (type) {

        case 'Movie':
          output = `Now Available: 🎥 \x1F${title}\x0F ${year} `+
          `\x0314- requested by\x0F \x0313${requestedUser}\x0F`;
          break;

        default:
          const speciman = storeSpeciman(`ombi/${notificationType}`, data);
          output = `Received unknown media type ${notificationType} @ ${speciman}`;
      }
      break;

    case 'Test':
      output = `Received Test notification. \x0303It worked!\x0F`;
      break;

    default:
      const speciman = storeSpeciman(`ombi/${notificationType}`, data);
      output = `Received unknown notificationType ${notificationType} @ ${speciman}`;
  }

  if (channel && output) {
    notify(channel, `[\x0307ombi\x0F] `+output);
  }
}
