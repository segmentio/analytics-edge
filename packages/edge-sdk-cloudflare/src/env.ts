export interface Env {
  Profiles: KVNamespace;
  EdgeFunctions: KVNamespace;
  dispatcher: { [key: string]: any };
}
