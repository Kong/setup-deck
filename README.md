# setup-deck

Install [decK](https://github.com/Kong/deck) so that it can be used in your GitHub Actions workflows

Add the following to your `steps` definition:

```yaml
- uses: kong/setup-deck@v1
  with:
    deck-version: 1.7.0
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
        with:
          deck-version: 1.7.0
      - run: deck version
```
