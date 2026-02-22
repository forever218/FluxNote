/**
 * PWA Registration Module
 * Handles Service Worker registration and updates
 */

import { showToast } from './modules/utils.js';

// Global variable to track offline mode
window.isOfflineMode = !navigator.onLine;

// Register PWA
export async function initPWA() {
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service Worker not supported');
        return;
    }

    // 1. 离线状态监听
    window.addEventListener('online', () => {
        window.isOfflineMode = false;
        document.body.classList.remove('offline');
        // main.js handles the toast
    });

    window.addEventListener('offline', () => {
        window.isOfflineMode = true;
        document.body.classList.add('offline');
    });

    // 2. Controller Change (Update Applied)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    try {
        const registration = await navigator.serviceWorker.register('/static/sw.js', {
            scope: '/'
        });

        // 3. Update Detection
        if (registration.waiting) {
            updateReady(registration.waiting);
            return;
        }

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                        // New update available
                        updateReady(newWorker);
                    } else {
                        // Content cached for offline use
                        showToast('已就绪，可离线使用');
                    }
                }
            });
        });

    } catch (error) {
        console.error('[PWA] Registration failed:', error);
    }
}

function updateReady(worker) {
    console.log('[PWA] New version ready');
    showUpdateNotification(worker);
}

function showUpdateNotification(worker) {
    // 检查是否存在现有提示
    if (document.querySelector('.pwa-update-toast')) return;

    const toast = document.createElement('div');
    toast.className = 'pwa-update-toast';
    
    // 使用应用主题样式
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: white;
        color: #1e293b;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border: 1px solid #e2e8f0;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;

    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="fas fa-sparkles" style="color:#10B981; font-size:1.2em;"></i>
            <div style="flex:1;">
                <h4 style="margin:0; font-size:14px; font-weight:600;">发现新版本</h4>
                <p style="margin:4px 0 0; font-size:12px; color:#64748b;">更新以获取最新功能和修复</p>
            </div>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button id="pwaLaterBtn" style="padding:6px 12px; font-size:12px; border:1px solid #e2e8f0; background:white; color:#64748b; border-radius:6px; cursor:pointer;">稍后</button>
            <button id="pwaRefreshBtn" style="padding:6px 12px; font-size:12px; border:none; background:#10B981; color:white; border-radius:6px; cursor:pointer; font-weight:500;">立即刷新</button>
        </div>
    `;

    document.body.appendChild(toast);

    // 绑定事件
    document.getElementById('pwaRefreshBtn').onclick = () => {
        // 发送 skipWaiting 消息触发激活，进而触发 controllerchange 刷新页面
        worker.postMessage('skipWaiting');
        toast.innerHTML = '<div style="text-align:center; padding:10px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 正在更新...</div>';
    };

    document.getElementById('pwaLaterBtn').onclick = () => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    };
}

// Add animation styles if not present
if (!document.getElementById('pwa-styles')) {
    const style = document.createElement('style');
    style.id = 'pwa-styles';
    style.textContent = `
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(style);
}

// 延迟初始化，确保 DOM 加载完成
if (document.readyState === 'complete') {
    initPWA();
} else {
    window.addEventListener('load', initPWA);
}
