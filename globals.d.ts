export interface UserPreferences {
  [key: string]: any;
}

export type Matcher = '$' | '^' | '~' | '*' | '';

export type CreateUserParams = {
  username: string;
  globalRole?: { role: string };
  clusterRole?: { clusterId: string; role: string };
  projectRole?: { clusterId: string; projectName: string; role: string };
  password?: string;
};

export type CreateAmazonRke2ClusterParams = {
  machineConfig: {
    instanceType: string;
    region: string;
    vpcId: string;
    zone: string;
    type: string;
    clusterName: string;
    namespace: string;
  };
  cloudCredentialsAmazon: {
    workspace: string;
    name: string;
    region: string;
    accessKey: string;
    secretKey: string;
  };
  rke2ClusterAmazon: {
    clusterName: string;
    namespace: string;
  };
  metadata?: {
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
};

export type CreateAmazonRke2ClusterWithoutMachineConfigParams = {
  cloudCredentialsAmazon: {
    workspace: string;
    name: string;
    region: string;
    accessKey: string;
    secretKey: string;
  };
  rke2ClusterAmazon: {
    clusterName: string;
    namespace: string;
  };
};

export interface CreateResourceNameOptions {
  onlyContext?: boolean;
  prefixContext?: boolean;
}

/**
 * Test environment metadata (available via testInfo.project.metadata)
 */
export interface TestEnvMetadata {
  baseUrl: string;
  api: string;
  username: string;
  password: string;
  bootstrapPassword?: string;
  grepTags?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  azureSubscriptionId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  customNodeIp?: string;
  customNodeKey?: string;
  accessibility: boolean;
  a11yFolder: string;
  gkeServiceAccount?: string;
}
