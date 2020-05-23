const { runWorker, shortenUrl, trimText, notify } = require('./_lib');
const moment = require('moment');
const multimatch = require('multimatch');

const orgChannelMap = {
  'stardustapp': '#stardust',
  'danopia': '#stardust',
  'relrod': '#dagd',
  'noexc': '#noexc',
};

const channelMessageCapMap = {
  '#hledger': 8,
  '#hledger-bots': 8,
  '#stardust': 5,
  '##danopia': 5,
};

const commitMsgLengthMap = {
  '#dagd': 200,
};

exports.processMessage = function processMessage(data) {
  console.log('github webhook data:', JSON.stringify(data));
  const {payload} = data;
  const eventType = data.headers['X-GitHub-Event'];

  var channel;
  var urlHandler = (url) => shortenUrl(url);
  var isBranchRelevant = () => true;
  var isActionRelevant = () => true;
  var hasBors = false;
  var isBors = () => false;

  if (payload.organization) {
    channel = orgChannelMap[payload.organization.login];
  }
  if (payload.repository && payload.repository.owner) {
    channel = orgChannelMap[payload.repository.owner.login] || channel;
  }
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

    // Accept a bors username for special handling
    const {bors} = data.parameters;
    if (bors) {
      hasBors = true;
      isBors = (name) => name.toLowerCase() == bors.toLowerCase();
    }
  }

  if (!channel) {
    return;
  }
  const maxCommits = channelMessageCapMap[channel] || 3;
  const commitMsgLength = commitMsgLengthMap[channel] || 70;

  var msg;
  switch (eventType) {

  case 'push':
    // code was pushed

    var noun = (payload.commits.length == 1 ? 'commit' : 'commits');
    const branch = payload.ref.split('/').slice(2).join('/');
    var verb = 'pushed';
    if (payload.forced) {
      verb = '\x0304force-pushed\x0F';
    }

    // if we have a branch filter, let's check that FIRST
    if (!isBranchRelevant(branch)) {
      console.log('Ignoring irrelevant branch', branch);
      return;
    }

    // projects using bors don't normally care about push unless it's out-of-band to default
    if (hasBors && !(branch == payload.repository.default_branch && !isBors(payload.pusher.name))) {
      console.log('Ignoring non-default branch', branch, 'from', payload.pusher.name);
      return;
    }

    // are empty pushes even pushes at all?
    if (payload.commits.length === 0) {
      // branch deletion
      if (payload.deleted) {
        notify(channel,
            "[\x0313"+payload.repository.name+"\x0F] "+
            "\x0315"+payload.pusher.name+"\x0F "+
            '\x0305deleted\x0F '+
            "branch \x0306"+branch+"\x0F");
        return;

      // branch creation w/ no new commits
      } else if (payload.created) {
        // say what branch it's based off
        var suffix = '';
        if (payload.base_ref) {
          // whine a lil bit if github can do this
          if (payload.base_ref === payload.ref) {
            notify('#stardust', 'halp, i just got an empty github branch creation based on itself');
          }

          var baseBranch = payload.base_ref.split('/').slice(2).join('/');
          suffix = ` based on \x0306${baseBranch}\x0F`;
        }

        notify(channel,
            "[\x0313"+payload.repository.name+"\x0F] "+
            "\x0315"+payload.pusher.name+"\x0F "+
            '\x02created\x02 '+
            "branch \x0306"+branch+"\x0F"+suffix+": "+
            "\x0302\x1F"+urlHandler(payload.compare)+"\x0F");
        return;

      // force-push without adding anything new
      } else if (payload.forced) {
        const [prevHash, newHash] = payload.compare.split('/').slice(-1)[0].split('...');
        notify(channel,
            "[\x0313"+payload.repository.name+"\x0F] "+
            "\x0315"+payload.pusher.name+"\x0F "+
            '\x0304force-reverted\x0F '+
            "\x0306"+branch+"\x0F "+
            "to \x0314"+newHash.slice(0, 7)+"\x0F "+
            "(was \x0314"+prevHash.slice(0, 7)+"\x0F)");
        return;
      }
    }

    // handle merges without listing the commits
    // (if we got this far, there are nonzero commits in the payload)
    if (payload.base_ref) {
      var baseBranch = payload.base_ref.split('/').slice(2).join('/');
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.pusher.name+"\x0F "+
          "merged "+(payload.commits.length-1)+" "+
          (payload.commits.length == 2 ? 'commit' : 'commits')+" "+
          "from \x0306"+baseBranch+"\x0F "+
          "into \x0306"+branch+"\x0F: "+
          "\x0302\x1F"+urlHandler(payload.compare)+"\x0F");
      return;
    }

    // bors pushes PRs into staging, let's make a nice message for it
    if (isBors(payload.pusher.name) /*&& branch === 'staging'*/ && payload.commits.length) {
      const lastCommit = payload.commits.slice(-1)[0];
      const mergeMatch = lastCommit.message.match(/^Merge #(\d+)\n\n\d+: (.+)/);
      if (isBors(lastCommit.committer.name) && mergeMatch) {
        // we definitely have bors staging a PR merge
        const pullNum = +mergeMatch[1];
        const pullUrl = payload.repository.html_url+'/pull/'+pullNum;

        notify(channel,
            "[\x0313"+payload.repository.name+"\x0F] "+
            "\x0315"+payload.pusher.name+"\x0F "+
            "merged "+(payload.commits.length-1)+" "+
            (payload.commits.length == 2 ? 'commit' : 'commits')+" "+
            "into \x0306"+branch+"\x0F "+
            "from PR \x02#"+pullNum+"\x02: "+
            trimText(mergeMatch[2], 140)+' '+
            "\x0302\x1F"+urlHandler(pullUrl)+"\x0F");
        return;
      }
    }

    // new branches get commented on with a special header, even w/ one commit
    if (payload.created) {
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.pusher.name+"\x0F "+
          "created \x0306"+branch+"\x0F "+
          "with \x02"+payload.commits.length+"\x02 "+
          "new "+noun+": "+
          "\x0302\x1F"+urlHandler(payload.compare)+"\x0F");

    // shorthand for adding one commit to an existing branch
    } else if (payload.commits.length === 1) {
      const commit = payload.commits[0];

      // only include committer name if different than pusher
      var committerName = '';
      if (commit.committer.username != payload.pusher.name) {
        committerName = " \x0315"+commit.committer.name+"\x0F";
      }

      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.pusher.name+"\x0F "+
          verb+" "+
          "to \x0306"+branch+"\x0F: "+
          "\x0314"+commit.id.slice(0, 7)+"\x0F"+
          committerName+": "+
          trimText(commit.message, commitMsgLength)+"\x0F "+
          "\x0302\x1F"+urlHandler(payload.compare)+"\x0F");

      // we already sent the commit. don't repeat ourselves.
      return;

    } else {
      // not a new branch, so let's send a normal push message
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.pusher.name+"\x0F "+
          verb+" "+
          "\x02"+payload.commits.length+"\x02 "+
          'new '+noun+" "+
          "to \x0306"+branch+"\x0F: "+
          "\x0302\x1F"+urlHandler(payload.compare)+"\x0F");
    }

    // if we haven't bailed yet, we still want to read out the first few commits
    payload.commits
      .slice(0, maxCommits)
      .forEach(commit => {
        // only include committer name if different than pusher
        var committerName = '';
        if (commit.committer.username != payload.pusher.name) {
          committerName = " \x0315"+commit.committer.name+"\x0F";
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

  case 'issues':
    var {action} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    // try being informative
    var interjection = '';
    switch (true) {

      case !!payload.changes:
        // <user> changed the body of issue #31...
        interjection = 'the ' +
          Object.keys(payload.changes).join(', ') +
          ' of ';
        break;

      case !!payload.label:
        // <user> unlabeled help-wanted on issue #31...
        // <user> labeled help-wanted on issue #31...
        interjection = "\x0306"+payload.label.name+"\x0F on ";
        break;

      case payload.action.includes('milestone') && !!payload.issue.milestone:
        // <user> [de]milestoned v1.0 on issue #31...
        interjection = "\x0306"+payload.issue.milestone.title +"\x0F on ";
        break;
    }

    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.sender.login+"\x0F "+
        payload.action+" "+
        interjection+
        "issue \x02#"+payload.issue.number+"\x02: "+
        trimText(payload.issue.title, 70)+"\x0F "+
        "\x0302\x1F"+urlHandler(payload.issue.html_url)+"\x0F");
    return;

  case 'pull_request':
    var {action, pull_request} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    // try being informative
    var interjection = '';
    var suffix = '';
    switch (true) {

      case !!payload.changes:
        // <user> changed the body of PR #31...
        interjection = 'the ' +
          Object.keys(payload.changes).join(', ') +
          ' of ';
        break;

      case action === 'synchronize':
        // drop when not verbose
        //if (verbosity < 4)
        return;
        // <user> synchronized fix-it for PR #31...
        action = 'synchronized';
        interjection = "\x0306"+pull_request.base.ref+"\x0F for ";
        break;

      case action === 'opened':
        // <user> opened new PR #31 with 3 commits from feature-branch...
        interjection = "new ";
        var noun = (pull_request.commits == 1 ? 'commit' : 'commits');
        suffix = " with "+pull_request.commits+" "+noun+
            " from \x0306"+pull_request.head.label+"\x0F";
        break;

      case action === 'closed' && pull_request.merged:
        // <user> closed and merged PR #31 into master...
        interjection = "and merged ";
        suffix = " into \x0306"+pull_request.base.ref+"\x0F";
        break;

      case !!payload.label:
        // <user> unlabeled help-wanted on PR #31...
        // <user> labeled help-wanted on PR #31...
        interjection = "\x0306"+payload.label.name+"\x0F on ";
        break;

      case payload.action.includes('milestone') && !!pull_request.milestone:
        // <user> [de]milestoned v1.0 on PR #31...
        interjection = "\x0306"+pull_request.milestone.title +"\x0F on ";
        break;
    }

    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.sender.login+"\x0F "+
        action+" "+
        interjection+
        "PR \x02#"+pull_request.number+"\x02"+suffix+": "+
        trimText(pull_request.title, 70)+"\x0F "+
        "\x0302\x1F"+urlHandler(pull_request.html_url)+"\x0F");
    return;

  case 'milestone':
    var {milestone, action, sender, repository} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F "+
        action+" milestone "+
        "\x0306"+milestone.title +"\x0F, "+
        "due on \x02"+moment.utc(milestone.due_on).calendar()+"\x02: "+
        trimText(milestone.description, 140)+"\x0F "+
        "\x0302\x1F"+urlHandler(milestone.html_url)+"\x0F");
    return;

  case 'label':
    var {label, action, sender, repository} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    // name changes are special
    if (payload.changes && payload.changes.name) {
      // <user> renamed label needs:one to needs:two
      notify(channel,
          "[\x0313"+repository.name+"\x0F] "+
          "\x0315"+sender.login+"\x0F "+
          "renamed label "+
          "\x0306"+payload.changes.name.from +"\x0F "+
          "to \x0306"+label.name +"\x0F");
      return;
    }

    // <user> created label needs:one
    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F "+
        action+" label "+
        "\x0306"+label.name +"\x0F");
    return;

  case 'commit_comment':
    var {action, repository, sender, comment} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    var subject = 'commit '+
      "\x0314"+comment.commit_id.slice(0, 7)+"\x0F";

    // special syntax: user commented on issue #423: body... <url>
    if (action === 'created') {
      notify(channel,
          "[\x0313"+repository.name+"\x0F] "+
          "\x0315"+sender.login+"\x0F "+
          "commented on "+subject+": "+
          trimText(comment.body, 140)+"\x0F "+
          "\x0302\x1F"+urlHandler(comment.html_url)+"\x0F");
      return;
    }

    // basic syntax
    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F "+
        action+" a comment on "+subject+": "+
        "\x0302\x1F"+urlHandler(comment.html_url)+"\x0F");
    return;

  case 'issue_comment':
    var {action, repository, sender, issue, comment} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    var type = 'issue';
    if (issue.pull_request) {
      type = 'PR';
    }

    // special syntax: user commented on issue #423: body... <url>
    if (action === 'created') {
      notify(channel,
          "[\x0313"+repository.name+"\x0F] "+
          "\x0315"+sender.login+"\x0F "+
          "commented on "+type+" \x02#"+issue.number+"\x02: "+
          trimText(comment.body, 140)+"\x0F "+
          "\x0302\x1F"+urlHandler(comment.html_url)+"\x0F");
      return;
    }

    // basic syntax
    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F "+
        action+" a comment on "+type+" \x02#"+issue.number+"\x02: "+
        "\x0302\x1F"+urlHandler(comment.html_url)+"\x0F");
    return;

  case 'pull_request_review':
    var {action, repository, sender, pull_request, review} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    // only handle 'submitted', no idea what else it could be
    if (action === 'submitted') {
      var reviewBody = '';
      if (review.body) {
        reviewBody = ": "+trimText(review.body, 140)+"\x0F";
      }
      notify(channel,
          "[\x0313"+repository.name+"\x0F] "+
          "\x0315"+sender.login+"\x0F "+
          "reviewed PR \x02#"+pull_request.number+"\x02 "+
          "and \x0306"+review.state+"\x0F"+reviewBody+" "+
          "\x0302\x1F"+urlHandler(review.html_url)+"\x0F");
      return;
    }
    break;

  case 'pull_request_review_comment':
    var {action, repository, sender, pull_request, comment} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    // special syntax: user commented on issue #423: body... <url>
    if (action === 'created') {
      notify(channel,
          "[\x0313"+repository.name+"\x0F] "+
          "\x0315"+sender.login+"\x0F "+
          "commented in a review of PR \x02#"+pull_request.number+"\x02 "+
          "at "+comment.path+": "+
          trimText(comment.body, 140)+"\x0F "+
          "\x0302\x1F"+urlHandler(comment.html_url)+"\x0F");
      return;
    }

    // basic syntax
    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F "+
        action+" a comment on a review of PR \x02#"+pull_request.number+"\x02: "+
        "\x0302\x1F"+urlHandler(comment.html_url)+"\x0F");
    return;

  case 'gollum':
    var {pages, repository, sender} = payload;
    pages = pages.filter(p =>
        isActionRelevant(p.action));

    var pageText = pages.map(page => `${page.action} \x0306${page.page_name}\x0F`).join(', ');
    if (pages.length === 0) {
      console.log('Ignoring irrelevant action', payload.pages[0].action);
      return;
    } else if (pages.length === 1) {
      pageText += " \x0302\x1F"+urlHandler(pages[0].html_url)+"\x0F";
    } else {
      pageText += "\x0302\x1F"+urlHandler(repository.url+'/wiki')+"\x0F";
    }

    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F changed the wiki: "+pageText);
    return;

  // TODO: what's appropriate here?
  case 'check_run':
    var {action, check_run, repository} = payload;
    var {id, node_id, external_id, head_sha, html_url, status, conclusion, started_at, completed_at, output, name, check_suite} = check_run;
    console.log('TODO: check_run', {action, id, head_sha, status, conclusion, name});
    return;
  case 'check_suite':
    var {action, check_suite, repository} = payload;
    var {id, node_id, head_branch, head_sha, status, conclusion, created_at, updated_at, latest_check_runs_count, head_commit} = check_suite;
    console.log('TODO: check_suite', {action, id, head_sha, head_branch, status, conclusion, latest_check_runs_count});
    return;

  case 'status':
  case 'deployment':
  case 'deployment_status':
  case 'page_build':
    var {repository, commit, state, description, target_url, context} = payload;

    // adapt deployments to look like normal statuses
    if (eventType === 'deployment') {
      var {deployment} = payload;
      state = 'info';
      commit = deployment; // for sha
      context = 'deployment';
      description = deployment.task+' '+deployment.environment;
    }
    if (eventType === 'deployment_status') {
      var {deployment, deployment_status} = payload;
      state = deployment_status.status;
      commit = deployment; // for sha
      context = 'deployment status';
      target_url = deployment_status.target_url;
      description = deployment.task+' '+deployment.environment;
    }
    if (eventType === 'page_build') {
      var {build} = payload;
      state = build.status;
      commit = {sha: build.commit};
      context = 'page';
      description = build.error.message;
      if (!description) {
        description = "took "+(Math.round(build.duration/1000*10)/10)+" seconds";
      }
    }

    const ignoredStates = ['pending', 'success'];
    if (ignoredStates.includes(state)) {
      console.log('ignoring github commit status', payload.state);
      return;
    }

    // bors doesn't specify a URL, among others
    var urlField = '';
    if (target_url) {
      urlField = " \x0302\x1F"+urlHandler(target_url)+"\x0F";
    }

    // some colors
    var stateFrag = state;
    if (state === 'failure') stateFrag = `\x0315${state}\x0F`;
    if (state === 'success' ||
        state === 'built') stateFrag = `\x0303${state}\x0F`;
    if (state === 'pending') stateFrag = `\x0304${state}\x0F`;

    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0314"+commit.sha.slice(0, 7)+"\x0F "+
        (context || 'build')+' '+
        stateFrag+": "+
        trimText(description, 140)+"\x0F"
        +urlField);
    return;

  case 'watch':
  case 'star':
    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.sender.login+"\x0F "+
        "starred the repository! ⭐");
    return;

  case 'member':
    var {action} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    if (action === 'added') {
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.member.login+"\x0F "+
          "is now a repo collaborator 👍");
    } else {
      notify(channel,
          "[\x0313"+payload.repository.name+"\x0F] "+
          "\x0315"+payload.member.login+"\x0F "+
          "was "+action+" as a collaborator");
    }
    return;

  case 'fork':
    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.forkee.owner.login+"\x0F "+
        "created a fork @ "+
        "\x0313"+payload.forkee.full_name+"\x0F");
    return;

  case 'create':
  case 'delete':
    var {ref, ref_type, repository, sender} = payload;

    // Ignore branch create/delete event since push handles it w/ more detail
    if (ref_type === 'branch') {
      console.log('Ignoring github', eventType, 'event for a branch');
      return;
    }

    // <user> <create/delete>d <tag> <v1>
    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F "+
        eventType+"d "+ref_type+" "+
        "\x0306"+ref+"\x0F");
    return;

  case 'repository':
    var {action, repository, sender} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        "\x0315"+sender.login+"\x0F "+
        action+" the repository");
    return;

  case 'repository_vulnerability_alert':
    var {action, repository, alert} = payload;
    if (action !== 'create') {
      console.log('Ignoring unrecognized action', action);
      return;
    }

    notify(channel,
        "[\x0313"+repository.name+"\x0F] "+
        `\x02\x1F\x034/!\\\x0F `+
        "\x034Inbound Vulnerability Alert\x0F - "+
        "\x0311"+alert.affected_package_name+"\x0F "+
        "\x0313"+alert.affected_range+"\x0F subject to "+
        "\x0307"+alert.external_identifier+"\x0F - "+
        "\x0310fixed in \x0306"+alert.fixed_in+"\x0F "+
        "\x0302\x1F"+urlHandler(alert.external_reference)+"\x0F");
    return;

  case 'project_column':
    var {action, project_column} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.sender.login+"\x0F "+
        action+' '+
        "project column "+project_column.name);
    return;

  case 'project_card':
    var {action, project_card} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.sender.login+"\x0F "+
        action+' '+
        "project card: "+
        trimText(project_card.note, action == "created" ? 300 : 80));
    return;

  case 'project':
    var {action, project} = payload;
    if (!isActionRelevant(action)) {
      console.log('Ignoring irrelevant action', action);
      return;
    }

    notify(channel,
        "[\x0313"+payload.repository.name+"\x0F] "+
        "\x0315"+payload.sender.login+"\x0F "+
        action+' '+
        "project "+
        project.name);
    return;

  case 'ping':
    const pingCtx = payload.hook.type === 'Organization'
      ? payload.organization.login
      : payload.repository.name;
    notify(channel, "[\x0313"+pingCtx+"\x0F] "+
        "This GitHub hook is working! Received a `ping` event. "+
        payload.zen + ' '+
        "\x0302\x1F"+urlHandler(payload.repository.html_url)+"\x0F");
    return;

  }
  console.log('got weird message', JSON.stringify(data));
  notify(channel, "[\x0313"+payload.repository.name+"\x0F] "+
         "Got Github event of unhandled type: " + eventType);
  notify('#stardust', "Got Github event of unhandled type: `" + eventType + '`');
}

// start working
if (!module.parent) {
  runWorker(exports.processMessage);
}
