const action = require("./index");
const tc = require("@actions/tool-cache");
const core = require("@actions/core");
const mockEnv = require("mocked-env");

const nock = require("nock");
nock.disableNetConnect();

jest.mock("actions-output-wrapper");
let createWrapper = require("actions-output-wrapper");

let originalPlatform;
let originalArch;
let restore;
let restoreTest;

beforeEach(() => {
  restore = mockEnv({
    INPUT_TOKEN: "this_token_is_not_used_due_to_mocks",
  });
  restoreTest = () => {};

  jest.spyOn(console, "log").mockImplementation();
  createWrapper.mockClear();
  originalPlatform = process.platform;
  originalArch = process.arch;
});

afterEach(() => {
  jest.restoreAllMocks();
  restore();
  restoreTest();
  if (!nock.isDone()) {
    throw new Error(
      `Not all nock interceptors were used: ${JSON.stringify(
        nock.pendingMocks()
      )}`
    );
  }
  nock.cleanAll();
  setPlatform(originalPlatform);
  setArch(originalArch);
});

describe("automatic version fetching", () => {
  it("does not fetch when a version is provided", async () => {
    // No call to nock(), so no HTTP traffic expected
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "3.2.1",
    });
    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();
    expect(console.log).toBeCalledWith(`Installing decK version 3.2.1-linux`);
  });

  it("fetches the latest version when no version is provided", async () => {
    nock("https://api.github.com")
      .get("/repos/Kong/deck/releases")
      .reply(200, [
        {
          tag_name: "v3.2.1",
        },
      ]);

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();
    expect(console.log).toBeCalledWith(`Installing decK version 3.2.1-linux`);
  });

  it("fails when there are no releases and no specific version is provided", async () => {
    nock("https://api.github.com")
      .get("/repos/Kong/deck/releases")
      .reply(200, []);

    try {
      await action();
    } catch (e) {
      expect(e.message).toBe("No releases found in kong/deck");
    }
  });
});

describe("version parsing", () => {
  it("throws when an invalid version is provided", async () => {
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "banana",
    });
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
      restoreTest = mockEnv({
        "INPUT_DECK-VERSION": version,
      });

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
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "1.7.0",
    });

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
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "1.7.0",
    });

    setPlatform("linux");
    setArch("amd64");
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
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "1.7.0",
    });

    setPlatform(platform);
    setArch("amd64");
    mockToolIsInCache(false);
    mockTcDownload();
    mockExtraction();

    await action();

    expect(tc.downloadTool).toBeCalledWith(
      `https://github.com/Kong/deck/releases/download/v1.7.0/deck_1.7.0_${os}_amd64.tar.gz`
    );
  });

  const archCases = [
    ["x64", "amd64"],
    ["arm64", "arm64"],
  ];

  test.each(archCases)("downloads correctly for %s", async (node_arch, arch) => {
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "1.7.0",
    });

    setPlatform("linux");
    setArch(node_arch);
    mockToolIsInCache(false);
    mockTcDownload();
    mockExtraction();

    await action();

    expect(tc.downloadTool).toBeCalledWith(
      `https://github.com/Kong/deck/releases/download/v1.7.0/deck_1.7.0_linux_${arch}.tar.gz`
    );
  });
});

describe("wrapper", () => {
  it("does not apply the wrapper by default", async () => {
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "1.7.0",
      INPUT_WRAPPER: "false",
    });

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();

    expect(createWrapper).toBeCalledTimes(0);
  });

  it("applies the wrapper when enabled", async () => {
    restoreTest = mockEnv({
      "INPUT_DECK-VERSION": "1.7.0",
      INPUT_WRAPPER: "true",
    });

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

function setArch(arch) {
  Object.defineProperty(process, "arch", {
    value: arch,
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
