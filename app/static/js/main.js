import { api } from './modules/api.js';
import { state, setState } from './modules/state.js';
import { ui } from './modules/ui.js';
import { auth, initAuthEvents } from './modules/auth.js';
import { editor } from './modules/editor.js';
import { showToast, debounce } from './modules/utils.js';

// === Main Logic ===

document.addEventListener('DOMContentLoaded', async () => {
    initGlobalEvents();
    initAuthEvents(loadData); // Pass loadData as callback after login

    // Render Skeleton and Header immediately to improve perceived performance
    ui.renderSkeleton();
    ui.updateHeaderDate();

    // Initialize image viewer
    const list = document.getElementById('notesList');
    if (list && typeof Viewer !== 'undefined') {
        state.galleryViewer = new Viewer(list, {
            button: true, navbar: false, title: false,
            toolbar: { zoomIn:1, zoomOut:1, oneToOne:1, reset:1 },
            filter(image) { return image.closest('.note-content'); }
        });
    }

    // Initialize editor
    editor.init('noteContent');

    // Initial load
    await auth.checkStatus({
        onLogin: loadData,
        onLogout: loadData
    });
});

async function loadData() {
    await loadNotes(true);
    loadTags();
    ui.renderHeatmap();
    ui.renderOverviewStats();
    ui.updateHeaderDate();
    ui.handleHashJump(); // Manually jump to anchor after notes are rendered
}

// === Note Logic ===

async function loadNotes(reset = false) {
    if (state.isLoading) return;
    if (reset) {
        setState('currentPage', 1);
        setState('notes', []);
        setState('hasNextPage', true);
    }

    setState('isLoading', true);
    const list = document.getElementById('notesList');
    if (reset && list) {
        // Show skeleton loader
        ui.renderSkeleton();
    }

    try {
        let response;
        const searchVal = document.getElementById('searchInput')?.value.trim() || '';

        if (state.isTrashMode) {
             response = await api.notes.trash(state.currentPage);
        } else if (searchVal) {
             response = await api.notes.search(searchVal, state.currentFilterTag, state.currentPage);
        } else {
             response = await api.notes.list(state.currentPage, state.currentFilterTag, state.currentDateFilter);
        }

        if (!response) return;
        const data = await response.json();

        let newNotes = [];
        if (Array.isArray(data)) {
            newNotes = data;
        } else if (data.notes) {
            newNotes = data.notes;
            if (data.has_next !== undefined) setState('hasNextPage', data.has_next);
            else if (newNotes.length < 20) setState('hasNextPage', false);
        }

        if (reset) setState('notes', newNotes);
        else setState('notes', [...state.notes, ...newNotes]);

        ui.renderNotes(newNotes, reset);
        setState('currentPage', state.currentPage + 1);

    } catch (e) {
        console.error("Load notes failed", e);
    } finally {
        setState('isLoading', false);
    }
}

async function loadTags() {
    const res = await api.tags.list();
    if (res) {
        const tags = await res.json();
        ui.renderSidebarTags(tags);
    }
}

// === Event Handlers ===

function initGlobalEvents() {
    // Navigation
    document.getElementById('navAllNotes').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('all');
    });
    document.getElementById('navTrash').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('trash');
    });

    document.getElementById('navDailyReview')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const modal = document.getElementById('reviewModal');
        const list = document.getElementById('reviewList');
        
        if (modal) {
            modal.style.display = 'block';
            list.innerHTML = '<div style="text-align:center; padding:20px;">加载中...</div>';
            
            modal.querySelector('.close-review').onclick = () => modal.style.display = 'none';
            window.onclick = (ev) => { if(ev.target === modal) modal.style.display = 'none'; };

            const res = await api.notes.review();
            if (res) {
                const notes = await res.json();
                list.innerHTML = '';
                if (notes.length === 0) {
                    list.innerHTML = '<div style="text-align:center; padding:20px;">还没有足够的笔记进行回顾</div>';
                    return;
                }
                
                notes.forEach(note => {
                    const card = ui.createNoteCard(note);
                    // Disable actions in review mode to keep it simple, or keep them? 
                    // Let's keep them but maybe hide edit/delete to focus on reading
                    const actions = card.querySelector('.note-actions');
                    if(actions) actions.style.display = 'none';
                    list.appendChild(card);
                });
                
                if (window.hljs) hljs.highlightAll();
            }
        }
    });

    // Sidebar Toggle
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const appContainer = document.querySelector('.app-container');

    // Float button logic
    let floatBtn = document.querySelector('.floating-menu-btn');
    if (!floatBtn) {
        floatBtn = document.createElement('button');
        floatBtn.className = 'floating-menu-btn';
        floatBtn.innerHTML = '<i class="fas fa-bars"></i>';
        floatBtn.onclick = () => {
            sidebar.classList.remove('collapsed');
            appContainer.classList.remove('sidebar-closed');
            floatBtn.style.display = 'none';
        };
        document.body.appendChild(floatBtn);
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
            appContainer.classList.add('sidebar-closed');
            floatBtn.style.display = 'block';
        });
    }

    // Mobile Menu
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 900 && sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        });
    }

    // Search
    document.getElementById('searchInput')?.addEventListener('input', debounce(() => {
        loadNotes(true);
    }, 300));

    // Home Click
    document.querySelector('.header-left')?.addEventListener('click', () => {
        setState('currentFilterTag', '');
        setState('currentDateFilter', '');
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        loadNotes(true);
        ui.updateHeaderDate();
        loadTags();
    });

    // Infinite Scroll
    window.addEventListener('scroll', () => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim() !== '') return;
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            if (!state.isLoading && state.hasNextPage) {
                loadNotes(false);
            }
        }
    });

    // Save Note
    document.getElementById('saveNote')?.addEventListener('click', async () => {
        const content = document.getElementById('noteContent').value.trim();
        const isPublic = document.getElementById('noteIsPublic').checked;
        const saveBtn = document.getElementById('saveNote');

        if (!content) return showToast('内容不能为空');

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const res = await api.notes.create({ content, tags: state.currentTags, is_public: isPublic });

        if (res && res.ok) {
            document.getElementById('noteContent').value = '';
            localStorage.removeItem('note_draft_content');
            setState('currentTags', []);
            ui.renderTags('input');
            loadData(); // Reload all
            showToast('已记录');
        } else {
            showToast('保存失败');
        }

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    });

    // Tag Input Toggle
    const tagInput = document.getElementById('tagInput');
    const toggleTagBtn = document.getElementById('toggleTagInputBtn');
    if (toggleTagBtn && tagInput) {
        toggleTagBtn.addEventListener('click', () => {
            tagInput.style.display = tagInput.style.display === 'none' ? 'inline-block' : 'none';
            if (tagInput.style.display !== 'none') tagInput.focus();
        });
        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = tagInput.value.trim();
                if (val && !state.currentTags.includes(val)) {
                    state.currentTags.push(val);
                    ui.renderTags('input');
                    tagInput.value = '';
                }
            }
        });
    }

    // === Custom Events from UI ===

    window.addEventListener('filter:tag', (e) => {
        setState('currentFilterTag', e.detail);
        loadNotes(true);
        // Update UI active state manually or re-render sidebar tags?
        // Re-rendering sidebar tags is safer to update active class
        ui.renderSidebarTags(document.querySelectorAll('.sidebar-tag').length > 0 ? Array.from(document.querySelectorAll('.sidebar-tag')).map(b => b.dataset.tag).filter(Boolean) : []);
        // Actually we should just refetch tags or iterate DOM.
        // Let's just iterate DOM for efficiency
        document.querySelectorAll('.sidebar-tag').forEach(btn => {
            if (btn.dataset.tag === e.detail) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    });

    window.addEventListener('filter:date', (e) => {
        if (state.currentDateFilter === e.detail) {
             setState('currentDateFilter', '');
        } else {
             setState('currentDateFilter', e.detail);
        }
        loadNotes(true);
        ui.updateHeaderDate();
        ui.renderHeatmap(); // Re-render to update selection stroke
    });

    window.addEventListener('filter:date-clear', () => {
        setState('currentDateFilter', '');
        loadNotes(true);
        ui.updateHeaderDate();
        ui.renderHeatmap();
    });

    window.addEventListener('tag:remove', (e) => {
        const { tag, type } = e.detail;
        if (type === 'input') {
            setState('currentTags', state.currentTags.filter(t => t !== tag));
            ui.renderTags('input');
        }
    });

    window.addEventListener('note:refresh-list', () => loadNotes(true));

    window.addEventListener('note:delete', async (e) => {
        if (!confirm('确定要删除这条笔记吗？')) return;
        const res = await api.notes.delete(e.detail);
        if (res && res.ok) {
            showToast('已删除');
            const card = document.getElementById(`note-${e.detail}`);
            if (card) {
                card.style.opacity = '0';
                setTimeout(() => card.remove(), 300);
            }
            ui.renderHeatmap();
        } else {
            showToast('删除失败');
        }
    });

    window.addEventListener('note:permanent-delete', async (e) => {
        if (!confirm('彻底删除后无法恢复，确定吗？')) return;
        const res = await api.notes.permanentDelete(e.detail);
        if (res && res.ok) {
            showToast('已彻底删除');
            document.getElementById(`note-${e.detail}`)?.remove();
        } else {
            showToast('删除失败');
        }
    });

    window.addEventListener('note:restore', async (e) => {
        const res = await api.notes.restore(e.detail);
        if (res && res.ok) {
            showToast('已恢复');
            document.getElementById(`note-${e.detail}`)?.remove();
        } else {
            showToast('恢复失败');
        }
    });

    window.addEventListener('note:edit', (e) => {
        ui.startInlineEdit(e.detail);
    });

    window.addEventListener('note:toggle-task', async (e) => {
        const { id, index, checked } = e.detail;
        const note = state.notes.find(n => n.id == id);
        if (!note) return;

        let count = 0;
        // Use a similar regex to what ui.js uses for normalization to find the n-th checkbox
        const newContent = note.content.replace(/^(\s*[-*])\s*\[([ xX]?)\]/gm, (match, p1, p2) => {
            if (count === index) {
                count++;
                return `${p1} [${checked ? 'x' : ' '}]`;
            }
            count++;
            return match;
        });

        if (newContent === note.content) return;

        const res = await api.notes.update(id, { content: newContent });
        if (res && res.ok) {
            note.content = newContent;
            // Update the card locally to reflect changes (and re-bind events)
            ui.restoreCard(note);
        } else {
            showToast('更新失败');
            ui.restoreCard(note); // Revert UI state
        }
    });

    window.addEventListener('note:history', async (e) => {
        const noteId = e.detail;
        const modal = document.getElementById('versionModal');
        const list = document.getElementById('versionList');
        const preview = document.getElementById('versionPreview');

        if (modal) {
            modal.style.display = 'block';
            list.innerHTML = '加载中...';
            preview.style.display = 'none';

            modal.querySelector('.close-version').onclick = () => modal.style.display = 'none';
            window.onclick = (ev) => { if(ev.target === modal) modal.style.display = 'none'; };

            const res = await api.notes.versions(noteId);
            if (res) {
                const versions = await res.json();
                if (versions.length === 0) {
                    list.innerHTML = '暂无历史版本';
                    return;
                }
                list.innerHTML = versions.map(v => `
                    <div class="version-item">
                        <div class="version-info">
                            <span class="version-date">${v.created_at}</span>
                            <span class="version-meta">${v.title || '无标题'}</span>
                        </div>
                        <div class="version-actions">
                            <button class="btn btn-secondary btn-sm preview-v-btn" data-json='${JSON.stringify(v).replace(/'/g, "&#39;")}'>预览</button>
                            <button class="btn btn-primary btn-sm restore-v-btn" data-vid="${v.id}">恢复</button>
                        </div>
                    </div>
                `).join('');

                list.querySelectorAll('.preview-v-btn').forEach(btn => {
                    btn.onclick = () => {
                        const v = JSON.parse(btn.dataset.json);
                        let content = v.content;
                        try {
                            if (typeof marked !== 'undefined') content = DOMPurify.sanitize(marked.parse(content));
                        } catch(e) {}
                        preview.innerHTML = `<div class="version-preview-header">预览版本: ${v.created_at}</div>` + content;
                        preview.style.display = 'block';
                    };
                });

                list.querySelectorAll('.restore-v-btn').forEach(btn => {
                    btn.onclick = async () => {
                        if (!confirm('确定要恢复到此版本吗？')) return;
                        const r = await api.notes.restoreVersion(noteId, btn.dataset.vid);
                        if (r && r.ok) {
                            showToast('已恢复版本');
                            modal.style.display = 'none';
                            loadNotes(true);
                        } else {
                            showToast('恢复失败');
                        }
                    };
                });
            }
        }
    });
}

function switchView(view) {
    const navAll = document.getElementById('navAllNotes');
    const navTrash = document.getElementById('navTrash');

    if (view === 'trash') {
        setState('isTrashMode', true);
        navTrash?.classList.add('active');
        navAll?.classList.remove('active');
        document.getElementById('noteInputSection').style.display = 'none';
        document.querySelector('.header-left span:last-child').textContent = '回收站';
    } else {
        setState('isTrashMode', false);
        navAll?.classList.add('active');
        navTrash?.classList.remove('active');
        if (state.currentUser) {
            document.getElementById('noteInputSection').style.display = 'block';
        }
        ui.updateHeaderDate();
    }

    setState('currentFilterTag', '');
    setState('currentDateFilter', '');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    loadNotes(true);
}
