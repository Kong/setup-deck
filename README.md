# setup-deck

Install [decK](https://github.com/Kong/deck) so that it can be used in your GitHub Actions workflows

Add the following to your `steps` definition to install the latest version of `deck`:

```yaml
- uses: kong/setup-deck@v1
```

## Sample workflow

```yaml
on:
  push:
    branches:
      - main
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: kong/setup-deck@v1
      - run: deck version
```

You can also specific a specific version to install with the `deck-version` input:

```yaml
- uses: kong/setup-deck@v1
  with:
    deck-version: 1.7.0
```

## Capturing output

If you need to capture the output for use in a later step, you can add a wrapper script which exposes `stdout` and `stderr` by passing the `wrapper` input and setting it to `true`:

```yaml
steps:
  - uses: kong/setup-deck@v1
    with:
      deck-version: 1.7.0
      wrapper: true
  - run: deck version
    id: deck_version
  - run: echo '${{ toJson(steps.deck_version.outputs) }}'
```

This would produce the following output:

```json
{
  "stderr": "",
  "stdout": "decK v1.7.0 (de1c830) \n"
}
```
