const tc = require("@actions/tool-cache");
const core = require("@actions/core");
const semver = require("semver");
const createWrapper = require("actions-output-wrapper");

async function action() {
  const version = core.getInput("deck-version", { required: true });
  const semverVersion = semver.valid(semver.coerce(version));

  if (!semverVersion) {
    throw new Error(`Invalid version provided: '${version}'`);
  }

  let os = getPlatform(process.platform);
  const fullVersion = `${semverVersion}-${os}`;
  console.log(`Installing decK version ${fullVersion}`);

  let deckDirectory = tc.find("deck", fullVersion);
  if (!deckDirectory) {
    const versionUrl = `https://github.com/Kong/deck/releases/download/v${semverVersion}/deck_${semverVersion}_${os}_amd64.tar.gz`;
    const deckPath = await tc.downloadTool(versionUrl);

    const deckExtractedFolder = await tc.extractTar(
      deckPath,
      `deck-${fullVersion}`
    );

    deckDirectory = await tc.cacheDir(deckExtractedFolder, "deck", fullVersion);
  }

  core.addPath(deckDirectory);
  if (core.getInput("wrapper") === "true") {
    await createWrapper("deck");
  }
}

function getPlatform(platform) {
  if (platform === "win32") {
    return "windows";
  }

  if (process.platform === "darwin") {
    return "darwin";
  }

  return "linux";
}

if (require.main === module) {
  action();
}

module.exports = action;
