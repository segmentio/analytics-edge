# Segment Edge SDK

This is the official Segment Edge SDK monorepo.

With Segment Edge SDK, built on Cloudflare Workers, developers can collect high-quality first-party data and use Segment Edge SDK to access realtime user profiles and state, to deliver personalized app experiences without managing a ton of infrastructure. Want to know more? Check out the blog posts https://segment.com/blog/twilio-segment-edge-sdk/ and https://segment.com/blog/llamas-on-the-edge/

Versioning and package publishing is handled by [Changesets](https://github.com/changesets/changesets) and fully automated with GitHub Actions.

# Using the Edge SDK?

## Using with Cloudflare Workers

Two examples are provided in [Examples folder](https://github.com/segmentio/analytics-edge/tree/main/examples). See [the full docs](https://github.com/segmentio/analytics-edge/blob/main/packages/edge-sdk/README.md) for details on how to use the Edge SDK with Cloudflare Workers.

# Contributing

## Useful commands

- `yarn build` - Build all packages and the example
- `yarn dev` - Develop all packages and the example
- `yarn lint` - Lint all packages
- `yarn changeset` - Generate a changeset
- `yarn clean` - Clean up all `node_modules` and `dist` folders (runs each package's clean script)
