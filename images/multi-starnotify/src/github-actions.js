const fetch = require('node-fetch');

// This file is basically just a hack to make Github Actions check_suite payloads somewhat useful.
// It depends on github's HTML site so only public repos will work.

exports.resolveFromCheckSuiteApiUrl = async (suiteUrl) => {

  const {check_runs} = await fetch(suiteUrl+'/check-runs').then(x => x.json());
  const firstRun = check_runs[0];

  const runHtml = await fetch(firstRun.html_url+'?check_suite_focus=true').then(x => x.text());
  const runMatch = runHtml.match(/\/actions\/runs\/(\d+)/);

  const runUrl = (suiteUrl.split('/').slice(0, -2)).join('/') + runMatch[0];
  console.log(runUrl)
  const runData = await fetch(runUrl).then(x => x.json());

  return runData;
};

// exports.resolveFromCheckSuiteApiUrl('https://api.github.com/repos/dagd/dagd/check-suites/1465870251').then(console.log)
