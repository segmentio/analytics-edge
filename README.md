# Segment Edge SDK

This is an official Segment Edge SDK monorepo powered by Turborepo. Versioning and package publishing is handled by [Changesets](https://github.com/changesets/changesets) and fully automated with GitHub Actions.

## Useful commands

- `yarn build` - Build all packages and the example
- `yarn dev` - Develop all packages and the example
- `yarn lint` - Lint all packages
- `yarn changeset` - Generate a changeset
- `yarn clean` - Clean up all `node_modules` and `dist` folders (runs each package's clean script)

# How to use the Edge SDK?

An example is provided in `examples/cloudflare_example`. Note that the SDK requires the following KV stores to operate:

```
    Profiles
    EdgeFunctions
    SourceFunctions
```

Also, it requires Env.dispatcher ( a feature of Platform Workers ) to be available.
