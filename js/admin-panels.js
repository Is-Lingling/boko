// 管理控制台扩展面板：操作日志 + 数据库查看 + 账号管理
// 依赖：Api (js/api.js)、escHtml (js/render.js)
// 样式由 css/index.css 中的 .ap-* 系列类统一控制，保证与站点风格一致。

// 通用：创建全屏遮罩弹窗骨架
function createApOverlay(id, maxWidth) {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'ap-overlay';
    overlay.innerHTML = `
        <div class="ap-modal" style="${maxWidth ? 'max-width:' + maxWidth + 'px;' : ''}">
            <div class="ap-modal-head">
                <div class="ap-modal-title" id="${id}Title"></div>
                <div class="ap-modal-actions" id="${id}Actions"></div>
            </div>
            <div class="ap-modal-body" id="${id}Body"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.ap-modal').addEventListener('click', e => e.stopPropagation());
    overlay.addEventListener('click', () => overlay.remove());
    return overlay;
}

// ========== 操作日志面板 ==========
async function openLogsPanel() {
    const overlay = createApOverlay('logsPanelOverlay', 920);
    const titleEl = overlay.querySelector('#logsPanelOverlayTitle');
    const actionsEl = overlay.querySelector('#logsPanelOverlayActions');
    const bodyEl = overlay.querySelector('#logsPanelOverlayBody');

    titleEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="10"></circle></svg> 操作日志`;

    actionsEl.innerHTML = `
        <select id="logsEntityFilter" class="ap-select">
            <option value="">全部实体</option>
            <option value="article">文章</option>
            <option value="profile">个人资料</option>
            <option value="feed">动态</option>
            <option value="home_resume">首页简历</option>
            <option value="kv">KV配置</option>
            <option value="friend_link">友链</option>
            <option value="comment">评论</option>
            <option value="category">分类</option>
        </select>
        <button id="refreshLogsBtn" class="ap-btn ap-btn-soft">刷新</button>
        <button id="closeLogsBtn" class="ap-btn ap-btn-danger">关闭</button>
    `;

    bodyEl.id = 'logsListContainer';

    overlay.querySelector('#closeLogsBtn').onclick = () => overlay.remove();
    overlay.querySelector('#refreshLogsBtn').onclick = () => loadLogsList();
    overlay.querySelector('#logsEntityFilter').onchange = () => loadLogsList();

    await loadLogsList();
}

async function loadLogsList() {
    const container = document.getElementById('logsListContainer');
    if (!container) return;
    container.innerHTML = '<div class="ap-loading"><span class="ap-spinner"></span> 加载中...</div>';

    const entityFilter = document.getElementById('logsEntityFilter');
    const entity = entityFilter ? entityFilter.value : '';

    try {
        const params = { limit: 200, since: 7 };
        if (entity) params.entity = entity;
        const logs = await Api.listLogs(params);
        if (!Array.isArray(logs) || logs.length === 0) {
            container.innerHTML = '<div class="ap-empty">暂无操作日志</div>';
            return;
        }

        const actionMeta = {
            create:  { label: '创建', cls: 'create' },
            update:  { label: '更新', cls: 'update' },
            delete:  { label: '删除', cls: 'delete' },
            set:     { label: '设置', cls: 'update' },
            rollback:{ label: '回滚', cls: 'rollback' }
        };
        const entityLabels = {
            article: '文章', profile: '个人资料', feed: '动态',
            home_resume: '首页简历', kv: 'KV配置', friend_link: '友链',
            comment: '评论', category: '分类'
        };

        container.innerHTML = logs.map(log => {
            const meta = actionMeta[log.action] || { label: log.action, cls: 'set' };
            const entityLabel = entityLabels[log.entity] || log.entity;
            const eid = log.entityId ? ` #${escHtml(String(log.entityId))}` : '';
            const time = log.createdAt || '';
            const canRollback = log.beforeData || (log.action === 'create' && log.afterData);

            const beforeHtml = log.beforeData
                ? `<details class="ap-log-detail"><summary>查看修改前</summary><pre>${escHtml(JSON.stringify(log.beforeData, null, 2))}</pre></details>`
                : '';
            const afterHtml = log.afterData
                ? `<details class="ap-log-detail"><summary>查看修改后</summary><pre>${escHtml(JSON.stringify(log.afterData, null, 2))}</pre></details>`
                : '';

            return `
                <div class="ap-log-item ap-log-act-${meta.cls}">
                    <span class="ap-log-badge">${escHtml(meta.label)}</span>
                    <div class="ap-log-main">
                        <div class="ap-log-top">
                            <span class="ap-log-entity">${escHtml(entityLabel)}${eid}</span>
                            <span class="ap-log-time">${escHtml(time)}</span>
                        </div>
                        <div class="ap-log-operator">操作人：${escHtml(log.operator || 'admin')}</div>
                        <div class="ap-log-details">${beforeHtml}${afterHtml}</div>
                    </div>
                    ${canRollback ? `<button class="ap-rollback-btn" data-log-id="${escHtml(log.id)}">回滚</button>` : ''}
                </div>
            `;
        }).join('');

        container.querySelectorAll('.ap-rollback-btn').forEach(btn => {
            btn.onclick = async () => {
                const logId = btn.getAttribute('data-log-id');
                if (!confirm('确定要回滚此操作吗？此操作将恢复到修改前的状态。')) return;
                btn.disabled = true;
                btn.textContent = '回滚中...';
                try {
                    const result = await Api.rollbackLog(logId);
                    alert(result.message || '回滚成功');
                    await loadLogsList();
                } catch (err) {
                    alert('回滚失败: ' + (err && err.message || '未知错误'));
                    btn.disabled = false;
                    btn.textContent = '回滚';
                }
            };
        });
    } catch (err) {
        container.innerHTML = `<div class="ap-error">加载失败: ${escHtml(err && err.message || '未知错误')}</div>`;
    }
}

// ========== 数据库查看面板 ==========
async function openDbViewerPanel() {
    const overlay = createApOverlay('dbViewerOverlay', 1120);
    const titleEl = overlay.querySelector('#dbViewerOverlayTitle');
    const actionsEl = overlay.querySelector('#dbViewerOverlayActions');
    const bodyEl = overlay.querySelector('#dbViewerOverlayBody');

    titleEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg> 数据库查看`;
    actionsEl.innerHTML = `<button id="closeDbViewerBtn" class="ap-btn ap-btn-danger">关闭</button>`;

    bodyEl.innerHTML = `
        <div class="ap-db-layout">
            <aside class="ap-db-sidebar" id="dbTablesSidebar">
                <div class="ap-db-sidebar-title">数据表</div>
                <div class="ap-db-sidebar-list"><div class="ap-loading"><span class="ap-spinner"></span> 加载中...</div></div>
            </aside>
            <section class="ap-db-content" id="dbTableDataContainer">
                <div class="ap-empty">请从左侧选择一个表</div>
            </section>
        </div>
    `;

    overlay.querySelector('#closeDbViewerBtn').onclick = () => overlay.remove();

    try {
        const tables = await Api.listDbTables();
        const sidebarList = overlay.querySelector('.ap-db-sidebar-list');
        if (!Array.isArray(tables) || tables.length === 0) {
            sidebarList.innerHTML = '<div class="ap-empty">无可用表</div>';
            return;
        }
        sidebarList.innerHTML = tables.map(t => `
            <button class="ap-db-table" data-table="${escHtml(t.name)}">
                <span class="ap-db-table-name">${escHtml(t.name)}</span>
                <span class="ap-db-table-count">${escHtml(String(t.count))}</span>
            </button>
        `).join('');

        sidebarList.querySelectorAll('.ap-db-table').forEach(item => {
            item.onclick = () => {
                sidebarList.querySelectorAll('.ap-db-table').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                loadTableData(item.getAttribute('data-table'));
            };
        });

        const firstItem = sidebarList.querySelector('.ap-db-table');
        if (firstItem) firstItem.click();
    } catch (err) {
        overlay.querySelector('.ap-db-sidebar-list').innerHTML = `<div class="ap-error">加载失败: ${escHtml(err && err.message || '未知错误')}</div>`;
    }
}

async function loadTableData(tableName, offset = 0) {
    const container = document.getElementById('dbTableDataContainer');
    if (!container) return;
    container.innerHTML = '<div class="ap-loading"><span class="ap-spinner"></span> 加载中...</div>';

    try {
        const limit = 50;
        const result = await Api.getDbTableData(tableName, { limit, offset });
        const { columns, rows, total } = result;
        const start = offset + 1;
        const end = Math.min(offset + limit, total);

        let html = `
            <div class="ap-db-content-head">
                <div class="ap-db-content-meta">表 <strong>${escHtml(tableName)}</strong> · 共 ${escHtml(String(total))} 行 · 显示 ${start}-${end}</div>
                <div class="ap-db-pager">
                    <button id="dbPrevPage" class="ap-btn ap-btn-soft" ${offset === 0 ? 'disabled' : ''}>上一页</button>
                    <button id="dbNextPage" class="ap-btn ap-btn-soft" ${offset + limit >= total ? 'disabled' : ''}>下一页</button>
                </div>
            </div>
        `;

        if (!rows || rows.length === 0) {
            html += '<div class="ap-empty">此表无数据</div>';
        } else {
            html += '<div class="ap-table-wrap"><table class="ap-data-table"><thead><tr>';
            columns.forEach(col => {
                html += `<th>${escHtml(col)}</th>`;
            });
            html += '</tr></thead><tbody>';
            rows.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    const display = cell === null ? '<span class="ap-null">NULL</span>' :
                        typeof cell === 'object' ? escHtml(JSON.stringify(cell)) :
                        escHtml(String(cell));
                    const long = String(cell == null ? '' : cell).length > 100;
                    html += `<td class="${long ? 'ap-cell-long' : ''}" title="${long ? escHtml(String(cell == null ? '' : cell)) : ''}">${display}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }

        container.innerHTML = html;

        const prevBtn = container.querySelector('#dbPrevPage');
        const nextBtn = container.querySelector('#dbNextPage');
        if (prevBtn && offset > 0) prevBtn.onclick = () => loadTableData(tableName, offset - limit);
        if (nextBtn && offset + limit < total) nextBtn.onclick = () => loadTableData(tableName, offset + limit);
    } catch (err) {
        container.innerHTML = `<div class="ap-error">加载失败: ${escHtml(err && err.message || '未知错误')}</div>`;
    }
}

// ========== 账号管理面板 ==========
async function openAccountPanel() {
    const overlay = createApOverlay('accountPanelOverlay', 560);
    const titleEl = overlay.querySelector('#accountPanelOverlayTitle');
    const actionsEl = overlay.querySelector('#accountPanelOverlayActions');
    const bodyEl = overlay.querySelector('#accountPanelOverlayBody');

    titleEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> 账号管理`;
    actionsEl.innerHTML = `<button id="closeAccountBtn" class="ap-btn ap-btn-danger">关闭</button>`;

    bodyEl.innerHTML = `
        <div class="ap-account-header">
            <div class="ap-account-avatar" id="apAccountAvatar">A</div>
            <div class="ap-account-id">
                <div class="ap-account-label">当前管理员</div>
                <div class="ap-account-name" id="apAccountName">加载中...</div>
            </div>
        </div>

        <div class="ap-card">
            <div class="ap-card-title">修改用户名</div>
            <div class="ap-field">
                <label>新用户名</label>
                <input type="text" id="apNewUsername" class="ap-input" placeholder="请输入新的用户名" autocomplete="off">
            </div>
            <div class="ap-card-actions">
                <span class="ap-form-msg" id="apUsernameMsg"></span>
                <button class="ap-btn ap-btn-primary" id="apSaveUsernameBtn">保存用户名</button>
            </div>
        </div>

        <div class="ap-card">
            <div class="ap-card-title">修改密码</div>
            <div class="ap-field">
                <label>新密码</label>
                <input type="password" id="apNewPassword" class="ap-input" placeholder="请输入新的密码" autocomplete="new-password">
            </div>
            <div class="ap-field">
                <label>确认新密码</label>
                <input type="password" id="apConfirmPassword" class="ap-input" placeholder="再次输入新密码" autocomplete="new-password">
            </div>
            <div class="ap-card-actions">
                <span class="ap-form-msg" id="apPasswordMsg"></span>
                <button class="ap-btn ap-btn-primary" id="apSavePasswordBtn">修改密码</button>
            </div>
        </div>
    `;

    overlay.querySelector('#closeAccountBtn').onclick = () => overlay.remove();

    // 当前用户名
    let currentUsername = localStorage.getItem('adminUsername') || '';
    if (currentUsername) {
        bodyEl.querySelector('#apAccountName').textContent = currentUsername;
        bodyEl.querySelector('#apAccountAvatar').textContent = currentUsername.charAt(0).toUpperCase();
    } else {
        try {
            const me = await Api.getMe();
            if (me && me.username) {
                currentUsername = me.username;
                localStorage.setItem('adminUsername', currentUsername);
                bodyEl.querySelector('#apAccountName').textContent = currentUsername;
                bodyEl.querySelector('#apAccountAvatar').textContent = currentUsername.charAt(0).toUpperCase();
            }
        } catch (e) { /* 忽略，可离线修改 */ }
    }

    // 修改用户名
    bodyEl.querySelector('#apSaveUsernameBtn').onclick = async () => {
        const input = bodyEl.querySelector('#apNewUsername');
        const msg = bodyEl.querySelector('#apUsernameMsg');
        const val = (input.value || '').trim();
        msg.className = 'ap-form-msg';
        msg.textContent = '';
        if (!val) { msg.textContent = '用户名不能为空'; msg.classList.add('error'); return; }
        const btn = bodyEl.querySelector('#apSaveUsernameBtn');
        btn.disabled = true; btn.textContent = '保存中...';
        try {
            const res = await Api.changeUsername(val);
            if (res && res.ok) {
                localStorage.setItem('adminUsername', val);
                bodyEl.querySelector('#apAccountName').textContent = val;
                bodyEl.querySelector('#apAccountAvatar').textContent = val.charAt(0).toUpperCase();
                input.value = '';
                msg.textContent = '用户名已更新'; msg.classList.add('success');
                if (typeof showToast === 'function') showToast('用户名修改成功', 'success');
            } else {
                msg.textContent = '修改失败'; msg.classList.add('error');
            }
        } catch (err) {
            msg.textContent = '修改失败: ' + (err && err.message || '未知错误');
            msg.classList.add('error');
        } finally {
            btn.disabled = false; btn.textContent = '保存用户名';
        }
    };

    // 修改密码
    bodyEl.querySelector('#apSavePasswordBtn').onclick = async () => {
        const pw = bodyEl.querySelector('#apNewPassword');
        const cf = bodyEl.querySelector('#apConfirmPassword');
        const msg = bodyEl.querySelector('#apPasswordMsg');
        msg.className = 'ap-form-msg'; msg.textContent = '';
        const v = pw.value || '';
        if (!v) { msg.textContent = '密码不能为空'; msg.classList.add('error'); return; }
        if (v !== cf.value) { msg.textContent = '两次输入的密码不一致'; msg.classList.add('error'); return; }
        const btn = bodyEl.querySelector('#apSavePasswordBtn');
        btn.disabled = true; btn.textContent = '修改中...';
        try {
            const res = await Api.changePassword(v);
            if (res && res.ok) {
                pw.value = ''; cf.value = '';
                msg.textContent = '密码已更新'; msg.classList.add('success');
                if (typeof showToast === 'function') showToast('密码修改成功', 'success');
            } else {
                msg.textContent = '修改失败'; msg.classList.add('error');
            }
        } catch (err) {
            msg.textContent = '修改失败: ' + (err && err.message || '未知错误');
            msg.classList.add('error');
        } finally {
            btn.disabled = false; btn.textContent = '修改密码';
        }
    };
}
