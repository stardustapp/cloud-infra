const { runWorker, shortenUrl, notify } = require('./_lib');

const accountChannelMap = {
  'Danopia': '##danopia',
}

exports.processMessage = function processMessage(data) {
  console.log('bugsnag webhook data:', JSON.stringify(data));

  const {payload} = data;
  var urlHandler = (url) => url;

  var channel;
  if (payload.account && payload.account.name) {
    channel = accountChannelMap[payload.account.name] || channel;
  }
  if (data.parameters) {
    channel = decodeURIComponent(data.parameters.channel || channel);

    if ('shorturl' in data.parameters) {
      urlHandler = (url) => shortenUrl(url);
    }
  }
  if (!channel) {
    return;
  }

  const {account, project, trigger, error} = payload;
  const context = "[\x0313bugsnag\x0F/\x0306"+project.name+"\x0F] ";
  switch (trigger.type) {
    case 'firstException':
      notify(channel, context+
          trigger.message+" \x0314in "+error.context+"\x0F: "+
          error.exceptionClass.split('.').slice(-1)[0]+" "+error.message+" "+
          "\x0302\x1F"+urlHandler(error.url)+"\x0F");
      break;

    default:
      notify(channel, context+
          "\x0314"+trigger.type+"\x0F: "+trigger.message);
  }
}

// start working
if (!module.parent) {
  runWorker(exports.processMessage);
}
