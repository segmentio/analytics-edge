export const mockContext = {
  settings: {
    writeKey: "THIS_IS_A_WRITE_KEY",
    routePrefix: "seg",
    collectEdgeData: true,
    personasSpaceId: "test",
    personasToken: "test",
    baseSegmentCDN: "https://cdn.segment.com",
  },
  env: {
    Profiles: {} as any,
    EdgeFunctions: {} as any,
    dispatcher: {} as any,
  },
};
