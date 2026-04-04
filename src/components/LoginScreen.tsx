import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  isWebAuthnAvailable,
  hasStoredCredential,
  getStoredEmail,
  registerPasskey,
  authenticateWithPasskey,
  updateStoredRefreshToken,
  removeStoredCredential,
} from '../lib/webauthn';

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 生体認証の状態
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // 初期化: 生体認証が使えるか確認
  useEffect(() => {
    async function checkBiometric() {
      const available = await isWebAuthnAvailable();
      setBiometricAvailable(available);
      if (available) {
        const registered = hasStoredCredential();
        setBiometricRegistered(registered);
        if (registered) {
          setStoredEmail(getStoredEmail());
        }
      }
    }
    checkBiometric();
  }, []);

  // メール/パスワードでログイン
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // ログイン成功 → 生体認証が使えて未登録なら登録を提案
      // biometricAvailable state が古い可能性があるため、ここで再チェック
      const canUseBiometric = biometricAvailable || await isWebAuthnAvailable();
      if (canUseBiometric && !hasStoredCredential() && data.session?.refresh_token) {
        setBiometricAvailable(true);
        setShowRegisterPrompt(true);
        setLoading(false);
        return;
      }

      // 生体認証が既に登録済みならトークンを更新
      if (hasStoredCredential() && data.session?.refresh_token) {
        updateStoredRefreshToken(data.session.refresh_token);
      }

      onLogin();
    } catch {
      setError('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 生体認証を登録
  const handleRegisterBiometric = async () => {
    setBiometricLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const refreshToken = data.session?.refresh_token;
      if (!refreshToken) {
        setError('セッション取得に失敗しました');
        onLogin(); // とりあえずログインは成功させる
        return;
      }

      const success = await registerPasskey(email, refreshToken);
      if (success) {
        setBiometricRegistered(true);
      }
      onLogin();
    } catch {
      onLogin(); // 生体認証登録に失敗してもログインは成功させる
    } finally {
      setBiometricLoading(false);
    }
  };

  // 生体認証でログイン
  const handleBiometricLogin = async () => {
    setError('');
    setBiometricLoading(true);

    try {
      const result = await authenticateWithPasskey();
      if (!result) {
        setError('生体認証に失敗しました');
        setBiometricLoading(false);
        return;
      }

      // リフレッシュトークンでセッション復元
      const { data, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: result.refreshToken,
      });

      if (refreshError || !data.session) {
        setError('セッションの復元に失敗しました。パスワードでログインしてください。');
        removeStoredCredential();
        setBiometricRegistered(false);
        setBiometricLoading(false);
        return;
      }

      // 新しいリフレッシュトークンで更新
      if (data.session.refresh_token) {
        updateStoredRefreshToken(data.session.refresh_token);
      }

      onLogin();
    } catch {
      setError('生体認証に失敗しました');
    } finally {
      setBiometricLoading(false);
    }
  };

  // 生体認証登録プロンプト
  if (showRegisterPrompt) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>🔐</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
            生体認証を登録
          </h2>
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
            Face ID / Touch ID / Windows Hello で<br />
            次回から簡単にログインできます
          </p>

          <button
            onClick={handleRegisterBiometric}
            disabled={biometricLoading}
            className="login-btn biometric-register-btn"
            style={{ marginBottom: 8 }}
          >
            {biometricLoading ? '登録中...' : '生体認証を登録する'}
          </button>
          <button
            onClick={() => { setShowRegisterPrompt(false); onLogin(); }}
            className="login-btn biometric-skip-btn"
          >
            スキップ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <h1 className="login-title">ログイン</h1>

        {/* 生体認証ボタン（登録済みの場合） */}
        {biometricAvailable && biometricRegistered && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="biometric-login-btn"
            >
              <span className="biometric-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" opacity="0.15" fill="currentColor"/>
                  <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none"/>
                  <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <path d="M4.93 4.93l2.83 2.83"/>
                  <path d="M19.07 4.93l-2.83 2.83"/>
                </svg>
              </span>
              <span className="biometric-label">
                {biometricLoading ? '認証中...' : '生体認証でログイン'}
              </span>
              {storedEmail && (
                <span className="biometric-email">{storedEmail}</span>
              )}
            </button>

            <div className="biometric-divider">
              <span>または</span>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              パスワード
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        {/* 生体認証の登録解除リンク（登録済みの場合） */}
        {biometricRegistered && (
          <button
            onClick={() => {
              removeStoredCredential();
              setBiometricRegistered(false);
              setStoredEmail(null);
            }}
            style={{
              background: 'none', border: 'none', color: '#999', fontSize: 11,
              cursor: 'pointer', marginTop: 12, textDecoration: 'underline',
            }}
          >
            生体認証の登録を解除
          </button>
        )}
      </div>
    </div>
  );
}
