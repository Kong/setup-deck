const action = require("./index");
const tc = require("@actions/tool-cache");
const core = require("@actions/core");
jest.mock("actions-output-wrapper");
let createWrapper = require("actions-output-wrapper");

let originalPlatform;
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation();
  createWrapper.mockClear();
  originalPlatform = process.platform;
});

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform(originalPlatform);
});

describe("version parsing", () => {
  it("throws when no version is provided", async () => {
    expect(action).rejects.toThrow(
      "Input required and not supplied: deck-version"
    );
  });

  it("throws when an invalid version is provided", async () => {
    process.env["INPUT_DECK-VERSION"] = "banana";
    expect(action).rejects.toThrow("Invalid version provided: 'banana'");
  });

  const cases = [
    ["1.7.0", "1.7.0"],
    ["1.7", "1.7.0"],
    ["1.6", "1.6.0"],
    ["1.6.4", "1.6.4"],
    ["1.8.0-beta2", "1.8.0"],
  ];

  test.each(cases)(
    `accepts a valid semver input (%s)`,
    async (version, expected) => {
      process.env["INPUT_DECK-VERSION"] = version;

      setPlatform("linux");
      mockToolIsInCache(true);
      mockExtraction();

      await action();
      expect(console.log).toBeCalledWith(
        `Installing decK version ${expected}-linux`
      );
    }
  );
});

describe("install", () => {
  it("does not download if the file is in the cache", async () => {
    process.env["INPUT_DECK-VERSION"] = "1.7.0";
    jest.spyOn(core, "addPath");
    jest.spyOn(tc, "downloadTool");

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();

    expect(tc.downloadTool).toBeCalledTimes(0);
    expect(core.addPath).toBeCalledWith("/path/to/deck");
  });

  it("downloads if it is not in the cache", async () => {
    process.env["INPUT_DECK-VERSION"] = "1.7.0";

    setPlatform("linux");
    mockToolIsInCache(false);
    mockTcDownload();
    mockExtraction();

    await action();

    const versionUrl = `https://github.com/Kong/deck/releases/download/v1.7.0/deck_1.7.0_linux_amd64.tar.gz`;

    expect(tc.downloadTool).toBeCalledWith(versionUrl);
    expect(tc.extractTar).toBeCalledWith(
      "./deck-downloaded",
      "deck-1.7.0-linux"
    );
    expect(core.addPath).toBeCalledWith("/path/to/extracted/deck");
  });

  const osCases = [
    ["default", "linux"],
    ["linux", "linux"],
    ["win32", "windows"],
    ["darwin", "darwin"],
  ];

  test.each(osCases)("downloads correctly for %s", async (platform, os) => {
    process.env["INPUT_DECK-VERSION"] = "1.7";

    setPlatform(platform);
    mockToolIsInCache(false);
    mockTcDownload();
    mockExtraction();

    await action();

    expect(tc.downloadTool).toBeCalledWith(
      `https://github.com/Kong/deck/releases/download/v1.7.0/deck_1.7.0_${os}_amd64.tar.gz`
    );
  });
});

describe("wrapper", () => {
  it("does not apply the wrapper by default", async () => {
    process.env["INPUT_DECK-VERSION"] = "1.7.0";
    process.env["INPUT_WRAPPER"] = "false";

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();

    expect(createWrapper).toBeCalledTimes(0);
  });

  it("applies the wrapper when enabled", async () => {
    process.env["INPUT_DECK-VERSION"] = "1.7.0";
    process.env["INPUT_WRAPPER"] = "true";

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();

    expect(createWrapper).toBeCalledTimes(1);
  });
});

function mockToolIsInCache(exists) {
  const path = exists ? "/path/to/deck" : "";
  jest.spyOn(tc, "find").mockImplementationOnce(() => path);
}

function setPlatform(platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
  });
}

function mockTcDownload() {
  jest
    .spyOn(tc, "downloadTool")
    .mockImplementationOnce(() => "./deck-downloaded");
}

function mockTcExtractTar() {
  jest
    .spyOn(tc, "extractTar")
    .mockImplementationOnce(() => "./deck-extracted-local");
}

function mockTcCacheDir() {
  jest
    .spyOn(tc, "cacheDir")
    .mockImplementationOnce(() => "/path/to/extracted/deck");
}

function mockCoreAddPath() {
  jest.spyOn(core, "addPath").mockImplementationOnce(() => {});
}

function mockExtraction() {
  mockTcExtractTar();
  mockTcCacheDir();
  mockCoreAddPath();
}
