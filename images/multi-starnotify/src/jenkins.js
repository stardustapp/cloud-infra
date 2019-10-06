const { runWorker, shortenUrl, notify } = require('./_lib');
const Sync = require('sync');

const WebSocket = require('ws');
const fetch = require('node-fetch');

const ws = new WebSocket('ws://apt:32257/jenkins');

ws.on('open', () => {
  console.log('connected to websocket');
});

ws.on('message', (data) => {
  Sync(() => {
    processMessage(JSON.parse(data));
  }, (err, res) => {
    if (err) {
      console.warn(`WARN: jenkins-starnotify CRASHED!`, err);
      process.exit(2); // TODO: metric/bell instead
    }
  });
});

function processMessage(data) {
  console.log('jenkins hook data:', data);
  const {project, number, status} = data;
  console.log(project, number, status);

  if (project.startsWith('HABSim-')) {
    var subName = project.slice(7);
    var sendMessage = false;
    if (subName.startsWith('Package-')) {
      sendMessage = status !== 'START' && status !== 'SUCCESS';
    } else {
      sendMessage = status !== 'START';
    }
    if (sendMessage) {
      notify('#noexc', `Jenkins - ${subName} #${number} - ${status}`)
    } else {
      notify('#noexc')
    }

  } else if (project.startsWith('SeallyRacing-')) {
    var subName = project.slice(13);
    var sendMessage = false;
    if (subName === 'BuildDist') {
      sendMessage = status !== 'START' && status !== 'SUCCESS';
    } else {
      sendMessage = status !== 'START';
    }
    if (sendMessage) {
      const jobUrl = `https://jenkins.apt.danopia.net/job/${project}/${number}/`;
      notify('#seally-racing', `Jenkins - ${subName} #${number} - ${status} (${shortenUrl(jobUrl)})`)
    } else {
      notify('#seally-racing')
    }

  } else {
    var sendMessage = false;
    if (project.endsWith('-Build') || project === 'Star-Utils-Package' || project === 'Star-Utils-Upload') {
      sendMessage = status !== 'START' && status !== 'SUCCESS';
    } else {
      sendMessage = status !== 'START';
    }

    var channel = '##danopia';
    if (project.startsWith('Star-') || project.startsWith('Stardust-') || project.startsWith('Sky')) {
      channel = '#stardust';
    }

    if (sendMessage) {
      var text = 'did a thing';
      switch (status) {
        case 'START': text = 'has started 😓'; break;
        case 'SUCCESS': text = '\x0303succeeded\x0F 😊'; break;
        case 'FAILURE': text = '\x0304failed\x0F 😞'; break;
        default:
          console.warn('WARN: jenkins job', project, number, 'did weird thing', status);
      }
      const jobUrl = `https://jenkins.apt.danopia.net/job/${project}/${number}/`;

      notify(channel,
          "[\x0313"+project+"\x0F] "+
          "Build \x02#"+number+"\x02 "+
          text+" "+
          "\x0302\x1F"+shortenUrl(jobUrl)+"\x0F");

      if (status == 'FAILURE' && project == 'Star-Utils-Build') {
        fetch(`http://apt:32645/job/${project}/${number}/consoleText`)
          .then(x => x.text())
          .then(body => {
            var match = body.match(/^# .+\n(.+)\nBuild step/m);
            if (match) {
              processGoErrors({
                output: match[1],
                pathPrefix: 'src/github.com/stardustapp/core/',
                channel: '#stardust',
                notifPrefix: "[\x0313"+project+"\x0F\x02#"+number+"\x02] ",
              });
            }
          });
      }
    } else {
      notify(channel)
    }
  }
}

function processGoErrors(opts) {
  opts.output.split('\n').slice(0, 3).forEach(line => {
    if (line.startsWith(opts.pathPrefix)) {
      line = line.slice(opts.pathPrefix.length);
    }
    notify(opts.channel, opts.notifPrefix + line);
  })
}

setInterval(() => {
  const {readyState} = ws;
  if (readyState > 1) {
    console.log('ERROR: websocket readyState was', readyState, '- exiting');
    process.exit();
  }
}, 5000);
