const { shortenUrl, notify } = require('./_lib');

const orgChannelMap = {
  'danopia': '#stardust-noise',
};

exports.processMessage = function processMessage(data) {
  console.log('uptimerobot webhook data:', JSON.stringify(data));

  const {parameters, payload} = data;
  let channel = orgChannelMap[payload.organization_name];
  if (parameters) {
    channel = parameters.channel || channel;
  }
  if (!channel) {
    return;
  }

  if (data.userAgent.includes('happy.danopia')) {
    const {
      notification_type, // PROBLEM
      hostname, // elrod.me
      service_desc, // da.gd-ssl
      state, // CRITICAL
      output, // HTTP CRITICAL: HTTP/1.1 200 OK - string Show the user agent that y... not found on https://da.gd:443/help - 2938 bytes in 0.157 second response time
      nagios_server, // metrics01
      host_acked_by, //
      service_acked_by, //
    } = data.payload;

    // Color-code the status
    let statusText = state;
    switch (statusText) {
      case 'OK':
      case 'UP':
        statusText = '\x0303\x02'+statusText+'\x0F';
        break;
      case 'WARNING':
        statusText = '\x0307\x02'+statusText+'\x0F';
        break;
      case 'CRITICAL':
      case 'DOWN':
        statusText = '\x0305\x02'+statusText+'\x0F';
        break;
      case undefined:
        throw new Error('nagios body had undefined status');
      default:
        console.log('WARN: nagios job did weird thing');
    }

    let context = "\x0313"+service_desc+"\x0F "+
        `${notification_type}: `+
        "\x0302\x1F"+hostname+"\x0F";
    if (!service_desc) {
      context = "\x0302\x1F"+hostname+"\x0F "+
          `${notification_type}: `+
          "Host";
    }

    notify(channel,
        "[\x0307"+'nagios'+"\x0F/\x0306"+nagios_server+"\x0F] "+
        context+" is now "+statusText+
        `\x0314: ${output}\x0F`);
    return;
  }


  if (data.userAgent.includes('freshping.io')) {
    const {organization_name} = data.payload;
    const {
      check_state_name, http_status_code, check_name,
      application_name, request_url, response_time,
    } = data.payload.webhook_event_data;

    // Color-code the status
    let statusText = check_state_name;
    switch (statusText) {
      case 'Available':
        statusText = '\x0303\x02'+statusText+'\x0F';
        break;
      case 'Not Responding':
        statusText = '\x0305\x02'+statusText+'\x0F';
        break;
      case undefined:
        throw new Error('freshping body had undefined status');
      default:
        console.log('WARN: freshping job did weird thing');
    }

    // Status of <b>foo bar</b> (http://asdiofjasdiofjsdiofjsdio.com/) has changed to <red>Down</red> (Connection Timeout)
    // TODO: report old alerts - webhook_event_created_on as ISO
    notify(channel,
        "[\x0307"+'freshping'+"\x0F/\x0306"+organization_name+"\x0F] "+
        "\x0313"+check_name+"\x0F "+
        "\x0302\x1F"+request_url+"\x0F "+
        "is now "+statusText+" "+
        `\x0314(took ${response_time}ms)\x0F`);
    return;
  }

  if (data.userAgent.includes('uptimerobot.com')) {
    // Color-code the status
    var statusText = parameters.alertTypeFriendlyName;
    switch (parameters.alertTypeFriendlyName) {
      case 'Up':
        statusText = '\x0303\x02'+statusText+'\x0F';
        break;
      case 'Down':
        statusText = '\x0305\x02'+statusText+'\x0F';
        break;
      case undefined:
        throw new Error('uptimerobot body had undefined status');
      default:
        console.warn('WARN: uptimerobot job did weird thing', parameters.alertTypeFriendlyName);
    }

    let timeText = '';
    if (parameters.alertFriendlyDuration) {
      timeText = " after "+parameters.alertFriendlyDuration+" of downtime";
    }

    // Status of <b>foo bar</b> (http://asdiofjasdiofjsdiofjsdio.com/) has changed to <red>Down</red> (Connection Timeout)
    // TODO: report old alerts - alertDateTime in epoch seconds

    function decode(x) {
      return x.replace(/&#(\d\d);/g, (_,x) => String.fromCharCode(x));
    }
    notify(channel,
        "[\x0307"+'uptimerobot'+"\x0F] "+
        "\x0313"+decode(parameters.monitorFriendlyName)+"\x0F "+
        "\x0302\x1F"+parameters.monitorURL+"\x0F "+
        "is now "+statusText+timeText+": "+
        "\x0306"+decode(parameters.alertDetails)+"\x0F");
    return;
  }

  if (data.userAgent.includes('Google-Alerts') && data.payload.version === '1.2') {
    const {
      incident_id, started_at, state, ended_at,
      resource, resource_id, resource_name,
      policy_name, condition_name, url, summary,
    } = data.payload.incident;

    // Color-code the status
    var statusText = state;
    let timeText = '';
    switch (state) {
      case 'closed':
        statusText = '\x0303\x02'+statusText+'\x0F';
        const minutesOpen = (ended_at - started_at) / 60;
        timeText = ` after ${Math.round(minutesOpen*100)/100} minutes`;
        break;
      case 'open':
        statusText = '\x0305\x02'+statusText+'\x0F';
        break;
      default:
        throw new Error(`Google-Alerts body had unknown state ${state}`);
    }

    notify(channel,
        "[\x0307"+'gcloud'+"\x0F] "+
        "\x0313"+policy_name+"\x0F "+
        "incident "+statusText+timeText+": "+
        "\x0302\x1F"+url+"\x0F "+
        "\x0306"+summary+"\x0F");
    return;
  }

  notify(channel, 'got unprogrammed /upcheck hook');
  throw new Error(`TODO: got unprogrammed /upcheck hook`);
}
