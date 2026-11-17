import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { lookup as dnsLookup } from "node:dns/promises";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const KILL_GRACE_MS = 2_000;
const PROJECT_ID = /^[a-z0-9]{21}$/;
const PROJECT_ASSET_HOST = /^([a-z0-9]{21})\.rork\.app$/;
const TRUSTED_R2_HOSTS = new Set(["r2-pub.rork.com", "pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev"]);
const ASSET_FILE = "[A-Za-z0-9][A-Za-z0-9._-]{0,254}";
// Rork's own app, preview and service hosts, some of which serve any project's files, such as git.rork.com's project
// icons. A web image may not come from them: image mode checks a Rork asset's project. The marketing site, rork.com and
// www.rork.com, stays open for Rork's own brand images.
const RORK_HOST = /(?:^|\.)(?:rork\.app|rork\.live)$|^(?!www\.rork\.com$).+\.rork\.com$/;
const LOCAL_HOST = /^(?:localhost|.+\.(?:localhost|local|internal|lan|home\.arpa))$/;
const IPV4_HOST = /^[0-9]{1,3}(?:\.[0-9]{1,3}){3}$/;

/**
 * Addresses a web image's host may not resolve to: unspecified, loopback, private, carrier-grade NAT, link-local,
 * unique-local, documentation, benchmarking, multicast and reserved ranges, and the IPv6 forms that embed or tunnel to
 * an IPv4 address (NAT64, 6to4, Teredo), which could carry any of the IPv4 ranges. BlockList checks an IPv4-mapped IPv6
 * address (`::ffff:10.0.0.1`) against the IPv4 ranges itself; an IPv6 rule for `::ffff:0:0/96` would match every IPv4
 * address.
 */
const NON_PUBLIC_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
]) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, "ipv6");
}

/**
 * Per type: the URL paths `rork ai assets info` and the `rork ai` commands print, the accepted formats, and the download
 * and decode limits. A format's MIME type, magic bytes, ffprobe codec and file extensions must all agree.
 */
const MEDIA_TYPES = {
  image: {
    projectPath: new RegExp(`^/~assets/img/${ASSET_FILE}$`),
    r2Path: new RegExp(`^/projects/([a-z0-9]{21})/assets/${ASSET_FILE}$`),
    maxBytes: 16 * 1024 * 1024,
    timeoutMs: 20_000,
    decodeTimeoutMs: 15_000,
    formats: [
      { mimeType: "image/png", extensions: ["png"], codecs: ["png"], matches: isPng },
      { mimeType: "image/jpeg", extensions: ["jpg", "jpeg"], codecs: ["mjpeg"], matches: isJpeg },
      { mimeType: "image/webp", extensions: ["webp"], codecs: ["webp"], matches: isWebp },
    ],
  },
  video: {
    projectPath: new RegExp(`^/~assets/vid/${ASSET_FILE}$`),
    r2Path: new RegExp(`^/generated-video/([a-z0-9]{21})/${ASSET_FILE}$`),
    maxBytes: 64 * 1024 * 1024,
    timeoutMs: 60_000,
    decodeTimeoutMs: 90_000,
    encodeTimeoutMs: 180_000,
    // Rork generates H.264 MP4, the format the export is verified to draw.
    formats: [{ mimeType: "video/mp4", extensions: ["mp4"], codecs: ["h264"], matches: isMp4 }],
  },
};

function isPng(bytes) {
  return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function isJpeg(bytes) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes) {
  return bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP";
}

/** An ISO base media file opens with a box whose type, at bytes 4–7, is `ftyp`. */
function isMp4(bytes) {
  return bytes.toString("latin1", 4, 8) === "ftyp";
}

function mediaTypeOf(type) {
  const media = Object.hasOwn(MEDIA_TYPES, type) ? MEDIA_TYPES[type] : undefined;
  if (!media) throw new Error('Pass "image" or "video" as the asset type.');
  return media;
}

function extensionOf(path) {
  return path.slice(path.lastIndexOf(".") + 1).toLowerCase();
}

/** The project an asset URL names: the asset host's subdomain, or the path segment on the public bucket. */
function owningProjectId(media, url) {
  const projectHost = PROJECT_ASSET_HOST.exec(url.hostname);
  if (projectHost) return media.projectPath.test(url.pathname) ? projectHost[1] : undefined;
  return TRUSTED_R2_HOSTS.has(url.hostname) ? media.r2Path.exec(url.pathname)?.[1] : undefined;
}

/**
 * Validates a canonical image or video URL of this project, or the same asset on Rork's public bucket. This checks
 * the URL format, transport and owning project; it does not verify publishing rights.
 *
 * @param {"image" | "video"} type - The asset type the URL was listed or generated as.
 * @param {string} assetUrl - An image or video URL `rork ai assets info` or a `rork ai` command printed.
 * @param {string} projectId - This sandbox's project ID, from {@link currentProjectId}.
 * @returns {URL} The parsed, restricted HTTPS URL.
 * @example validateProjectMediaUrl("video", "https://abcdefghijklmnopqrstu.rork.app/~assets/vid/clip.mp4", projectId)
 */
export function validateProjectMediaUrl(type, assetUrl, projectId) {
  const media = mediaTypeOf(type);
  let url;
  try {
    url = new URL(assetUrl);
  } catch {
    throw new Error(`Use only a ${type} URL that rork ai assets info or a rork ai command printed.`);
  }

  const assetProjectId = owningProjectId(media, url);
  const cleanTransport =
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    url.search === "" &&
    url.hash === "";
  if (
    cleanTransport &&
    TRUSTED_R2_HOSTS.has(url.hostname) &&
    !url.pathname.split("/").some((segment) => PROJECT_ID.test(segment))
  ) {
    throw new Error("This older asset has no project in its address; regenerate it or use another asset.");
  }
  if (!cleanTransport || assetProjectId === undefined) {
    throw new Error(`Use only an HTTPS Rork project ${type} URL that rork ai assets info or a rork ai command printed.`);
  }
  if (assetProjectId !== projectId) {
    throw new Error(`The ${type} belongs to another Rork project; use only this project's assets.`);
  }

  const extension = extensionOf(url.pathname);
  if (!media.formats.some((format) => format.extensions.includes(extension))) {
    throw new Error(`The project ${type} asset must be ${media.formats.map((format) => format.mimeType).join(" or ")}.`);
  }

  return url;
}

/**
 * Validates the address of an image found on the web, such as a webSearch or webFetch result: a plain HTTPS URL on a
 * public domain name whose path ends in a PNG, JPEG or WebP extension. It refuses credentials, a port, a query or a
 * fragment, an IP address or local host name, and Rork's app, preview and service hosts, whose assets go through image
 * mode and its project check. It cannot tell whether a search returned the URL; the download checks the bytes either way.
 *
 * @param {string} imageUrl - The image URL from a search or fetch result.
 * @returns {URL} The parsed, restricted HTTPS URL.
 * @example validateWebImageUrl("https://cdn.example.com/brand/logo.png")
 */
export function validateWebImageUrl(imageUrl) {
  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("Use an HTTPS image URL that webSearch or webFetch returned.");
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") {
    throw new Error("Use a plain HTTPS image URL, without credentials or a port.");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new Error("Use the image URL without a query or fragment; if the image needs one, choose another result.");
  }
  const host = url.hostname.replace(/\.$/, "");
  if (host.startsWith("[") || IPV4_HOST.test(host) || !host.includes(".") || LOCAL_HOST.test(host)) {
    throw new Error("The web image must come from a public domain name, not an IP address or a local host.");
  }
  if (RORK_HOST.test(host) || TRUSTED_R2_HOSTS.has(host)) {
    throw new Error("Bring a Rork asset in with image mode, which checks the project it belongs to.");
  }
  const formats = MEDIA_TYPES.image.formats;
  if (!formats.some((format) => format.extensions.includes(extensionOf(url.pathname)))) {
    throw new Error("The web image URL must end in .png, .jpg, .jpeg or .webp.");
  }
  return url;
}

/**
 * Resolves a web image's host and returns the addresses to connect to, after checking every address the host resolves
 * to: one private, loopback, link-local, carrier-grade NAT, unique-local or otherwise non-public address refuses the
 * download, so a public name cannot point the request into the sandbox's own network.
 *
 * @param {string} hostname - The host of a URL accepted by {@link validateWebImageUrl}.
 * @param {typeof dnsLookup} [lookup] - The resolver; tests pass their own.
 * @returns {Promise<{ address: string, family: 4 | 6 }[]>} The checked addresses, IPv4 first.
 */
export async function resolvePublicAddress(hostname, lookup = dnsLookup) {
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch((error) => {
    throw new Error(`Could not resolve ${hostname} (${error?.code ?? "lookup failed"}).`);
  });
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error(`${hostname} resolves to no address.`);
  for (const { address, family } of addresses) {
    const type = family === 6 ? "ipv6" : "ipv4";
    if (isIP(address) !== (family === 6 ? 6 : 4) || NON_PUBLIC_ADDRESSES.check(address, type)) {
      throw new Error(`${hostname} resolves to ${address}, which is not a public address.`);
    }
  }
  return addresses
    .map(({ address, family }) => ({ address, family: family === 6 ? 6 : 4 }))
    .sort((a, b) => a.family - b.family);
}

/**
 * GETs a web image over HTTPS from the addresses {@link resolvePublicAddress} checked, so a second DNS answer cannot
 * swap in another one; Node picks among them as it would among a lookup's answers. TLS still verifies the certificate against the URL's host name. A redirect is never followed:
 * it comes back as a non-OK response.
 */
function fetchFromAddresses(url, addresses, signal) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = https.get(
      url,
      {
        signal,
        lookup: (_hostname, options, callback) =>
          options?.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family),
      },
      (incoming) => {
        const status = incoming.statusCode ?? 0;
        // A Response holds only statuses 200 to 599; anything else, such as a bot wall's 999, is a refusal too.
        if (status < 200 || status > 599) {
          incoming.destroy();
          rejectPromise(new Error(`Could not load the web image asset (HTTP ${status}).`));
          return;
        }
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          const hasBody = ![204, 205, 304].includes(status);
          if (!hasBody) incoming.resume();
          resolvePromise(new Response(hasBody ? Readable.toWeb(incoming) : null, { status, headers }));
        } catch (error) {
          incoming.destroy();
          rejectPromise(error);
        }
      },
    );
    request.on("error", (error) => rejectPromise(new Error("fetch failed", { cause: error })));
  });
}

/**
 * The basename the asset is saved under in public/: a versioned name such as `rork-hero-v1.png`, so a replacement
 * gets a new URL that no cache can answer with the old file.
 */
function validateFilename(type, filename) {
  const media = mediaTypeOf(type);
  const extensions = media.formats.flatMap((format) => format.extensions).join("|");
  const versioned = new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]{0,55}-v[0-9]{1,3}\\.(?:${extensions})$`);
  if (typeof filename !== "string" || !versioned.test(filename)) {
    const example = `rork-hero-v1.${media.formats[0].extensions[0]}`;
    throw new Error(`Choose a versioned ${type} filename without a directory path, such as ${example}.`);
  }
  return filename;
}

/**
 * Every value the app's .env assigns to `EXPO_PUBLIC_PROJECT_ID`, read line by line as Rork's sandbox reads .env.
 * Rork appends envs when it creates an app, so the key can appear more than once.
 */
async function dotenvProjectIds() {
  const contents = await readFile(".env", "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  const values = [];
  for (const line of contents.split("\n")) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] === "EXPO_PUBLIC_PROJECT_ID") values.push(match[2].replace(/^["']|["']$/g, ""));
  }
  return [...new Set(values)];
}

/**
 * This sandbox's project ID. Rork writes `EXPO_PUBLIC_PROJECT_ID` to each app's .env when the sandbox starts or the
 * app is created, and to the shell environment once the agent changes envs; every value set must agree.
 */
export async function currentProjectId() {
  const fromEnvironment = process.env["EXPO_PUBLIC_PROJECT_ID"] ?? "";
  const fromDotenv = await dotenvProjectIds();
  if (fromDotenv.length > 1) {
    throw new Error(`The app's .env sets EXPO_PUBLIC_PROJECT_ID to different values (${fromDotenv.join(", ")}).`);
  }
  const values = new Set([fromEnvironment, ...fromDotenv].filter((value) => value !== ""));
  if (values.size > 1) {
    throw new Error(`EXPO_PUBLIC_PROJECT_ID differs between the environment and the app's .env (${[...values].join(", ")}).`);
  }
  const [projectId] = values;
  if (projectId === undefined) {
    throw new Error("Run this from the app's directory, whose .env sets EXPO_PUBLIC_PROJECT_ID.");
  }
  if (!PROJECT_ID.test(projectId)) throw new Error(`EXPO_PUBLIC_PROJECT_ID is not a Rork project ID: ${projectId}`);
  return projectId;
}

/**
 * Returns `relativePath` inside the app, creating missing folders one level at a time. Every folder on the way must
 * already be a real directory or be created here, so a symlinked src/ or public/ cannot place anything outside the app.
 */
async function appDirectory(relativePath) {
  let directory = await realpath(process.cwd());
  const walked = [];
  for (const segment of relativePath.split("/")) {
    directory = join(directory, segment);
    walked.push(segment);
    const stats = await lstat(directory).catch((error) => {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    });
    if (stats === undefined) {
      await mkdir(directory);
    } else if (!stats.isDirectory()) {
      throw new Error(`${walked.join("/")}/ must be a real directory inside the app, not a symlink.`);
    }
  }
  return directory;
}

/**
 * Runs an FFmpeg tool with a time limit: SIGTERM at the limit, then SIGKILL after a short grace period for a process
 * that ignores it, so a stuck probe or decode cannot hold the download open.
 */
export function runWithTimeout(command, args, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    let timedOut = false;
    let killTimer;
    const child = execFileCallback(command, args, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      clearTimeout(terminateTimer);
      clearTimeout(killTimer);
      if (timedOut) {
        rejectPromise(new Error(`${command} did not finish within ${timeoutMs / 1000} seconds.`));
      } else if (error) {
        rejectPromise(Object.assign(error, { stderr }));
      } else {
        resolvePromise({ stdout, stderr });
      }
    });
    const terminateTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    }, timeoutMs);
  });
}

async function probeMedia(type, path) {
  const { stdout } = await runWithTimeout(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,duration:format=duration",
      "-of",
      "json",
      path,
    ],
    10_000,
  );
  const probe = JSON.parse(stdout);
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const visual = streams.find((stream) => stream?.codec_type === "video");
  const width = Number(visual?.width);
  const height = Number(visual?.height);
  if (!visual || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`The returned asset is not a readable ${type}.`);
  }
  const details = { codec: visual.codec_name, width, height };
  if (type === "image") return details;

  const duration = Number(visual.duration ?? probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("The returned video has no readable duration.");
  return {
    ...details,
    seconds: Math.floor(duration * 1000) / 1000,
    hasAudio: streams.some((stream) => stream?.codec_type === "audio"),
  };
}

/**
 * Decodes every frame and sample, because a probe reads only headers: a truncated or corrupted file would still pass
 * it and then break preview or export. Any decoder error fails the download.
 */
async function decodeFully(type, path, timeoutMs) {
  const { stderr } = await runWithTimeout(
    "ffmpeg",
    ["-nostdin", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"],
    timeoutMs,
  ).catch((error) => {
    throw new Error(`The returned ${type} does not decode: ${String(error.stderr || error.message).trim()}`);
  });
  if (stderr.trim() !== "") throw new Error(`The returned ${type} does not decode: ${stderr.trim()}`);
}

// The preview streams each scene video from the hosting Worker, so a clip is capped at 1080 pixels on its short side,
// the size Rork generates, and never enlarged.
const MAX_VIDEO_SHORT_SIDE = 1080;
const fitVideoSide = (side) => `trunc(${side}*min(1,${MAX_VIDEO_SHORT_SIDE}/min(iw,ih))/2)*2`;

/**
 * Re-encodes a validated clip for the browser: H.264 in yuv420p, which every browser decodes, at CRF 23, with the index
 * moved before the media data (`+faststart`) so playback can start before the whole file has arrived. A generated clip
 * comes in at several times the bitrate a preview needs. The clip's own sound, if any, is copied unchanged.
 */
async function encodeForWeb(sourcePath, outputPath, timeoutMs) {
  await runWithTimeout(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-i",
      sourcePath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      `scale=w='${fitVideoSide("iw")}':h='${fitVideoSide("ih")}'`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      "-f",
      "mp4",
      outputPath,
    ],
    timeoutMs,
  ).catch((error) => {
    throw new Error(`The video could not be re-encoded for the web: ${String(error.stderr || error.message).trim()}`);
  });
}

async function readBoundedBody(type, body, maxBytes) {
  if (!body) throw new Error(`The returned ${type} asset has no response body.`);

  const chunks = [];
  let byteLength = 0;
  for await (const chunk of body) {
    if (byteLength + chunk.byteLength > maxBytes) {
      throw new Error(`The ${type} asset exceeds the ${maxBytes}-byte download limit.`);
    }
    const bytes = Buffer.from(chunk);
    byteLength += bytes.byteLength;
    chunks.push(bytes);
  }
  if (byteLength === 0) throw new Error(`The returned ${type} asset is empty.`);

  return Buffer.concat(chunks, byteLength);
}

/**
 * Downloads one of this project's generated images or videos into the app's public directory after checking
 * its URL and owning project, response type, magic bytes, a full FFmpeg decode and its codec. A video is then re-encoded
 * for streaming playback, at most 1080p, and reports the saved file's size and measured duration. Run it from the motion
 * or presentation app's directory.
 *
 * @param {"image" | "video"} type - The asset type the URL was listed or generated as.
 * @param {string} assetUrl - An image or video URL `rork ai assets info` or a `rork ai` command printed.
 * @param {string} filename - A versioned basename inside `public/` whose extension matches the asset's format.
 * @returns {Promise<{ path: string, src: string, codec: string, width: number, height: number, seconds?: number, hasAudio?: boolean }>}
 * @example await downloadProjectMedia("video", videoUrl, "rork-demo-v1.mp4")
 */
export async function downloadProjectMedia(type, assetUrl, filename) {
  validateFilename(type, filename);
  const url = validateProjectMediaUrl(type, assetUrl, await currentProjectId());
  return saveMedia(type, url, filename, `project ${type}`);
}

/**
 * Downloads an image found on the web, such as a brand's logo from a webSearch or webFetch result, into the app's
 * public directory. Every address its host resolves to must be public, and the request goes only to the checked one.
 * It then gets the same checks as a generated image: no redirects, the size and time limits, MIME type,
 * magic bytes and both extensions agreeing on PNG, JPEG or WebP, its codec and a full FFmpeg decode. The bytes are
 * only ever decoded as an image. Run it from the motion app's directory.
 *
 * @param {string} imageUrl - The image URL, accepted by {@link validateWebImageUrl}.
 * @param {string} filename - A versioned basename inside `public/` whose extension matches the image's format.
 * @param {{ lookup?: typeof dnsLookup }} [options] - The resolver; tests pass their own.
 * @returns {Promise<{ path: string, src: string, codec: string, width: number, height: number }>}
 * @example await downloadWebImage("https://cdn.example.com/brand/logo.png", "example-logo-v1.png")
 */
export async function downloadWebImage(imageUrl, filename, { lookup = dnsLookup } = {}) {
  validateFilename("image", filename);
  const url = validateWebImageUrl(imageUrl);
  const addresses = await resolvePublicAddress(url.hostname.replace(/\.$/, ""), lookup);
  return saveMedia("image", url, filename, "web image", (signal) => fetchFromAddresses(url, addresses, signal));
}

/**
 * Fetches a validated URL and saves it to public/ once its response, bytes, codec and full decode check out. `source`
 * names where the asset comes from in error messages, such as "project image" or "web image". `request` GETs the URL
 * without following redirects; by default it is `fetch` with redirects as errors.
 */
async function saveMedia(type, url, filename, source, request = (signal) => fetch(url.href, { redirect: "error", signal })) {
  const media = mediaTypeOf(type);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), media.timeoutMs);

  let response;
  let bytes;
  let format;
  try {
    response = await request(controller.signal);
    if (!response.ok) throw new Error(`Could not load the ${source} asset (HTTP ${response.status}).`);

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    format = media.formats.find((candidate) => candidate.mimeType === contentType);
    if (!format) {
      throw new Error(`The ${source} asset did not return ${media.formats.map((f) => f.mimeType).join(" or ")}.`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      const declaredLength = Number(contentLength);
      if (!Number.isSafeInteger(declaredLength) || declaredLength <= 0 || declaredLength > media.maxBytes) {
        throw new Error(`The ${type} asset exceeds the ${media.maxBytes}-byte download limit.`);
      }
    }

    bytes = await readBoundedBody(type, response.body, media.maxBytes);
  } catch (error) {
    controller.abort();
    if (response?.body && !response.body.locked) {
      void response.body.cancel().catch(() => {});
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!format.extensions.includes(extensionOf(url.pathname))) {
    throw new Error(`The ${source} URL ends in .${extensionOf(url.pathname)}, but it returned ${format.mimeType}.`);
  }
  if (!format.matches(bytes)) {
    throw new Error(`The ${source} asset's contents are not ${format.mimeType}.`);
  }
  if (!format.extensions.includes(extensionOf(filename))) {
    throw new Error(`The asset is ${format.mimeType}; save it with a .${format.extensions[0]} filename.`);
  }

  const publicDirectory = await appDirectory("public");
  const destination = join(publicDirectory, filename);
  const temporaryPath = `${destination}.${randomUUID()}.tmp`;
  const encodedPath = `${destination}.${randomUUID()}.tmp`;
  let details;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    details = await probeMedia(type, temporaryPath);
    if (!format.codecs.includes(details.codec)) {
      throw new Error(`The ${type} uses the ${details.codec} codec, which the player and export cannot use.`);
    }
    await decodeFully(type, temporaryPath, media.decodeTimeoutMs);
    if (type === "video") {
      await encodeForWeb(temporaryPath, encodedPath, media.encodeTimeoutMs);
      // Report the saved file, whose size the encode may have reduced.
      details = await probeMedia(type, encodedPath);
      await rename(encodedPath, destination);
    } else {
      await rename(temporaryPath, destination);
    }
  } finally {
    await Promise.all([temporaryPath, encodedPath].map((path) => rm(path, { force: true }).catch(() => {})));
  }

  return { path: destination, src: `/${filename}`, ...details };
}

async function main() {
  const [type, assetUrl, filename] = process.argv.slice(2);
  if (!type || !assetUrl || !filename) {
    throw new Error("Usage: node scripts/download-media.mjs <image|video|web-image> <url> <versioned-filename>");
  }

  const saved =
    type === "web-image"
      ? await downloadWebImage(assetUrl, filename)
      : await downloadProjectMedia(type, assetUrl, filename);
  const size = `${saved.width}×${saved.height}`;
  const video =
    saved.seconds === undefined ? "" : `, ${saved.seconds}s, ${saved.hasAudio ? "with" : "without"} an audio stream`;
  process.stdout.write(`Saved validated ${type} to ${saved.path} as ${saved.src} (${size}${video})\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not save the project asset.");
    process.exitCode = 1;
  });
}
