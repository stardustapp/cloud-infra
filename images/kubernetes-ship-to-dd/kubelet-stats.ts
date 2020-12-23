import { MetricSubmission } from "https://deno.land/x/datadog_api@v0.1.2/v1/metrics.ts";

import { autoDetectClient } from "https://deno.land/x/kubernetes_client@v0.1.0/mod.ts";
import { CoreV1Api } from "https://deno.land/x/kubernetes_apis@v0.1.0/builtin/core@v1/mod.ts";

import * as types from "./kubelet-api.ts";

const coreApi = new CoreV1Api(await autoDetectClient());
const {items: nodes} = await coreApi.getNodeList();

interface StatsSummary {
  node: NodeSummary;
  pods: Map<string, PodSummary>;
};
interface NodeSummary {
  cpu:               types.CPU;
  memory:            types.Memory;
  systemContainers: Map<string, ContainerSummary>;
  network?:          types.Network;
  fs?:               types.FS;
  runtime?:          types.Runtime;
  rlimit?:           types.Rlimit;
};
interface PodSummary {
  podRef:               types.PodRef;
  containers:           Map<string, ContainerSummary>;
  cpu:                  types.CPU;
  memory:               types.Memory;
  network?:             types.Network;
  volume:              Map<string, types.FS>;
  "ephemeral-storage"?: types.FS;
};
interface ContainerSummary {
  name:                string;
  cpu:                 types.CPU;
  memory:              types.Memory;
  rootfs?:             types.FS;
  logs?:               types.FS;
  userDefinedMetrics: Map<string, types.UserDefinedMetric>;
};
const memories = new Map<string, StatsSummary>();

export async function* buildSystemMetrics(baseTags: string[]): AsyncGenerator<MetricSubmission,any,undefined> {

  for (const node of nodes) {
    if (!node.metadata?.name || !node.status?.addresses) continue;
    // if (node.metadata.name !== 'pet-ausbox') continue;
    // if (node.metadata.name !== 'gke-dust-volatile1-b331c9e9-wh9p') continue;

    const internalAddr = node.status.addresses
      .filter(x => x.type === 'InternalIP')
      .map(x => x.address)[0];
    if (!internalAddr) continue;

    const summary = await fetch(`http://${internalAddr}:10255/stats/summary`)
      .then(x => x.json() as Promise<types.StatsSummary>);

    const thisObs: StatsSummary = {
      node: {
        ...summary.node,
        systemContainers: new Map(summary.node.systemContainers?.map(x => [x.name, {
          ...x,
          userDefinedMetrics: new Map(x.userDefinedMetrics?.map(y => [y.name, y])),
        }])),
      },
      pods: new Map(summary.pods.map(x => [x.podRef.uid, {
        ...x,
        volume: new Map(x.volume?.map(x => [x.name, x])),
        containers: new Map(x.containers?.map(x => [x.name, {
          ...x,
          userDefinedMetrics: new Map(x.userDefinedMetrics?.map(y => [y.name, y])),
        }])),
      }])),
    };

    const prevObs = memories.get(node.metadata.name);

    const tags = [...baseTags, `host:${node.metadata.name}`];

    yield* buildNodeMetrics(thisObs.node, prevObs?.node, tags);

    for (const [uid, podNow] of thisObs.pods) {
      const podPrev = prevObs?.pods?.get(uid);
      yield* buildPodMetrics(podNow, podPrev, [...tags,
        `kube_namespace:${podNow.podRef.namespace}`,
        `kube_pod:${podNow.podRef.name}`,
      ]);
    }

    memories.set(node.metadata.name, thisObs);
  }

}

async function* buildNodeMetrics(now: NodeSummary, before: NodeSummary | undefined, tags: string[]): AsyncGenerator<MetricSubmission,any,undefined> {

  yield* buildBasicMetrics('kube.node.', now, before, tags);

  yield* buildNetworkMetrics('kube.node.', now, before, tags);

  if (now.systemContainers) {
    for (const [name, containerNow] of now.systemContainers) {
      const containerPrev = before?.systemContainers?.get(name);
      yield* buildContainerMetrics('kube.system.', containerNow, containerPrev, [...tags,
        `kube_container:${name}`,
      ]);
    }
  }

  // fs?:               types.FS;
  // runtime?:          types.Runtime;
  // rlimit?:           types.Rlimit;
}

type BasicSummary = NodeSummary | PodSummary | ContainerSummary;
async function* buildBasicMetrics(prefix: string, now: BasicSummary, before: BasicSummary | undefined, tags: string[]): AsyncGenerator<MetricSubmission,any,undefined> {

  if (before?.cpu) {
    const timestamp = new Date(now.cpu.time);
    const secondsConsumed = (now.cpu.usageCoreNanoSeconds - before.cpu.usageCoreNanoSeconds) / 1000 / 1000 / 1000;
    yield {
      metric_name: prefix+`cpu_seconds`,
      points: [{value: secondsConsumed, timestamp}],
      interval: 30,
      metric_type: 'count',
      tags,
    };

    const secondsPassed = (timestamp.valueOf() - new Date(before.cpu.time).valueOf()) / 1000;
    yield {
      metric_name: prefix+`cpu_cores`,
      points: [{value: secondsConsumed / secondsPassed, timestamp}], // TODO: move point back to the middle?
      interval: 30,
      metric_type: 'gauge',
      tags,
    };
  }

  if (now.memory) {
    const timestamp = new Date(now.memory.time);
    yield {
      metric_name: prefix+`memory.used_bytes`,
      points: [{value: now.memory.workingSetBytes, timestamp}],
      interval: 30,
      metric_type: 'gauge',
      tags,
    };
    if (now.memory.availableBytes) { yield {
      metric_name: prefix+`memory.available_bytes`,
      points: [{value: now.memory.availableBytes, timestamp}],
      interval: 30,
      metric_type: 'gauge',
      tags,
    }};
    if (now.memory.rssBytes) { yield {
      metric_name: prefix+`memory.rss_bytes`,
      points: [{value: now.memory.rssBytes, timestamp}],
      interval: 30,
      metric_type: 'gauge',
      tags,
    }};
    if (before?.memory && typeof now.memory.pageFaults === 'number') { yield {
      metric_name: prefix+`memory.page_faults`,
      points: [{value: now.memory.pageFaults - (before.memory.pageFaults ?? 0), timestamp}],
      interval: 30,
      metric_type: 'count',
      tags,
    }};
  }

  // network?:          types.Network;
}

async function* buildNetworkMetrics(prefix: string, now: NodeSummary | PodSummary, before: NodeSummary | PodSummary | undefined, tags: string[]): AsyncGenerator<MetricSubmission,any,undefined> {

  if (before?.network && now.network) {
    const timestamp = new Date(now.network.time);

    yield {
      metric_name: prefix+`net.rx_bytes`,
      points: [{value: now.network.rxBytes - before.network.rxBytes, timestamp}],
      interval: 30,
      metric_type: 'count',
      tags: [...tags,
        `interface:${now.network.name}`,
      ],
    };
    if (typeof now.network.rxErrors === 'number') yield {
      metric_name: prefix+`net.rx_errors`,
      points: [{value: now.network.rxErrors - (before.network.rxErrors ?? 0), timestamp}],
      interval: 30,
      metric_type: 'count',
      tags: [...tags,
        `interface:${now.network.name}`,
      ],
    };

    yield {
      metric_name: prefix+`net.tx_bytes`,
      points: [{value: now.network.txBytes - before.network.txBytes, timestamp}],
      interval: 30,
      metric_type: 'count',
      tags: [...tags,
        `interface:${now.network.name}`,
      ],
    };
    if (typeof now.network.txErrors === 'number') yield {
      metric_name: prefix+`net.tx_errors`,
      points: [{value: now.network.txErrors - (before.network.txErrors ?? 0), timestamp}],
      interval: 30,
      metric_type: 'count',
      tags: [...tags,
        `interface:${now.network.name}`,
      ],
    };

  }

}

async function* buildPodMetrics(now: PodSummary, before: PodSummary | undefined, tags: string[]): AsyncGenerator<MetricSubmission,any,undefined> {

  for (const [name, containerNow] of now.containers) {
    const containerPrev = before?.containers?.get(name);
    yield* buildContainerMetrics('kube.pod.', containerNow, containerPrev, [...tags,
      `kube_container:${name}`,
    ]);
  }

  yield* buildNetworkMetrics('kube.pod.', now, before, tags);

  // volume?:              (FS & {name: string})[];
  // "ephemeral-storage"?: FS;
}

async function* buildContainerMetrics(prefix: string, now: ContainerSummary, before: ContainerSummary | undefined, tags: string[]): AsyncGenerator<MetricSubmission,any,undefined> {

  yield* buildBasicMetrics(prefix, now, before, tags);

  // rootfs?:             types.FS;
  // logs?:               types.FS;
  // userDefinedMetrics?: Map<string, types.UserDefinedMetric>;

  for (const [name, containerNow] of now.userDefinedMetrics) {
    const containerPrev = before?.userDefinedMetrics?.get(name);
    const timestamp = new Date(containerNow.time);

    if (containerNow.type === 'gauge') {
      yield {
        metric_name: prefix+containerNow.name,
        points: [{value: containerNow.value, timestamp}],
        interval: 30,
        metric_type: 'gauge',
        tags, // TODO: technically custom metrics can have their own custom tags too...
      };
    } else if (containerNow.type === 'cumulative') {
      if (containerPrev) yield {
        metric_name: prefix+containerNow.name,
        points: [{value: containerNow.value - (containerPrev.value ?? 0), timestamp}],
        interval: 30,
        metric_type: 'count',
        tags, // TODO: technically custom metrics can have their own custom tags too...
      };
    } // TODO: can we even do delta right?
  }

}

// while (true) {
//   for await (const metric of buildSystemMetrics()) {
//     console.log(metric.points[0].value, metric.metric_name, metric.tags?.join(' '));
//   }
//   console.log('----');
//   await new Promise(ok => setTimeout(ok, 10000));
// }
