import { api } from './api.js';
import { state } from './state.js';
import { offlineStore } from './offline.js';
import { showToast, showConfirm } from './utils.js';

let offlineMode = false;

// DOM Elements
const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authModalTitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchText = document.getElementById('authSwitchText');
const authSwitchBtn = document.getElementById('authSwitchBtn');
const authUsernameInput = document.getElementById('authUsername');
const authPasswordInput = document.getElementById('authPassword');
const authSwitchContainer = document.querySelector('.auth-switch');

let canRegister = true;

function setSessionRevoked(flag) {
    state.sessionRevoked = flag;
    offlineStore.setSessionRevoked(flag);
}

export const auth = {

    revokeSession() {
        const preservedUser = state.currentUser || offlineStore.getUser();
        setSessionRevoked(true);
        if (preservedUser) {
            state.currentUser = preservedUser;
            offlineStore.setUser(preservedUser);
        }
        showToast('会话已过期，已切换到离线编辑模式，请重新登录后同步', 5000);
        console.log('[Auth] Session revoked, keep local editing mode');
    },

    async checkStatus(callbacks = {}) {
        if (!navigator.onLine) {
            console.log('[Auth] Offline mode detected');
            offlineMode = true;
            const user = offlineStore.getUser();
            if (user) {
                state.currentUser = user;
                state.sessionRevoked = offlineStore.isSessionRevoked();
                this.updateUI(true);
                showToast(state.sessionRevoked ? '离线编辑模式 - 重新登录后可同步' : '离线模式 - 显示缓存内容');
                if (callbacks.onLogin) callbacks.onLogin();
            } else {
                setSessionRevoked(false);
                this.updateUI(false);
                showToast('离线模式 - 请连接网络登录');
                if (callbacks.onLogout) callbacks.onLogout();
            }
            return;
        }

        try {
            const [statusResp, registerResp] = await Promise.all([
                api.auth.status(),
                fetch('/api/auth/can-register').catch(() => null)
            ]);

            if (!statusResp) {
                console.log('[Auth] Status check failed, trying cache');
                const user = offlineStore.getUser();
                if (user) {
                    state.currentUser = user;
                    state.sessionRevoked = offlineStore.isSessionRevoked();
                    this.updateUI(true);
                    if (callbacks.onLogin) callbacks.onLogin();
                } else {
                    setSessionRevoked(false);
                    if (callbacks.onLogout) callbacks.onLogout();
                }
                return;
            }
            const data = await statusResp.json();

            if (registerResp && registerResp.ok) {
                const registerData = await registerResp.json();
                canRegister = registerData.can_register;
            }

            if (data.is_authenticated) {
                state.currentUser = data.user;
                offlineStore.setUser(data.user);
                setSessionRevoked(false);
                this.updateUI(true);
                if (callbacks.onLogin) callbacks.onLogin();
            } else {
                const user = offlineStore.getUser();
                if (user) {
                    state.currentUser = user;
                    this.revokeSession();
                    this.updateUI(true);
                    if (callbacks.onSessionRevoked) callbacks.onSessionRevoked();
                    else if (callbacks.onLogin) callbacks.onLogin();
                } else {
                    state.currentUser = null;
                    setSessionRevoked(false);
                    this.updateUI(false);
                    if (callbacks.onLogout) callbacks.onLogout();
                }
            }

            offlineMode = false;
        } catch (e) {
            console.error("Auth check failed (network/server error):", e);
            const user = offlineStore.getUser();
            if (user) {
                state.currentUser = user;
                state.sessionRevoked = offlineStore.isSessionRevoked();
                this.updateUI(true);
                if (callbacks.onLogin) callbacks.onLogin();
            } else {
                setSessionRevoked(false);
                this.updateUI(false);
                if (callbacks.onLogout) callbacks.onLogout();
            }
        }
    },

    updateUI(isLoggedIn) {
        const userProfile = document.getElementById('userProfile');
        const blogBrand = document.getElementById('blogBrand');
        const ownerNav = document.getElementById('ownerNav');
        const guestFooter = document.getElementById('guestFooter');

        const noteInputSection = document.getElementById('noteInputSection');
        const userNameDisplay = document.getElementById('userName');
        const statsSection = document.getElementById('statsSection');

        const show = (el, display = 'block') => {
            if (el) {
                el.style.display = display;
                el.classList.remove('animate-fade-in');
                void el.offsetWidth;
                el.classList.add('animate-fade-in');
            }
        };
        const hide = (el) => { if (el) el.style.display = 'none'; };

        if (isLoggedIn) {
            show(userProfile, 'flex');
            hide(blogBrand);
            show(ownerNav);
            hide(guestFooter);
            show(noteInputSection);
            if (userNameDisplay) userNameDisplay.textContent = state.currentUser.username;
            show(statsSection);
        } else {
            hide(userProfile);
            show(blogBrand);
            hide(ownerNav);
            show(guestFooter);
            hide(noteInputSection);
            show(statsSection);
        }
    },

    openModal(isLogin) {
        if (authModal) {
            if (!isLogin && !canRegister) {
                isLogin = true;
                showToast('系统已注册，请登录');
            }

            authModal.style.display = 'block';
            authModal.dataset.mode = isLogin ? 'login' : 'register';
            if (authTitle) authTitle.textContent = isLogin ? '登录' : '注册';
            if (authSubmitBtn) authSubmitBtn.textContent = isLogin ? '登录' : '注册';

            if (authSwitchContainer) {
                authSwitchContainer.style.display = canRegister ? 'block' : 'none';
            }

            if (canRegister && authSwitchText && authSwitchBtn) {
                authSwitchText.textContent = isLogin ? '没有账号？' : '已有账号？';
                authSwitchBtn.textContent = isLogin ? '去注册' : '去登录';
            }

            if (authUsernameInput) authUsernameInput.focus();
        }
    },

    closeModal() {
        if (authModal) authModal.style.display = 'none';
    },

    async loginWithWebAuthn(onSuccess) {
        try {
            const username = authUsernameInput.value.trim();
            const resp = await api.auth.webauthn.loginBegin(username);
            if (!resp || !resp.ok) {
                throw new Error('API_START_FAILED');
            }
            const options = await resp.json();

            options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
            if (options.allowCredentials) {
                options.allowCredentials.forEach(cred => {
                    cred.id = Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
                });
            }

            const assertion = await navigator.credentials.get({ publicKey: options });

            const body = {
                id: assertion.id,
                rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
                type: assertion.type,
                response: {
                    authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
                    clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
                    signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
                    userHandle: assertion.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(assertion.response.userHandle))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : null
                }
            };

            const completeResp = await api.auth.webauthn.loginComplete(body);
            if (completeResp && completeResp.ok) {
                showToast('登录成功');
                this.closeModal();
                await this.checkStatus({ onLogin: onSuccess });
                return true;
            } else {
                const errData = await completeResp.json();
                showToast(errData.error || '生物识别认证失败');
                return false;
            }
        } catch (e) {
            console.error("WebAuthn Login Error:", e);
            if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
                auth.openModal(true);
            } else {
                showToast('生物识别过程中出错');
                auth.openModal(true);
            }
            return false;
        }
    },

    async registerWebAuthn() {
        try {
            const resp = await api.auth.webauthn.registerBegin();
            if (!resp || !resp.ok) {
                showToast('注册请求失败');
                return;
            }
            const options = await resp.json();

            options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
            options.user.id = Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
            if (options.excludeCredentials) {
                options.excludeCredentials.forEach(cred => {
                    cred.id = Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
                });
            }

            const credential = await navigator.credentials.create({ publicKey: options });

            const body = {
                id: credential.id,
                rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
                type: credential.type,
                response: {
                    attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
                    clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
                }
            };

            const completeResp = await api.auth.webauthn.registerComplete(body);
            if (completeResp && completeResp.ok) {
                localStorage.setItem('has_webauthn', 'true');
                showToast('指纹/面容绑定成功');
            } else {
                showToast('绑定失败');
            }
        } catch (e) {
            console.error(e);
            showToast('注册失败或取消');
        }
    },

    async handleSubmit(onSuccess) {
        const mode = authModal.dataset.mode;
        const username = authUsernameInput.value;
        const password = authPasswordInput.value;

        if (!username || !password) {
            showToast('请输入用户名和密码');
            return;
        }

        if (mode === 'register' && !canRegister) {
            showToast('系统已注册，不允许新用户注册');
            return;
        }

        const action = mode === 'login' ? api.auth.login : api.auth.register;
        const response = await action(username, password);

        if (response) {
            const data = await response.json();
            if (response.ok) {
                showToast(mode === 'login' ? '登录成功' : '注册成功');
                this.closeModal();
                await this.checkStatus({ onLogin: onSuccess });
            } else {
                showToast(data.error || '操作失败');
                if (mode === 'register' && response.status === 403) {
                    canRegister = false;
                }
            }
        }
    },

    async logout() {
        if (offlineStore.hasPendingData()) {
            const confirmed = await showConfirm(
                '还有未同步的离线内容，退出后将丢失这些数据。确定要退出吗？',
                { title: '未同步数据', type: 'danger' }
            );
            if (!confirmed) return;
        }
        await api.auth.logout();
        offlineStore.clearAll();
        state.sessionRevoked = false;
        window.location.reload();
    }
};

// Event Listeners setup
export function initAuthEvents(onLoginSuccess) {
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', async () => {
            if (localStorage.getItem('has_webauthn') === 'true' && window.PublicKeyCredential) {
                try {
                    const success = await auth.loginWithWebAuthn(onLoginSuccess);
                    return;
                } catch (e) {
                    auth.openModal(true);
                }
            } else {
                auth.openModal(true);
            }
        });
    }
    if (showRegisterBtn) showRegisterBtn.addEventListener('click', () => auth.openModal(false));

    document.querySelectorAll('.close, .close-auth').forEach(btn => {
        btn.addEventListener('click', auth.closeModal);
    });

    if (authSubmitBtn) authSubmitBtn.addEventListener('click', () => auth.handleSubmit(onLoginSuccess));

    const webauthnLoginBtn = document.getElementById('webauthnLoginBtn');
    if (webauthnLoginBtn) {
        webauthnLoginBtn.addEventListener('click', () => auth.loginWithWebAuthn(onLoginSuccess));
    }

    if (logoutBtn) logoutBtn.addEventListener('click', auth.logout);

    const bindWebAuthnBtn = document.getElementById('bindWebAuthnBtn');
    if (bindWebAuthnBtn) {
        bindWebAuthnBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.registerWebAuthn();
        });
    }

    if (authPasswordInput) {
        authPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') auth.handleSubmit(onLoginSuccess);
        });
    }

    if (authSwitchBtn) {
        authSwitchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!canRegister) {
                showToast('系统已注册，不允许新用户注册');
                return;
            }
            const isLogin = authModal.dataset.mode === 'login';
            auth.openModal(!isLogin);
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === authModal) auth.closeModal();
    });

    window.addEventListener('auth:unauthorized', () => {
        if (state.sessionRevoked) return;
        auth.revokeSession();
        auth.updateUI(!!state.currentUser);
    });
}
