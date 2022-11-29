# Segment Edge SDK

This is an official Segment Edge SDK monorepo powered by Turborepo. Versioning and package publishing is handled by [Changesets](https://github.com/changesets/changesets) and fully automated with GitHub Actions.

## Useful commands

- `yarn build` - Build all packages and the example
- `yarn dev` - Develop all packages and the example
- `yarn lint` - Lint all packages
- `yarn changeset` - Generate a changeset
- `yarn clean` - Clean up all `node_modules` and `dist` folders (runs each package's clean script)

# How to use the Edge SDK?

## Using with Cloudflare Workers

Two examples are provided in [Examples folder](https://github.com/segmentio/analytics-edge/tree/main/examples). See [the full docs](https://github.com/segmentio/analytics-edge/blob/main/packages/edge-sdk-cloudflare/README.md) for details on how to use the Edge SDK with Cloudflare Workers.
