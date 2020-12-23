export interface StatsSummary {
  node: Node;
  pods: Pod[];
}

export interface Node {
  nodeName:          string;
  startTime:         string;
  cpu:               CPU;
  memory:            Memory;
  systemContainers?: Container[];
  network?:          Network;
  fs?:               FS;
  runtime?:          Runtime;
  rlimit?:           Rlimit;
}

export interface Pod {
  podRef:               PodRef;
  startTime:            string;
  containers:           Container[];
  cpu:                  CPU;
  memory:               Memory;
  network?:             Network;
  volume?:              (FS & {name: string})[];
  "ephemeral-storage"?: FS;
}

export interface Container {
  name:                string;
  startTime:           string;
  cpu:                 CPU;
  memory:              Memory;
  rootfs?:             FS;
  logs?:               FS;
  userDefinedMetrics?: UserDefinedMetric[];
}

export interface CPU {
  time:                 string;
  usageNanoCores:       number;
  usageCoreNanoSeconds: number;
}

export interface FS {
  time:           string;
  availableBytes: number;
  capacityBytes:  number;
  usedBytes:      number;
  inodesFree?:    number;
  inodes?:        number;
  inodesUsed?:    number;
  name?:          string;
}

export interface Memory {
  time:             string;
  availableBytes?:  number;
  usageBytes:       number;
  workingSetBytes:  number;
  rssBytes?:        number;
  pageFaults?:      number;
  majorPageFaults?: number;
}

export interface Network extends Interface {
  time:        string;
  interfaces?: Interface[];
}
export interface Interface {
  name:      string;
  rxBytes:   number;
  rxErrors?: number;
  txBytes:   number;
  txErrors?: number;
}

export interface Rlimit {
  time:    string;
  maxpid:  number;
  curproc: number;
}

export interface Runtime {
  imageFs: FS;
}

export interface UserDefinedMetric {
  name:  string;
  type:  "cumulative" | "gauge" | "delta";
  units: string;
  time:  string;
  value: number;
}

export interface PodRef {
  name:      string;
  namespace: string;
  uid:       string;
}
