/**
 * offlineStore — 统一离线数据层
 *
 * 职责：
 *   1. 管理所有 localStorage 缓存（笔记、标签、热力图、统计、用户）
 *   2. 管理离线变更队列（草稿、更新、删除）
 *   3. 提供客户端查询（标签筛选、日期筛选、关键词搜索）
 *   4. 提供合并逻辑（缓存 + 离线变更 → 最终列表）
 *
 * 设计约束：
 *   - 不依赖 state.js / api.js，保持纯数据层
 *   - 所有 localStorage 键名集中在 KEYS 中
 *   - 外部只通过 export 的 offlineStore 对象交互
 */

const KEYS = {
    user:           'cached_user',
    notes:          'cached_notes',
    tags:           'cached_tags',
    heatmap:        'cached_heatmap',
    stats:          'cached_stats',
    drafts:         'offline_drafts',
    updates:        'offline_updates',
    deletes:        'offline_deletes',
    sessionRevoked: 'session_revoked',
};

function safeGet(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function safeSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('[offlineStore] write failed:', key, e);
    }
}

export const offlineStore = {

    // ======================== 缓存读写 ========================

    getUser()      { return safeGet(KEYS.user, null); },
    setUser(user)  { user ? safeSet(KEYS.user, user) : localStorage.removeItem(KEYS.user); },

    getNotes() {
        const cached = safeGet(KEYS.notes, null);
        if (!cached) return [];
        return cached.data ? cached.data : (Array.isArray(cached) ? cached : []);
    },
    setNotes(notes) {
        safeSet(KEYS.notes, { version: 1, timestamp: Date.now(), data: notes });
    },

    getTags()      { return safeGet(KEYS.tags, []); },
    setTags(tags)  { safeSet(KEYS.tags, tags); },

    getHeatmap()       { return safeGet(KEYS.heatmap, {}); },
    setHeatmap(data)   { safeSet(KEYS.heatmap, data); },

    getStats()         { return safeGet(KEYS.stats, null); },
    setStats(data)     { safeSet(KEYS.stats, data); },

    // ======================== 会话状态 ========================

    isSessionRevoked()        { return localStorage.getItem(KEYS.sessionRevoked) === '1'; },
    setSessionRevoked(flag)   { flag ? localStorage.setItem(KEYS.sessionRevoked, '1') : localStorage.removeItem(KEYS.sessionRevoked); },

    // ======================== 离线变更队列 ========================

    getDrafts()    { return safeGet(KEYS.drafts, []); },
    getUpdates()   { return safeGet(KEYS.updates, {}); },
    getDeletes() {
        const raw = safeGet(KEYS.deletes, []);
        return raw.map(d => (typeof d === 'string' ? { id: d, timestamp: Date.now() } : d));
    },

    saveDrafts(arr)   { arr.length ? safeSet(KEYS.drafts, arr) : localStorage.removeItem(KEYS.drafts); },
    saveUpdates(obj)  { Object.keys(obj).length ? safeSet(KEYS.updates, obj) : localStorage.removeItem(KEYS.updates); },
    saveDeletes(arr)  { arr.length ? safeSet(KEYS.deletes, arr) : localStorage.removeItem(KEYS.deletes); },

    addDraft(draft) {
        const drafts = this.getDrafts();
        drafts.push(draft);
        this.saveDrafts(drafts);
    },

    addUpdate(id, updates) {
        const idStr = id.toString();
        if (idStr.startsWith('draft-') || idStr.startsWith('offline-')) {
            const drafts = this.getDrafts();
            const draftId = parseInt(idStr.split('-').pop());
            const target = drafts.find(d => d._id === draftId);
            if (target) {
                Object.assign(target, updates);
                this.saveDrafts(drafts);
            }
        } else {
            const all = this.getUpdates();
            all[id] = { ...(all[id] || {}), ...updates };
            this.saveUpdates(all);
        }
    },

    addDelete(id) {
        if (id.startsWith('draft-') || id.startsWith('offline-')) {
            const draftId = parseInt(id.split('-').pop());
            this.saveDrafts(this.getDrafts().filter(d => d._id !== draftId));
        } else {
            const deletes = this.getDeletes();
            if (!deletes.some(d => d.id === id)) {
                deletes.push({ id, timestamp: Date.now() });
                this.saveDeletes(deletes);
            }
        }
    },

    hasPendingData() {
        return this.getDrafts().length > 0
            || Object.keys(this.getUpdates()).length > 0
            || this.getDeletes().length > 0;
    },

    // ======================== 合并 & 查询 ========================

    /**
     * 将离线变更（草稿 / 更新 / 删除）叠加到给定笔记列表上
     * @param {Array} notes  服务端或缓存笔记
     * @param {number} userId  当前用户 ID（用于草稿卡片渲染）
     */
    applyOfflineChanges(notes, userId = -1) {
        const drafts  = this.getDrafts();
        const deletes = this.getDeletes();
        const updates = this.getUpdates();

        const deleteIds = new Set(deletes.map(d => d.id));

        let result = Array.isArray(notes) ? notes.filter(n => !deleteIds.has(String(n.id))) : [];

        result = result.map(n => updates[n.id] ? { ...n, ...updates[n.id], is_offline_update: true } : n);

        if (drafts.length > 0) {
            const draftNotes = drafts.map((d, i) => ({
                id: `offline-${d._id || (Date.now() + i)}`,
                content:    d.content,
                tags:       d.tags || [],
                is_public:  d.is_public,
                created_at: d.created_at,
                user_id:    userId,
                backlinks:  [],
                is_offline_draft: true
            })).reverse();
            result = [...draftNotes, ...result];
        }

        return result;
    },

    /**
     * 从缓存笔记中做客户端筛选（离线模式专用）
     */
    queryNotes({ tag = '', date = '', search = '', userId = -1 } = {}) {
        let notes = this.applyOfflineChanges(this.getNotes(), userId);

        if (tag) {
            notes = notes.filter(n => n.tags && n.tags.includes(tag));
        }
        if (date) {
            notes = notes.filter(n => n.created_at && n.created_at.startsWith(date));
        }
        if (search) {
            const kw = search.toLowerCase();
            notes = notes.filter(n =>
                (n.content && n.content.toLowerCase().includes(kw)) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(kw)))
            );
        }

        return notes;
    },

    // ======================== 清除 ========================

    clearAll() {
        Object.values(KEYS).forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('note_draft_content');
        localStorage.removeItem('pwa-install-dismissed');
    },
};
