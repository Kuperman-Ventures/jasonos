/**
 * Platform-first passkey helpers.
 *
 * Supabase Auth / browsers often default to cross-platform / security-key hints,
 * which surfaces a QR “use your phone” sheet instead of Touch ID / Face ID.
 * These helpers use the two-step passkey API and force this-device authenticators.
 */

/** Structural slice of the Supabase Auth passkey API we call. */
type AuthClient = { auth: { passkey: any } }; // eslint-disable-line @typescript-eslint/no-explicit-any

type CreationOptionsJSON = {
  challenge: string;
  rp: { name: string; id?: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: Array<{
    id: string;
    type: PublicKeyCredentialType;
    transports?: AuthenticatorTransport[];
  }>;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  extensions?: AuthenticationExtensionsClientInputs;
  hints?: string[];
};

type RequestOptionsJSON = {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{
    id: string;
    type: PublicKeyCredentialType;
    transports?: AuthenticatorTransport[];
  }>;
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
  hints?: string[];
};

/** Prefer Touch ID / Face ID / Windows Hello on this machine — not a QR phone hop. */
export function preferPlatformCreationOptions<T extends CreationOptionsJSON>(options: T): T {
  const previous = options.authenticatorSelection ?? {};
  return {
    ...options,
    hints: ["client-device"],
    attestation: options.attestation === "direct" ? "none" : options.attestation,
    authenticatorSelection: {
      ...previous,
      authenticatorAttachment: "platform",
      userVerification: previous.userVerification ?? "required",
      residentKey: previous.residentKey === "discouraged" ? "preferred" : previous.residentKey ?? "preferred",
      requireResidentKey:
        previous.requireResidentKey === true
          ? true
          : previous.residentKey === "required"
            ? true
            : false,
    },
  };
}

/** Prefer credentials already on this device during unlock. */
export function preferPlatformRequestOptions<T extends RequestOptionsJSON>(options: T): T {
  return {
    ...options,
    hints: ["client-device"],
    userVerification: options.userVerification ?? "required",
  };
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function parseCreationOptions(options: CreationOptionsJSON): PublicKeyCredentialCreationOptions {
  const parse = (
    PublicKeyCredential as unknown as {
      parseCreationOptionsFromJSON?: (
        options: CreationOptionsJSON
      ) => PublicKeyCredentialCreationOptions;
    }
  ).parseCreationOptionsFromJSON;
  if (typeof parse === "function") return parse(options);

  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToBuffer(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((cred) => ({
      ...cred,
      id: base64UrlToBuffer(cred.id),
    })),
  } as PublicKeyCredentialCreationOptions;
}

function parseRequestOptions(options: RequestOptionsJSON): PublicKeyCredentialRequestOptions {
  const parse = (
    PublicKeyCredential as unknown as {
      parseRequestOptionsFromJSON?: (
        options: RequestOptionsJSON
      ) => PublicKeyCredentialRequestOptions;
    }
  ).parseRequestOptionsFromJSON;
  if (typeof parse === "function") return parse(options);

  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((cred) => ({
      ...cred,
      id: base64UrlToBuffer(cred.id),
    })),
  } as PublicKeyCredentialRequestOptions;
}

function serializeCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const withJson = credential as PublicKeyCredential & {
    toJSON?: () => Record<string, unknown>;
  };
  if (typeof withJson.toJSON === "function") return withJson.toJSON();

  const response = credential.response;
  if (response instanceof AuthenticatorAttestationResponse) {
    return {
      id: credential.id,
      rawId: credential.id,
      type: "public-key",
      clientExtensionResults: credential.getClientExtensionResults(),
      authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
      response: {
        attestationObject: bytesToBase64Url(response.attestationObject),
        clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      },
    };
  }

  const assertion = response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: credential.id,
    type: "public-key",
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    response: {
      authenticatorData: bytesToBase64Url(assertion.authenticatorData),
      clientDataJSON: bytesToBase64Url(assertion.clientDataJSON),
      signature: bytesToBase64Url(assertion.signature),
      userHandle: assertion.userHandle ? bytesToBase64Url(assertion.userHandle) : undefined,
    },
  };
}

export async function registerPlatformPasskey(supabase: AuthClient) {
  const { data, error } = await supabase.auth.passkey.startRegistration();
  if (error || !data) return { data: null, error: error ?? new Error("No registration challenge") };

  const publicKey = parseCreationOptions(
    preferPlatformCreationOptions(data.options as CreationOptionsJSON)
  );
  const credential = await navigator.credentials.create({ publicKey });
  if (!(credential instanceof PublicKeyCredential)) {
    return { data: null, error: new Error("Face ID / Touch ID did not complete.") };
  }

  return supabase.auth.passkey.verifyRegistration({
    challengeId: data.challenge_id,
    credential: serializeCredential(credential) as never,
  });
}

export async function signInWithPlatformPasskey(supabase: AuthClient) {
  const { data, error } = await supabase.auth.passkey.startAuthentication();
  if (error || !data) return { data: null, error: error ?? new Error("No authentication challenge") };

  const publicKey = parseRequestOptions(
    preferPlatformRequestOptions(data.options as RequestOptionsJSON)
  );
  const credential = await navigator.credentials.get({ publicKey });
  if (!(credential instanceof PublicKeyCredential)) {
    return { data: null, error: new Error("Face ID / Touch ID did not complete.") };
  }

  return supabase.auth.passkey.verifyAuthentication({
    challengeId: data.challenge_id,
    credential: serializeCredential(credential) as never,
  });
}
