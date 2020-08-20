const { runWorker, shortenUrl, trimText, notify, storeSpeciman } = require('./_lib');
const moment = require('moment');
const multimatch = require('multimatch');

// const orgChannelMap = {
//   'stardustapp': '#stardust',
//   'danopia': '#stardust',
//   'relrod': '#dagd',
//   'noexc': '#noexc',
// };

const channelMessageCapMap = {
//   '#hledger': 8,
//   '#hledger-bots': 8,
//   '#stardust': 5,
//   '##danopia': 5,
};

const commitMsgLengthMap = {
//   '#dagd': 200,
};

exports.processMessage = function processMessage(data) {
  console.log('gitlab webhook data:', JSON.stringify(data));
  const {payload} = data;
  const eventType = data.headers['X-Gitlab-Event'];
  const hookSource = payload.repository
    ? payload.repository.name
    : (payload.organization || payload.user).username;

  var channel;
  var urlHandler = (url) => shortenUrl(url);
  var isBranchRelevant = () => true;
  var isActionRelevant = () => true;

  // if (payload.organization) {
  //   channel = orgChannelMap[payload.organization.login];
  // }
  // if (payload.repository && payload.repository.owner) {
  //   channel = orgChannelMap[payload.repository.owner.login] || channel;
  // }
  if (data.parameters) {
    channel = data.parameters.channel || channel;

    if ('longurl' in data.parameters) {
      urlHandler = (url) => url;
    }

    // Globing for or against a set of patterns
    // Note that the glob engine supports ! so these are redundant.
    const {branch_filter, branch_ignore} = data.parameters;
    if (branch_filter) {
      const patterns = branch_filter.split(',');
      isBranchRelevant = (branch) => multimatch(branch, patterns).length;
    }
    if (branch_ignore) {
      const patterns = branch_ignore.split(',');
      isBranchRelevant = (branch) => !multimatch(branch, patterns).length;
    }

    const {action_filter, action_ignore} = data.parameters;
    if (action_filter) {
      const patterns = action_filter.split(',');
      isActionRelevant = (action) => multimatch(action, patterns).length;
    }
    if (action_ignore) {
      const patterns = action_ignore.split(',');
      isActionRelevant = (action) => !multimatch(action, patterns).length;
    }
  }

  if (!channel) {
    return;
  }
  const maxCommits = channelMessageCapMap[channel] || 3;
  const commitMsgLength = commitMsgLengthMap[channel] || 70;

  var msg;
  switch (eventType) {

  case 'Push Hook':
    // code was pushed

    var noun = (payload.commits.length == 1 ? 'commit' : 'commits');
    const branch = payload.ref.split('/').slice(2).join('/');
    var verb = 'pushed';
    // if (payload.forced) {
    //   verb = '\x0304force-pushed\x0F';
    // }

    // if we have a branch filter, let's check that FIRST
    if (!isBranchRelevant(branch)) {
      console.log('Ignoring irrelevant branch', branch);
      return;
    }

    var info = {
      created: payload.before === '0000000000000000000000000000000000000000',
      deleted: payload.after === '0000000000000000000000000000000000000000',
      pushLink: `${payload.project.web_url}/-/`,
    };

    if (payload.commits.length === 1) {
      info.pushLink += `commit/${payload.after}`;
    } else if (info.created || info.deleted) {
      info.pushLink += `commits/${encodeURIComponent(branch)}/`;
    } else {
      info.pushLink += `compare/${payload.before}...${payload.after}`;
    }

    // are empty pushes even pushes at all?
    if (payload.commits.length === 0) {
      // branch deletion
      if (info.deleted) {
        notify(channel,
            "[\x0313"+payload.repository.name+"\x0F] "+
            "\x0315"+payload.user_username+"\x0F "+
            '\x0305deleted\x0F '+
            "branch \x0306"+branch+"\x0F");
        return;

      // branch creation w/ no new commits
      } else if (info.created) {
        notify(channel,
            "[\x0313"+payload.repository.name+"\x0F] "+
            "\x0315"+payload.user_username+"\x0F "+
            '\x02created\x02 '+
            "branch \x0306"+branch+"\x0F"+suffix+": "+
            "\x0302\x1F"+urlHandler(info.pushLink)+"\x0F");
        return;

      // // force-push without adding anything new
      // } else if (payload.forced) {
      //   notify(channel,
      //       "[\x0313"+payload.repository.name+"\x0F] "+
      //       "\x0315"+payload.user_username+"\x0F "+
      //       '\x0304force-reverted\x0F '+
      //       "\x0306"+branch+"\x0F "+
      //       "to \x0314"+payload.after.slice(0, 7)+"\x0F "+
      //       "(was \x0314"+payload.before.slice(0, 7)+"\x0F)");
      //   return;

      }

      // capture speciians of remaining empty pushes instead of looking broken
      break;
    }

    // handle merges without listing the commits
    var lastCommit = payload.commits[payload.commits.length-1];
    var mergeCommitMatch = lastCommit.title.match(/^Merge branch '([^']+)' into '([^']+)'$/);
    if (mergeCommitMatch && mergeCommitMatch[2] === branch) {
      var baseBranch = mergeCommitMatch[1];
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.user_username+"\x0F "+
          "merged "+(payload.commits.length-1)+" "+
          (payload.commits.length == 2 ? 'commit' : 'commits')+" "+
          "from \x0306"+baseBranch+"\x0F "+
          "into \x0306"+branch+"\x0F: "+
          "\x0302\x1F"+urlHandler(info.pushLink)+"\x0F");
      return;
    }

    // new branches get commented on with a special header, even w/ one commit
    if (info.created) {
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.user_username+"\x0F "+
          "created \x0306"+branch+"\x0F "+
          "with \x02"+payload.commits.length+"\x02 "+
          "new "+noun+": "+
          "\x0302\x1F"+urlHandler(info.pushLink)+"\x0F");

    // shorthand for adding one commit to an existing branch
    } else if (payload.commits.length === 1) {
      const commit = payload.commits[0];

      // only include committer name if different than pusher
      var committerName = '';
      if (commit.author.name != payload.user_name) {
        committerName = " \x0315"+commit.author.name+"\x0F";
      }

      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.user_username+"\x0F "+
          verb+" "+
          "to \x0306"+branch+"\x0F: "+
          "\x0314"+commit.id.slice(0, 7)+"\x0F"+
          committerName+": "+
          trimText(commit.message, commitMsgLength)+"\x0F "+
          "\x0302\x1F"+urlHandler(info.pushLink)+"\x0F");

      // we already sent the commit. don't repeat ourselves.
      return;

    } else {
      // not a new branch, so let's send a normal push message
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.user_username+"\x0F "+
          verb+" "+
          "\x02"+payload.commits.length+"\x02 "+
          'new '+noun+" "+
          "to \x0306"+branch+"\x0F: "+
          "\x0302\x1F"+urlHandler(info.pushLink)+"\x0F");
    }

    // if we haven't bailed yet, we still want to read out the first few commits
    payload.commits
      .slice(0, maxCommits)
      .forEach(commit => {
        // only include committer name if different than pusher
        var committerName = '';
        if (commit.author.name != payload.user_name) {
          committerName = " \x0315"+commit.author.name+"\x0F";
        }

        sleep = (ms, cb) => { setTimeout(cb, ms); };
        sleep.sync(null, 900);

        notify(channel,
            " \x0313"+payload.repository.name+"\x0F/"+
            "\x0306"+branch+"\x0F "+
            "\x0314"+commit.id.slice(0, 7)+"\x0F"+
            committerName+": "+
            trimText(commit.message, commitMsgLength));
      });
    return;


  case 'Job Hook': return;
  case 'Pipeline Hook': return;


  case 'Issue Hook':
  case 'Merge Request Hook':
    var {object_attributes, changes, object_kind} = payload;
    var {action} = object_attributes;

    var type, identifier;
    switch (object_kind) {
      case 'issue':
        type = 'issue';
        identifier = '#'+object_attributes.iid;
        break;
      case 'merge_request':
        type = 'MR';
        identifier = '!'+object_attributes.iid;
        break;
    }
    if (!type) break;

    if (!action) {
      if (!!changes) {
        action = 'update';
      } else break;
    }
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant', type, 'action', action);
      return;
    }

    // try being informative
    var interjection = '';
    var suffix = '';
    var title = ": "+trimText(object_attributes.title, 140)+"\x0F";
    switch (action) {
      case 'open':
        // <user> opened MR !31 from feature-branch into master...
        // <user> opened issue #31...
        interjection = "opened ";
        if (type === 'MR') {
          suffix = " from \x0306"+object_attributes.source_branch+"\x0F"+
            " into \x0306"+object_attributes.target_branch+"\x0F";
        }
        break;

      case 'close':
        title = '';
        interjection = 'closed ';
        break;

      case 'reopen':
        interjection = 'reopened ';
        break;

      case 'merge':
        interjection = 'closed and merged ';
        if (type === 'MR') {
          suffix = " into \x0306"+object_attributes.target_branch+"\x0F";
        }
        title = '';
        break;

      case 'update':
        // <user> changed the body of MR !31...
        const fields = Object.keys(changes)
          .filter(x => !x.startsWith('updated_') && !x.startsWith('last_edited_'));
        if (fields.length > 0) {
          interjection = 'changed the ' + fields.join(', ') + ' of ';
          title = '';
        }
        break;
    }
    if (!interjection) break;

    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.user.username+"\x0F "+
        interjection+
        type+" \x02"+identifier+"\x02"+suffix+": "+
        trimText(object_attributes.title, 70)+"\x0F "+
        "\x0302\x1F"+urlHandler(object_attributes.url)+"\x0F");
    return;


  case 'Note Hook':
    var {repository, user, object_attributes} = payload;

    var type, identifier;
    var styling = `\x02`;
    switch (object_attributes.noteable_type) {
      case 'Commit':
        type = 'commit';
        styling = `\x0314`;
        identifier = payload.commit.id.slice(0, 7);
        break;
      case 'Issue':
        type = 'issue';
        identifier = '#'+payload.issue.iid;
        break;
      case 'MergeRequest':
        type = 'MR';
        identifier = '!'+payload.merge_request.iid;
        break;
    }
    if (!type) break;

    var interjection = '';
    if (object_attributes.type == 'DiscussionNote') {
      interjection = 'in a discussion ';
    }

    // user commented on issue #423: body... <url>
    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+user.username+"\x0F "+
        "commented "+interjection+"on "+type+" "+styling+identifier+"\x0F: "+
        trimText(object_attributes.note, 140)+"\x0F "+
        "\x0302\x1F"+urlHandler(object_attributes.url)+"\x0F");
    return;


  case 'Wiki Page Hook':
    var {project, user, object_attributes} = payload;
    var {action, url, title, message} = object_attributes;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant wiki action', action);
      return;
    }

    notify(channel,
        "[\x0313"+project.name+"\x0F] "+
        "\x0315"+user.username+"\x0F changed the wiki: "+
        `${action} \x0306${title}\x0F`+
        " \x0302\x1F"+urlHandler(url)+"\x0F");
    return;

  }

  const speciman = storeSpeciman(`gitlab/${eventType}`, data);
  // notify(channel, "[\x0313"+hookSource+"\x0F] Got Gitlab event of unhandled type: " + eventType);
  notify('#stardust-noise', `Got Gitlab event for ${channel} of unhandled type "${eventType}": ${speciman}`);
}

// start working
if (!module.parent) {
  runWorker(exports.processMessage);
}
