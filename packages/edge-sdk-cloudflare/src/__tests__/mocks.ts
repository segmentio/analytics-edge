export const mockContext = {
  settings: {
    writeKey: "THIS_IS_A_WRITE_KEY",
    routePrefix: "seg",
    personasSpaceId: "test",
    personasToken: "test",
    baseSegmentCDN: "https://cdn.segment.com",
    profilesStorage: {
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
  },
  env: {
    Profiles: { get: () => null, put: () => null } as any,
    EdgeFunctions: {} as any,
    dispatcher: {} as any,
  },
  logger: { log: () => null } as any,
};
