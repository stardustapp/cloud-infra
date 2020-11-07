const filesize = require('filesize');
const moment = require('moment');
require('moment-timezone');
const { shortenUrl, notify } = require('./_lib');

exports.processMessage = function processMessage(data) {
  console.log('sonarr webhook payload:', JSON.stringify(data.payload));
  const {eventType} = data.payload;

  var channel = '##danopia';
  if (data.parameters) {
    channel = data.parameters.channel || channel;
  }

  var output;
  switch (eventType) {

    case 'Download':
      var {episodes, episodeFile, isUpgrade, series} = data.payload;
      var {releaseGroup, quality} = episodeFile;

      var episodeNames = episodes
        .map(ep => `\x0315${ep.title}\x0F`)
        .join(` \x0314/\x0F `);

      var upgradeTag = '';
      if (isUpgrade) {
        upgradeTag = ` (\x0304upgrade!\x0F)`;
      }

      var groupField = '';
      if (releaseGroup) {
        groupField = `\x0314-\x0F \x0306${releaseGroup}\x0F `;
      }

      output = `📥 \x1F${series.title}\x0F `+ // inbox emoji
          `${buildEpisodeString(episodes, true)} `+
          groupField+
          `\x0314@\x0F \x0313${quality}\x0F${upgradeTag}: `+
          episodeNames.slice(0, 170);
      break;

    case 'Grab':
      var {episodes, release, series} = data.payload;
      var {quality, releaseGroup, releaseTitle, indexer, size} = release;

      output = `🕓 \x1F${series.title}\x0F `+ // clock emoji
          `${buildEpisodeString(episodes, false)} `+
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
    notify(channel, `[\x0307sonarr\x0F] `+output);
  }
  // if (channel === '##danopia' && eventType == 'Download' && output) {
  //   notify('##purdue', output);
  // }

  //"\x0302\x1F"+shortenUrl(payload.build_url)+"\x0F");
}

// s02e04
// s02e04 / s02e04 / s02e04 / s02e04
function buildEpisodeString(episodes, showAirTags) {
  // single-season check
  const firstSeason = episodes[0].seasonNumber;
  if (episodes.every(ep => ep.seasonNumber === firstSeason)) {
    // width check
    if (episodes.length > 4) {
      // contiguous check
      var thisEpNum = episodes[0].episodeNumber;
      if (episodes.every(ep => thisEpNum++ == ep.episodeNumber)) {

        // it's def a big range, so let's short-circuit :D
        const firstEp = episodes[0];
        const lastEp = episodes.slice(-1)[0];
        var airTag = '';
        if (showAirTags) {
          airTag = ` \x0314[aired \x0315${formatAirDate(firstEp.airDateUtc)} thru \x0315${formatAirDate(lastEp.airDateUtc)}\x0314]`;
        }
        return `\x0303s${padNum(firstSeason, '\x0309')}\x0303e${padNum(firstEp.episodeNumber, '\x0309')}\x0303..e${padNum(lastEp.episodeNumber, '\x0309')}${airTag}\x0F`;
      }
    }

    // todo: be really smart here lol
  }

  return episodes
    .map(ep => {
      var airTag = '';
      if (showAirTags && episodes.length <= 4) {
        airTag = ` \x0314[aired \x0315${formatAirDate(ep.airDateUtc)}\x0314]`;
      }
      return `\x0303s${padNum(ep.seasonNumber, '\x0309')}\x0303e${padNum(ep.episodeNumber, '\x0309')}${airTag}\x0F`;
    }).join(` \x0314/\x0F `);
}

// s03e04, not s3e4
// pass a color code to put it before the first nonzero digit
function padNum(num, sep='') {
  if (num < 10) return '0'+sep+num;
  return sep+num;
}

// utc string => ircfragment. old dates are just date/time.
// as they're more recent, the output is more excited.
const { VIEWING_TIMEZONE } = process.env;
function formatAirDate(timestamp) {
  m = moment(timestamp).tz(VIEWING_TIMEZONE);
  fullFmt = m.format('M/D/YY H:mm').replace(':00', 'h');

  const oldCutoff = moment().subtract(1, 'month');
  const futureCutoff = moment().add(1, 'day');
  if (oldCutoff > m || futureCutoff < m) {
    return fullFmt;
  }

  const dayCutoff = moment().subtract(1, 'days');
  if (dayCutoff > m) {
    const daysAgo = moment().diff(m, 'days');
    return `${fullFmt} (~${daysAgo} days ago)`;
  }

  const hotCutoff = moment().subtract(2, 'hours');
  if (hotCutoff > m) {
    const hoursAgo = moment().diff(m, 'hours');
    return `\x02${hoursAgo} hours ago\x02 (${fullFmt})`;
  }

  // it's HOT!
  const hoursAgo = moment().diff(m, 'minutes');
  return `\x02${hoursAgo} minutes ago!\x02 (${fullFmt})`;
}
