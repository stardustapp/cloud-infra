const { shortenUrl, notify } = require('./_lib');

const orgChannelMap = {
  'stardustapp': '#stardust',
  'danopia': '#stardust',
  'relrod': '#dagd',
  'noexc': '#noexc',
}

exports.processMessage = function processMessage(data) {
  console.log('travisci webhook data:', JSON.stringify(data));

  const {payload} = data;
  var urlHandler = (url) => shortenUrl(url);

  var channel;
  if (payload.repository && payload.repository.owner_name) {
    channel = orgChannelMap[payload.repository.owner_name] || channel;
  }
  if (data.parameters) {
    channel = data.parameters.channel || channel;

    if ('longurl' in data.parameters) {
      urlHandler = (url) => url;
    }
  }

  if (!channel) {
    return;
  }

  // Color-code the status
  var text = payload.status_message;
  console.log('travis hook with state', payload.state,
      'smessage', payload.status_message,
      'rmessage', payload.result_message);
  switch (payload.state) {
    case 'passed':
    case 'fixed':
      text = '\x0303'+text+'\x0F';
      break;
    case 'failed':
    case 'broken':
    case 'errored':
      text = '\x0305'+text+'\x0F';
      break;
    case 'started':
      text = '\x0307'+text+'\x0F';
      break;
    default:
      console.warn('WARN: travisci job did weird thing', payload.state);
  }

  let timeText = '';
  if (payload.state !== 'started') {
    timeText = " in "+(Math.round(payload.duration/60*10)/10)+" minutes";
  }

  notify(channel,
      "[\x0313"+payload.repository.name+"\x0F] "+
      "\x0314"+payload.commit.slice(0, 7)+"\x0F "+
      "Build #"+payload.number+" "+
      text+" "+
      "on \x0306"+payload.branch+"\x0F"+timeText+": "+
      "\x0302\x1F"+urlHandler(payload.build_url)+"\x0F");
}
