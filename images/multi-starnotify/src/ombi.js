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

    case 'NewRequest':
      var {requestedUser, title, type, year} = data.payload;
      switch (type) {

        case 'Movie':
          output = `New Request from \x0313${requestedUser.split('@')[0]}\x0F: `+
              `🎥 \x1F${title}\x0F ${year}`;
          break;

        default:
          const speciman = storeSpeciman(`ombi/${notificationType}`, data);
          output = `Received unknown media type ${notificationType} @ ${speciman}`;
      }
      break;

    case 'RequestApproved':
      var {requestedUser, title, type, year} = data.payload;
      switch (type) {

        case 'Movie':
          output = `Request from \x0313${requestedUser.split('@')[0]}\x0F is \x02Approved\x02: `+
              `🎥 \x1F${title}\x0F ${year}`;
          break;

        default:
          const speciman = storeSpeciman(`ombi/${notificationType}`, data);
          output = `Received unknown media type ${notificationType} @ ${speciman}`;
      }
      break;

    case 'RequestAvailable':
      var {requestedUser, title, type, year} = data.payload;
      switch (type) {

        case 'Movie':
          output = `Now Available: 🎥 \x1F${title}\x0F ${year} `+
          `\x0314- requested by\x0F \x0313${requestedUser.split('@')[0]}\x0F`;
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
