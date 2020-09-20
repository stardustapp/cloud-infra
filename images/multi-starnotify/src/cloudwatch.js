const { runWorker, shortenUrl, notify } = require('./_lib');

exports.processMessage = function processMessage(data) {
  console.log('cloudwatch SNS data:', JSON.stringify(data));
  const channel = process.env.NOTIFICATION_CHANNEL || '#stardust-noise';

  const {Type, MessageId, TopicArn, Subject, Message, Timestamp} = data.payload;
  // also signature and unsub stuff
  switch (Type) {
    case 'SubscriptionConfirmation':
      return notify(channel, `SNS Subscription, confirm here: ${data.payload.SubscribeURL}`);
    case 'Notification':
      break;
    default:
      return notify(channel, `Received SNS '${Type}' from ${TopicArn}. "${Subject||''}"`);
  }
  console.log('cloudwatch SNS message body:', Message);

  const {
    AlarmName, AlarmDescription, Trigger,
    NewStateValue, NewStateReason, StateChangeTime, OldStateValue,
    AWSAccountId, Region,
  } = JSON.parse(Message);

  // determine AWS IDs
  const regionId = TopicArn.split(':')[3]; // "Region" is the pretty name :(
  const awsConsoleUrl = `https://console.aws.amazon.com/cloudwatch/home?region=${regionId}`;
  const alarmUrl = `${awsConsoleUrl}#alarm:alarmFilter=ANY;name=${encodeURIComponent(AlarmName)}`;

  // Color-code the status
  const stateColor = ({
    'ALARM': '\x0304', // red
    'OK': '\x0303', // green
  })[NewStateValue];

  // Try making a shorter description
  var longDesc = "\x0314"+NewStateReason+"\x0F";
  // make sure there's nothing fancy going on, so we can handle it
  if (Trigger.EvaluationPeriods === 1 && Trigger.StatisticType === 'Statistic') {
    const comparisonSymbol = ({
      GreaterThanOrEqualToThreshold: '>=',
      GreaterThanThreshold: '>',
      LessThanOrEqualToThreshold: '<=',
      LessThanThreshold: '<',
    })[Trigger.ComparisonOperator] || Trigger.ComparisonOperator;

    longDesc = `The ${Trigger.Statistic.toLowerCase()} of \`${Trigger.MetricName}\``;
    longDesc += ` over ${Math.round(Trigger.Period/60)} minutes`;
    // SNS msg doesn't include value field, so try to parse it
    const newValueMatch = NewStateReason.match(/ \[([0-9\-.]+) /)
    if (newValueMatch) {
      longDesc += ` was \`${+newValueMatch[1]}\`,`;
    }
    longDesc += ` alarms when \`${comparisonSymbol} ${Trigger.Threshold}\``;
  }

  notify(channel,
      "[\x0313aws\x0F/"+
      "\x0306"+regionId+"\x0F] "+
      stateColor+
        '\x02'+NewStateValue+'\x02: '+
        AlarmName+'\x0F '+
      '- '+longDesc+' '+
      "\x0302\x1F"+shortenUrl(alarmUrl)+"\x0F"
      )
}

// start working
if (!module.parent) {
  runWorker(exports.processMessage);
}
