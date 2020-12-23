import DatadogApi, { CheckStatus } from "https://deno.land/x/datadog_api@v0.1.2/mod.ts";
import { MetricSubmission } from "https://deno.land/x/datadog_api@v0.1.2/v1/metrics.ts";
const datadog = DatadogApi.fromEnvironment(Deno.env);

import { fixedInterval } from "https://danopia.net/deno/fixed-interval@v1.ts";

import {
  readableStreamFromAsyncIterator as fromAsyncIterator,
} from "https://deno.land/std@0.81.0/io/streams.ts";

import { bufferWithCount } from "https://uber.danopia.net/deno/observables-with-streams@v1/transforms/buffer-with-count.ts";

import {
  // RestClient as KubernetesClient,
  // autoDetectClient as autoDetectKubernetesClient,
  ReadLineTransformer,
} from "https://deno.land/x/kubernetes_client@v0.1.0/mod.ts";
// import { CoreV1Api } from "https://deno.land/x/kubernetes_apis@v0.1.0/builtin/core@v1/mod.ts";

import { buildSystemMetrics } from './kubelet-stats.ts';

interface RawMetric {
  name: string;
  help: string;
  type: string;
  datas: Array<[Record<string,string>, number]>;
}

// const kubernetes = await autoDetectKubernetesClient();
// const coreApi = new CoreV1Api(kubernetes);
// const resp = await coreApi.namespace('kube-system').connectGetServiceProxy('kube-state-metrics:http-metrics', {path: '/metrics'});

async function* grabMetrics(url: string): AsyncGenerator<RawMetric> {
  const resp = await fetch(url);
  const lines = resp.body!.pipeThrough(new ReadLineTransformer());
  let currName: string | undefined;
  let currHelp: string | undefined;
  let currType: string | undefined;
  let datas: Array<[Record<string,string>, number]> | undefined;
  for await (const line of lines) {
    if (!line.startsWith('#')) {
      // console.log(3, currName, currHelp, currType, line);
      const match = line.match(/{([^}]+)} ([^ ]+)$/) || line.match(/() ([^ ]+)$/);
      if (!match) throw new Error(`TODO: ${line}`);
      const tags: Record<string,string> = Object.create(null);
      for (const kv of match[1] ? match[1].split(',') : '') {
        const [k,v] = kv.split('=');
        tags[k] = JSON.parse(v);
      }
      datas!.push([tags, parseFloat(match[2])]);
    } else if (line.startsWith('# HELP ')) {
      if (datas) {
        yield {name: currName!, help: currHelp!, type: currType!, datas};
      }
      datas = [];
      currName = line.split(' ')[2];
      currHelp = line.slice(8+currName.length);
    } else if (line.startsWith('# TYPE ')) {
      currName = line.split(' ')[2];
      currType = line.slice(8+currName.length);
    } else throw new Error("TODO: "+line);
  }
  if (datas) {
    yield {name: currName!, help: currHelp!, type: currType!, datas};
  }
}

function reportAs(
  rawMetric: RawMetric,
  metric_name: string,
  metric_type: 'gauge' | 'rate' | 'count',
  extraTags: string[],
  tagKeyMap: Record<string,string>,
): MetricSubmission[] {
  return rawMetric.datas.map(([tags, val]) => ({
      metric_name,
      points: [{value: val}],
      interval: 30,
      metric_type,
      tags: [
        'cluster:dust-gke',
        ...extraTags,
        ...Object.entries(tags).map(([k,v]) => (tagKeyMap[k]||`kube_${k}`)+`:${v}`),
      ]}));
}

async function* buildDogMetrics(dutyCycle: number): AsyncGenerator<MetricSubmission,any,undefined> {
  // Our own loop-health metric
  yield {
    metric_name: `app.loop.duty_cycle`,
    points: [{value: dutyCycle*100}],
    interval: 60,
    metric_type: 'gauge',
    tags: ['app:kubernetes-ship-to-dd'],
  };

  for await (const rawMetric of grabMetrics('http://kube-state-metrics.monitoring.svc.cluster.local:8080/metrics')) {

    if (rawMetric.name === 'kube_daemonset_status_desired_number_scheduled') {
      yield* reportAs(rawMetric, 'kube_state.controller.desired_replicas', 'gauge', ['kube_kind:daemonset'], {'daemonset': 'kube_name'});
    }
    if (rawMetric.name === 'kube_daemonset_status_number_available') {
      yield* reportAs(rawMetric, 'kube_state.controller.available_replicas', 'gauge', ['kube_kind:daemonset'], {'daemonset': 'kube_name'});
    }
    if (rawMetric.name === 'kube_daemonset_status_number_unavailable') {
      yield* reportAs(rawMetric, 'kube_state.controller.unavailable_replicas', 'gauge', ['kube_kind:daemonset'], {'daemonset': 'kube_name'});
    }

    if (rawMetric.name === 'kube_deployment_spec_replicas') {
      yield* reportAs(rawMetric, 'kube_state.controller.desired_replicas', 'gauge', ['kube_kind:deployment'], {'deployment': 'kube_name'});
    }
    if (rawMetric.name === 'kube_deployment_status_replicas_available') {
      yield* reportAs(rawMetric, 'kube_state.controller.available_replicas', 'gauge', ['kube_kind:deployment'], {'deployment': 'kube_name'});
    }
    if (rawMetric.name === 'kube_deployment_status_replicas_unavailable') {
      yield* reportAs(rawMetric, 'kube_state.controller.unavailable_replicas', 'gauge', ['kube_kind:deployment'], {'deployment': 'kube_name'});
    }

    if (rawMetric.name === 'kube_node_status_condition') {
      // TODO: proper true/false handling
      yield* reportAs(rawMetric, 'kube_state.node.condition', 'gauge', [], {});
      for (const [tags, val] of rawMetric.datas) {
        if (tags['condition'] === 'Ready' && val > 0) {
          await datadog.v1ServiceChecks.submit({
            check_name: 'kube_state.node.ready',
            host_name: tags['node'],
            status: tags['status'] === 'true' ? CheckStatus.Ok : tags['status'] === 'false' ? CheckStatus.Critical : CheckStatus.Unknown,
          });
        }
      }
    }
    if (rawMetric.name === 'kube_node_spec_unschedulable') {
      yield* reportAs(rawMetric, 'kube_state.node.unschedulable', 'gauge', [], {});
    }

    if (rawMetric.name === 'kube_pod_status_ready') {
      yield* reportAs(rawMetric, 'kube_state.pod.ready', 'gauge', [], {});
    }

    // TODO: kube_pod_container_resource_requests
    // TODO: kube_pod_container_resource_limits
    // TODO: kube_node_status_capacity
    // TODO: kube_node_status_allocatable

    if (rawMetric.name === 'kube_pod_container_status_restarts_total') {
      yield* reportAs(rawMetric, 'kube_state.container.restarts.total', 'gauge', [], {});
    }
    if (rawMetric.name === 'kube_pod_init_container_status_restarts_total') {
      yield* reportAs(rawMetric, 'kube_state.init_container.restarts.total', 'gauge', [], {});
    }

    if (rawMetric.name === 'kube_statefulset_replicas') {
      yield* reportAs(rawMetric, 'kube_state.controller.desired_replicas', 'gauge', ['kube_kind:statefulset'], {'statefulset': 'kube_name'});
    }
    if (rawMetric.name === 'kube_statefulset_status_replicas_ready') {
      yield* reportAs(rawMetric, 'kube_state.controller.available_replicas', 'gauge', ['kube_kind:statefulset'], {'statefulset': 'kube_name'});
    }
    // there is no unavailable...

  }

  yield* buildSystemMetrics([
    'cluster:dust-gke',
  ]);

}

for await (const dutyCycle of fixedInterval(30 * 1000)) {
  console.log('---', new Date().toISOString(), dutyCycle);
  const metricStream = fromAsyncIterator(buildDogMetrics(dutyCycle));
  for await (const batch of metricStream.pipeThrough(bufferWithCount(500))) {
    console.log(batch.length, await datadog.v1Metrics.submit(batch));
  }
}
