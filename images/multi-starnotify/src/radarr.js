const filesize = require('filesize');
const moment = require('moment');
require('moment-timezone');
const { notify } = require('./_lib');

exports.processMessage = async function processMessage(data) {
  console.log('radarr webhook payload:', JSON.stringify(data.payload));
  const {eventType} = data.payload;

  var channel = '##danopia';
  if (data.parameters) {
    channel = data.parameters.channel || channel;
  }

  var output;
  switch (eventType) {

    case 'Download':
      var {movie, movieFile, remoteMovie, isUpgrade} = data.payload;
      var {releaseGroup, quality} = movieFile;

      var upgradeTag = '';
      if (isUpgrade) {
        upgradeTag = ` (\x0304upgrade!\x0F)`;
      }

      var groupField = '';
      if (releaseGroup) {
        groupField = `\x0314-\x0F \x0306${releaseGroup}\x0F `;
      }

      output = `📥 \x1F${movie.title}\x0F ${remoteMovie.year} `+ // inbox emoji
          `\x0314[released \x0315${formatReleaseDate(movie.releaseDate)}\x0314] `+
          groupField+
          `\x0314@\x0F \x0313${quality}\x0F${upgradeTag}`;
      break;

    case 'Grab':
      var {release, movie} = data.payload;
      var {quality, releaseGroup, releaseTitle, indexer, size} = release;

      output = `🕓 \x1F${movie.title}\x0F `+ // clock emoji
          `\x0314-\x0F \x0313${filesize(size)}\x0F `+
          `\x0314@\x0F \x0315${indexer}\x0F`+
          `: \x0302${releaseTitle}\x0F`;
      break;

    case 'Test':
      output = `Received Test notification. \x0303It worked!\x0F`;
      break;

    default:
      output = `Received unknown eventType ${eventType}`;
  }

  if (channel && output) {
    await notify(channel, `[\x0307radarr\x0F] `+output);
  }
  // if (channel === '##danopia' && eventType == 'Download' && output) {
  //   await notify('##purdue', output);
  // }

  //"\x0302\x1F"+shortenUrl(payload.build_url)+"\x0F");
}

// utc string => ircfragment. old dates are just date/time.
// as they're more recent, the output is more excited.
const { VIEWING_TIMEZONE } = process.env;
function formatReleaseDate(timestamp) {
  m = moment(timestamp).tz(VIEWING_TIMEZONE);
  fullFmt = m.format('M/D/YY');

  const oldCutoff = moment().subtract(1, 'year');
  const futureCutoff = moment().add(1, 'day');
  if (oldCutoff > m || futureCutoff < m) {
    // movie is 6+ months old, or future
    return fullFmt;
  }

  const hotCutoff = moment().subtract(1, 'weeks');
  if (hotCutoff > m) {
    // movie is 0.5-6 months old
    const monthsAgo = moment().diff(m, 'months');
    return `${fullFmt} (~${monthsAgo} months ago)`;
  }

  // it's HOT!
  return `\x02this week!\x02 (${fullFmt})`;
}
