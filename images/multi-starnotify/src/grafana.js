const { notify } = require('./_lib');

exports.processMessage = async function processMessage(data) {
  console.log('grafana webhook data:', JSON.stringify(data));

  const {payload} = data;

  var channel;
  var instance;
  if (data.parameters) {
    channel = decodeURIComponent(data.parameters.channel || channel);
    instance = decodeURIComponent(data.parameters.instance || instance);
  }
  if (!channel || !instance) {
    return;
  }

  var state = payload.state;
  var name = payload.ruleName;
  var message = payload.message;
  var statusText = null;

  switch (state) {
    case 'ok':
      statusText = '\x0303\x02'+state+'\x0F';
      break;
    case 'pending':
      statusText = '\x0307\x02'+state+'\x0F';
      break;
    case 'alerting':
      statusText = '\x0305\x02'+state+'\x0F';
      break;
    case undefined:
      throw new Error('grafana body had undefined state');
    default:
      console.log('unhandled grafana state: '+state);
  }

  await notify(
    channel,
    "[\x0307"+'grafana'+"\x0F/\x0306"+instance+"\x0F] "+
    "\x0313"+name+"\x0F "+
    "is now "+statusText+
    `\x0314: ${message}\x0F`);
  return;
}
