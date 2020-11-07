const filesize = require('filesize');
const { trimText, notify } = require('./_lib');

exports.processMessage = async function processMessage(data) {
  console.log('mailgun webhook data:', JSON.stringify(data));

  const {payload} = data;
  const {recipient, sender, from, timestamp} = payload;
  const subject = trimText(payload.subject, 150) || '(No subject)';
  const body = payload['stripped-text'] || '(No body)';
  const origSender = payload.Sender || payload.sender;

  var channel;
  if (recipient.startsWith('irc-freenode-')) {
    channel = '#' + recipient.split('@')[0].split('-').slice(2).join('-');
  }
  if (!channel) {
    return;
  }

  if (sender.endsWith('@nds.fedex.com')) {
    const trackingMatch = body.match(/Tracking number\W+:(\d+)/);
    const updateMatch = body.match(/Activity\/Location\r\n  ([0-9\/]+ [0-9:]+ [ap]m)\W+([^\r\n]+)\r\n\W+([^\r\n]+)\r\n/);
    if (trackingMatch && updateMatch) {
      await notify(channel,
        "[\x0313fedex\x0F/\x0306"+trackingMatch[1]+"\x0F] "+
             "\x02"+updateMatch[2]+"\x02 "+
             "near \x0306"+updateMatch[3]+"\x0F "+
             "\x0315(at "+updateMatch[1]+")\x0F");
      return;
    }
  }

  // Salesforce/AbuseHQ abuse complaints (sent by DigitalOcean)
  const doSubjectMatch = payload.subject.match(/\[([^\]]+)\] Ticket (#[0-9]+: [^:]+)/);
  const doLinkMatch = body.match(/https:\/\/[^/]+.abusehq.net\/share\/.+/);
  if (doSubjectMatch && doLinkMatch) {
    await notify(channel,
      "[\x0313abuse\x0F/\x0306"+doSubjectMatch[1]+"\x0F] "+
      doSubjectMatch[2]+" "+
      "\x0302\x1F"+doLinkMatch[0]+"\x0F");
    return;
  }

  let contents = body;
  const urlMatch = body.match(/^.+:\/\/.+$/m);
  if (urlMatch) {
    contents = urlMatch[0];
  }

  let trailer = '';
  let attachments = Object
    .keys(payload)
    .filter(x => payload[x].filename)
    .map(x => payload[x])
    .map(x => {
      let str = `\x0315${x.filename||x.name}\x0314`;
      const sizeHeader = x.headers.find(y => y[0].toLowerCase() === 'content-length');
      if (sizeHeader && parseInt(sizeHeader[1]) > 0) {
        str += ` (${filesize(parseInt(sizeHeader[1]))})`;
      }
      return str;
    });
  if (attachments.length > 0) {
    const attachS = attachments.length > 1 ? 's' : '';
    trailer += ` \x0314/ \x02${attachments.length}\x02 attachment${attachS}: ${attachments.join(', ')}`;
  }

  await notify(channel,
    "[\x0313email\x0F/\x0306"+origSender+"\x0F] "+
    trimText(subject, 150)+" \x0315/ "+trimText(contents, 150)+trailer+"\x0F");
}
