/**
 * WebAuthn (パスキー) による生体認証ユーティリティ
 *
 * 仕組み:
 * 1. メール/パスワードで初回ログイン後、デバイスの生体認証（Face ID等）を登録
 * 2. Supabase のリフレッシュトークンをデバイスのパスキーに紐付けてlocalStorageに保存
 * 3. 次回以降、生体認証だけでログイン可能
 *
 * セキュリティ: リフレッシュトークンはlocalStorageに保存されるが、
 * WebAuthn認証を通過しないとアプリがセッションを復元しないため、
 * デバイスの生体認証がゲートとして機能する。
 */

const STORAGE_KEY = 'kakeibo_webauthn_credential';

interface StoredCredential {
  credentialId: string;
  refreshToken: string;
  email: string;
}

/** WebAuthnがこのデバイス/ブラウザで利用可能か */
export async function isWebAuthnAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/** 登録済みのパスキーがあるか */
export function hasStoredCredential(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null;
  } catch {
    return false;
  }
}

/** 保存済みのメールアドレスを取得 */
export function getStoredEmail(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const data: StoredCredential = JSON.parse(stored);
    return data.email;
  } catch {
    return null;
  }
}

/** パスキーを登録する（メール/パスワードログイン成功後に呼ぶ） */
export async function registerPasskey(
  email: string,
  refreshToken: string
): Promise<boolean> {
  try {
    const userId = new TextEncoder().encode(email);

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const createOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: '家計簿アプリ',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: email,
        displayName: email.split('@')[0],
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // デバイス内蔵の認証器のみ
        userVerification: 'required',        // 生体認証必須
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = await navigator.credentials.create({
      publicKey: createOptions,
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    // credentialIdとリフレッシュトークンを保存
    const credentialId = btoa(
      String.fromCharCode(...new Uint8Array(credential.rawId))
    );

    const storedData: StoredCredential = {
      credentialId,
      refreshToken,
      email,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
    return true;
  } catch (err) {
    console.error('Passkey registration failed:', err);
    return false;
  }
}

/** パスキーで認証する → 成功したらリフレッシュトークンを返す */
export async function authenticateWithPasskey(): Promise<{
  refreshToken: string;
  email: string;
} | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: StoredCredential = JSON.parse(stored);
    const credentialIdBytes = Uint8Array.from(atob(data.credentialId), (c) => c.charCodeAt(0));

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: credentialIdBytes,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: getOptions,
    }) as PublicKeyCredential | null;

    if (!assertion) return null;

    // 生体認証を通過 → 保存済みのリフレッシュトークンを返す
    return {
      refreshToken: data.refreshToken,
      email: data.email,
    };
  } catch (err) {
    console.error('Passkey authentication failed:', err);
    return null;
  }
}

/** リフレッシュトークンを更新（セッションリフレッシュ後に呼ぶ） */
export function updateStoredRefreshToken(newToken: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const data: StoredCredential = JSON.parse(stored);
    data.refreshToken = newToken;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** パスキー登録を削除 */
export function removeStoredCredential(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
