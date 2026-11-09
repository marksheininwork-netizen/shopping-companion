import assert from "node:assert/strict";
import test from "node:test";
import { verifyPagesAccessToken } from "../functions/api/v1/customer/[[path]].js";

const encoder = new TextEncoder();
let caseId = 0;

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function encodeJson(value) {
  return encodeBase64Url(JSON.stringify(value));
}

async function makeSigner() {
  const keyPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const kid = `test-key-${++caseId}`;
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  Object.assign(jwk, { kid, alg: "RS256", use: "sig" });
  const teamDomain = `https://nsc-test-${caseId}.cloudflareaccess.com`;
  const env = { ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUDIENCE: `audience-${caseId}` };
  const fetchImpl = async (url) => {
    assert.equal(new URL(url).href, new URL("/cdn-cgi/access/certs", teamDomain).href);
    return new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  async function sign(payload, header = { alg: "RS256", kid }) {
    const encodedHeader = encodeJson(header);
    const encodedPayload = encodeJson(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keyPair.privateKey,
      encoder.encode(signingInput),
    );
    return `${signingInput}.${encodeBase64Url(signature)}`;
  }

  return { env, fetchImpl, sign };
}

function validClaims(env, overrides = {}) {
  return {
    iss: env.ACCESS_TEAM_DOMAIN,
    aud: [env.ACCESS_AUDIENCE],
    exp: Math.floor(Date.now() / 1000) + 600,
    nbf: Math.floor(Date.now() / 1000) - 10,
    sub: "customer-subject-123",
    email: "Customer@Example.test",
    ...overrides,
  };
}

test("valid RS256 Access assertion returns stable subject and normalized email", async () => {
  const signer = await makeSigner();
  const token = await signer.sign(validClaims(signer.env));
  const identity = await verifyPagesAccessToken(token, signer.env, signer.fetchImpl);

  assert.deepEqual(identity, {
    id: "customer-subject-123",
    email: "customer@example.test",
  });
});

test("tampered JWT payload is rejected after signature verification", async () => {
  const signer = await makeSigner();
  const token = await signer.sign(validClaims(signer.env));
  const [header, , signature] = token.split(".");
  const tamperedPayload = encodeJson(validClaims(signer.env, { sub: "attacker-subject" }));

  assert.equal(
    await verifyPagesAccessToken(`${header}.${tamperedPayload}.${signature}`, signer.env, signer.fetchImpl),
    null,
  );
});

test("wrong issuer, audience, expired, and premature assertions are rejected", async () => {
  for (const override of [
    { iss: "https://wrong.cloudflareaccess.com" },
    { aud: ["wrong-audience"] },
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { nbf: Math.floor(Date.now() / 1000) + 60 },
  ]) {
    const signer = await makeSigner();
    const token = await signer.sign(validClaims(signer.env, override));
    assert.equal(await verifyPagesAccessToken(token, signer.env, signer.fetchImpl), null);
  }
});

test("missing email and unknown signing key are rejected", async () => {
  const signer = await makeSigner();
  const noEmail = await signer.sign(validClaims(signer.env, { email: undefined }));
  assert.equal(await verifyPagesAccessToken(noEmail, signer.env, signer.fetchImpl), null);

  const unknownKey = await signer.sign(validClaims(signer.env), { alg: "RS256", kid: "unknown-key" });
  assert.equal(await verifyPagesAccessToken(unknownKey, signer.env, signer.fetchImpl), null);
});

test("unavailable Access JWKS fails closed", async () => {
  const signer = await makeSigner();
  const token = await signer.sign(validClaims(signer.env));
  const unavailable = async () => new Response("unavailable", { status: 503 });

  assert.equal(await verifyPagesAccessToken(token, signer.env, unavailable), null);
});
