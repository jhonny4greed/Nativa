import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { shortClip, fallbackVoice, SOUND_BUCKET } from "../js/audio-clips.js";
import { createNativeSoundService } from "../js/native-sounds.js";
import { createArenaSounds } from "../js/arena-sounds.js";
import { createEpidemicSoundHandler } from "../supabase/functions/epidemic-sound/handler.js";

function decoded() {
  const samples = new Float32Array(24000 * 4);
  for (let i = 24000; i < samples.length; i++) samples[i] = .4 * Math.sin(i / 13);
  return { length: samples.length, duration: 4, sampleRate: 24000, numberOfChannels: 1, getChannelData: () => samples };
}
function memoryCloud() {
  const files = new Map(), calls = []; let userId = "owner-a", failSecond = false;
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: userId } } } }) },
    functions: { invoke: async (name, { body }) => { calls.push(body.action); return { data: new Blob(["source"], { type: "audio/mpeg" }) }; } },
    storage: { from(bucket) { assert.equal(bucket, SOUND_BUCKET); return {
      async upload(path, blob) { if (failSecond && files.size === 1) return { error: new Error("upload failed") }; files.set(path, blob); return {}; },
      async download(path) { return { data: files.get(path) || null }; },
      async remove(paths) { for (const path of paths) files.delete(path); return {}; }
    }; } }
  };
  return { client, files, calls, switchUser: id => { userId = id; }, failSecond: () => { failSecond = true; } };
}

test("recorta silêncio inicial, aplica fades e produz WAVs de 1,8 e 1,5 segundo", async () => {
  for (const seconds of [1.5, 1.8, 8]) {
    const blob = shortClip(decoded(), seconds), view = new DataView(await blob.arrayBuffer());
    assert.equal(blob.type, "audio/wav");
    assert.equal(view.getUint32(40, true) / view.getUint32(28, true), Math.min(seconds, 2));
    assert.equal(view.getInt16(44, true), 0);
    assert.equal(view.getInt16(view.byteLength - 2, true), 0);
    assert.ok(Math.abs(view.getInt16(44 + 2400 * 2, true)) > 100, "o trecho já contém som após 100 ms");
  }
  assert.throws(() => shortClip({ ...decoded(), getChannelData: () => new Float32Array(96000) }, 1.8), /silenciosa/);
});

test("os sons básicos são arquivos do site, válidos e limitados a dois segundos", async () => {
  const folder = new URL("../assets/audio/sfx/", import.meta.url), files = await readdir(folder);
  assert.equal(files.length, 12);
  for (const file of files) {
    const bytes = await readFile(new URL(file, folder));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    const duration = bytes.readUInt32LE(40) / bytes.readUInt32LE(28);
    assert.ok(duration >= 1.5 && duration <= 2, file);
  }
  assert.equal(fallbackVoice({ species: "Lobo-guará", groupBio: "Mamíferos" }), "mammal");
  assert.equal(fallbackVoice({ species: "Rã", groupBio: "Anfíbios" }), "amphibian");
  assert.equal(fallbackVoice({ lineageName: "Aves de rapina" }), "bird");
});

test("salvar usa download oficial e outra instância recupera os dois arquivos permanentes", async () => {
  const cloud = memoryCloud();
  const service = createNativeSoundService({ clientProvider: () => cloud.client, decode: async () => decoded() });
  await service.preview({ id: "sound-test-123" });
  assert.equal(cloud.files.size, 0, "prévia não é armazenada");
  const effect = await service.save({ id: "native-a", ownerId: "owner-a" }, { id: "sound-test-123", title: "Coruja" });
  assert.deepEqual(cloud.calls, ["previewAudio", "download"]);
  assert.equal(cloud.files.size, 2);
  assert.match(effect.cryPath, /^owner-a\/native-a\/.*-cry\.wav$/);
  assert.equal(effect.crySeconds, 1.8); assert.equal(effect.attackSeconds, 1.5);
  assert.equal(JSON.stringify(effect).includes("http"), false);
  const anotherDevice = createNativeSoundService({ clientProvider: () => cloud.client });
  assert.equal((await anotherDevice.load({ soundEffect: effect }, "cry")).size, 86444);
  assert.equal((await anotherDevice.load({ soundEffect: effect }, "attack")).size, 72044);
});

test("áudio próprio dispensa catálogo e falha parcial remove o primeiro arquivo", async () => {
  const cloud = memoryCloud(); cloud.failSecond();
  const service = createNativeSoundService({ clientProvider: () => cloud.client, decode: async () => decoded() });
  await assert.rejects(service.save({ id: "native-a" }, { file: new Blob(["upload"]) }), /upload failed/);
  assert.equal(cloud.files.size, 0); assert.deepEqual(cloud.calls, []);
});

test("troca de conta durante o preparo impede upload e vínculo", async () => {
  const cloud = memoryCloud();
  const service = createNativeSoundService({ clientProvider: () => cloud.client, decode: async () => { cloud.switchUser("owner-b"); return decoded(); } });
  await assert.rejects(service.save({ id: "native-a", ownerId: "owner-a" }, { file: new Blob(["upload"]) }), /conta mudou/);
  assert.equal(cloud.files.size, 0);
  await assert.rejects(service.save({ id: "native-a", ownerId: "owner-a" }, { file: new Blob(["upload"]) }), /não pertence/);
});

function handler(fetchProvider) {
  return createEpidemicSoundHandler({ env: name => ({ SUPABASE_URL: "https://db.test", SUPABASE_ANON_KEY: "public", EPIDEMIC_SOUND_API_KEY: "server-secret" })[name],
    fetchImpl: async (url, options) => String(url).includes("/auth/v1/user") ? Response.json({ id: "owner-a" }) : fetchProvider(url, options) });
}
const request = (action, extra = {}) => new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer user-token" }, body: JSON.stringify({ action, id: "sound-test-123", ...extra }) });

test("API faz proxy do MP3, separa prévia e download e mantém assinatura do link", async () => {
  for (const [action, suffix] of [["previewAudio", "/preview"], ["download", "/download?quality=normal"]]) {
    const calls = [], signed = "https://pdn.epidemicsound.com/test.mp3?exp=123&signature=test";
    const run = handler(async (url, options) => {
      calls.push(String(url));
      if (String(url).includes("api.epidemicsound.com")) { assert.equal(options.headers.Authorization, "Bearer server-secret"); return Response.json({ url: signed }); }
      assert.equal(options.headers, undefined, "não envia credenciais para o CDN");
      return new Response(new Uint8Array([73, 68, 51, 0, 1]), { headers: { "Content-Type": "audio/mpeg" } });
    });
    const response = await run(request(action));
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.ok(calls[0].endsWith(suffix)); assert.equal(calls[1], signed);
    assert.equal((await response.arrayBuffer()).byteLength, 5);
  }
});

test("API recusa sessão ausente, endereço externo, áudio inválido e arquivo grande", async () => {
  const noAuth = await handler(() => assert.fail("não deve consultar catálogo"))(new Request("https://edge.test", { method: "POST" }));
  assert.equal(noAuth.status, 401);
  const badUrl = await handler(async () => Response.json({ url: "https://attacker.test/audio" }))(request("download"));
  assert.equal(badUrl.status, 502);
  for (const media of [new Response("<html>error</html>"), new Response("ID3", { headers: { "Content-Length": 8_000_000 } })]) {
    const response = await handler(async url => String(url).includes("api.epidemicsound.com") ? Response.json({ url: "https://pdn.epidemicsound.com/sound.mp3" }) : media)(request("download"));
    assert.ok([413, 502].includes(response.status));
  }
});

test("falhas do catálogo mostram causas específicas sem expor chave ou link", async () => {
  for (const [status, message] of [[401, /credencial/], [402, /quota/], [429, /muitas solicitações/]]) {
    const response = await handler(async () => Response.json({ secret: "server-secret" }, { status }))(request("search", { term: "coruja" }));
    const data = await response.json();
    assert.match(data.error, message); assert.doesNotMatch(JSON.stringify(data), /server-secret/);
  }
});

function fakeContext(log) {
  let current = 0;
  return { state: "running", currentTime: 0, destination: {}, resume: async () => {}, decodeAudioData: async () => ({ duration: 1.8 }),
    createGain: () => ({ gain: { setValueAtTime() {}, setTargetAtTime() {} }, connect() {}, disconnect() {} }),
    createBufferSource() {
      let timer, ended = false;
      const node = { connect() {}, disconnect() {}, start(_when, _offset, seconds) {
        current++; assert.equal(current, 1, "somente uma Nativa toca por vez"); log.push(seconds); timer = setTimeout(() => node.stop(), 4);
      }, stop() { if (ended) return; ended = true; clearTimeout(timer); current--; node.onended?.(); } };
      return node;
    }
  };
}
test("arena toca entradas em sequência, golpes de acerto/erro/suporte e respeita silêncio", async () => {
  const log = [], settings = { sounds: true }, fighters = [{ nativa: { name: "A" } }, { nativa: { name: "B" } }];
  const player = createArenaSounds({ preferences: () => settings, contextFactory: () => fakeContext(log), fetchImpl: async () => new Response("wav") });
  await player.start(fighters); assert.deepEqual(log, [1.8, 1.8]);
  await player.actions([{ type: "hit", actor: 0 }, { type: "miss", actor: 1 }, { type: "support", actor: 0 }, { type: "defend", actor: 1 }], fighters);
  assert.deepEqual(log, [1.8, 1.8, 1.5, 1.5, 1.5]);
  settings.sounds = false; await player.start(fighters); assert.equal(log.length, 5);
});
test("sair da arena cancela carregamento pendente sem tocar sons atrasados", async () => {
  const log = []; let release;
  const player = createArenaSounds({ preferences: () => ({ sounds: true }), contextFactory: () => fakeContext(log), fetchImpl: () => new Promise(resolve => { release = resolve; }) });
  const pending = player.start([{ nativa: {} }, { nativa: {} }]);
  await new Promise(resolve => setTimeout(resolve, 0)); player.stop(); release(new Response("wav"));
  await pending; assert.deepEqual(log, []);
});
