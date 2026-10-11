function secretsEqual(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

export function cronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  const provided = match?.[1];
  if (!provided) return false;
  return secretsEqual(secret, provided);
}

export function cronUnauthorizedResponse(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
