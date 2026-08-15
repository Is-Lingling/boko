// 管理控制台扩展面板：操作日志 + 数据库查看
// 依赖：Api (js/api.js)、escHtml (js/render.js)
// escHtml 已在 render.js 中全局定义，此处直接使用，避免重定义冲突

// 打开操作日志面板（全屏 overlay）
async function openLogsPanel() {
    // 创建全屏 overlay
    const overlay = document.createElement('div');
    overlay.id = 'logsPanelOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; padding:20px;';
    overlay.innerHTML = `
        <div style="background:var(--bg-card); border-radius:16px; width:100%; max-width:900px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
                <h3 style="margin:0; font-size:18px; font-weight:700;">操作日志（最近7天）</h3>
                <div style="display:flex; gap:8px; align-items:center;">
                    <select id="logsEntityFilter" style="padding:6px 10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); font-size:13px;">
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
                    <button id="refreshLogsBtn" style="padding:6px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--primary-light); color:var(--primary); cursor:pointer; font-size:13px;">刷新</button>
                    <button id="closeLogsBtn" style="padding:6px 12px; border-radius:8px; border:none; background:var(--danger); color:#fff; cursor:pointer; font-size:13px;">关闭</button>
                </div>
            </div>
            <div id="logsListContainer" style="flex:1; overflow-y:auto; padding:16px 20px;">
                <div style="text-align:center; padding:40px; color:var(--text-muted);">加载中...</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 绑定关闭按钮
    overlay.querySelector('#closeLogsBtn').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector('#refreshLogsBtn').onclick = () => loadLogsList();
    overlay.querySelector('#logsEntityFilter').onchange = () => loadLogsList();

    await loadLogsList();
}

async function loadLogsList() {
    const container = document.getElementById('logsListContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">加载中...</div>';

    const entityFilter = document.getElementById('logsEntityFilter');
    const entity = entityFilter ? entityFilter.value : '';

    try {
        const params = { limit: 200, since: 7 };
        if (entity) params.entity = entity;
        const logs = await Api.listLogs(params);
        if (!Array.isArray(logs) || logs.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">暂无操作日志</div>';
            return;
        }

        // 渲染日志列表
        container.innerHTML = logs.map(log => {
            const actionColors = {
                create: '#10b981', update: '#f59e0b', delete: '#ef4444',
                set: '#f59e0b', rollback: '#8b5cf6'
            };
            const color = actionColors[log.action] || '#6b7280';
            const actionLabels = {
                create: '创建', update: '更新', delete: '删除',
                set: '设置', rollback: '回滚'
            };
            const actionLabel = actionLabels[log.action] || log.action;
            const entityLabels = {
                article: '文章', profile: '个人资料', feed: '动态',
                home_resume: '首页简历', kv: 'KV配置', friend_link: '友链',
                comment: '评论', category: '分类'
            };
            const entityLabel = entityLabels[log.entity] || log.entity;
            const eid = log.entityId ? ` #${log.entityId}` : '';
            const time = log.createdAt || '';
            // 判断是否可回滚：有 before_data 或 (action=create 且有 after_data)
            const canRollback = log.beforeData || (log.action === 'create' && log.afterData);

            return `
                <div style="padding:12px 0; border-bottom:1px solid var(--border-color); display:flex; gap:12px; align-items:flex-start;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; min-width:48px; height:24px; padding:0 8px; border-radius:6px; font-size:11px; font-weight:700; color:#fff; background:${color};">${escHtml(actionLabel)}</span>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:14px; font-weight:600; color:var(--text-main);">${escHtml(entityLabel)}${escHtml(eid)}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${escHtml(time)} · 操作人: ${escHtml(log.operator || 'admin')}</div>
                        ${log.beforeData ? `<details style="margin-top:6px;"><summary style="cursor:pointer; font-size:12px; color:var(--primary);">查看修改前数据</summary><pre style="font-size:11px; color:var(--text-muted); margin-top:4px; max-height:200px; overflow:auto; white-space:pre-wrap; word-break:break-all;">${escHtml(JSON.stringify(log.beforeData, null, 2))}</pre></details>` : ''}
                        ${log.afterData ? `<details style="margin-top:4px;"><summary style="cursor:pointer; font-size:12px; color:var(--primary);">查看修改后数据</summary><pre style="font-size:11px; color:var(--text-muted); margin-top:4px; max-height:200px; overflow:auto; white-space:pre-wrap; word-break:break-all;">${escHtml(JSON.stringify(log.afterData, null, 2))}</pre></details>` : ''}
                    </div>
                    ${canRollback ? `<button class="rollback-btn" data-log-id="${escHtml(log.id)}" style="padding:6px 12px; border-radius:8px; border:1px solid var(--danger); background:transparent; color:var(--danger); cursor:pointer; font-size:12px; white-space:nowrap;">回滚</button>` : ''}
                </div>
            `;
        }).join('');

        // 绑定回滚按钮
        container.querySelectorAll('.rollback-btn').forEach(btn => {
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
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">加载失败: ${escHtml(err && err.message || '未知错误')}</div>`;
    }
}

// 打开数据库查看面板（全屏 overlay）
async function openDbViewerPanel() {
    const overlay = document.createElement('div');
    overlay.id = 'dbViewerOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; padding:20px;';
    overlay.innerHTML = `
        <div style="background:var(--bg-card); border-radius:16px; width:100%; max-width:1100px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
                <h3 style="margin:0; font-size:18px; font-weight:700;">数据库查看</h3>
                <button id="closeDbViewerBtn" style="padding:6px 12px; border-radius:8px; border:none; background:var(--danger); color:#fff; cursor:pointer; font-size:13px;">关闭</button>
            </div>
            <div style="display:flex; flex:1; overflow:hidden;">
                <div id="dbTablesSidebar" style="width:200px; border-right:1px solid var(--border-color); overflow-y:auto; padding:12px;">
                    <div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">加载中...</div>
                </div>
                <div id="dbTableDataContainer" style="flex:1; overflow:auto; padding:16px;">
                    <div style="text-align:center; padding:40px; color:var(--text-muted);">请从左侧选择一个表</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#closeDbViewerBtn').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // 加载表列表
    try {
        const tables = await Api.listDbTables();
        const sidebar = overlay.querySelector('#dbTablesSidebar');
        if (!Array.isArray(tables) || tables.length === 0) {
            sidebar.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">无可用表</div>';
            return;
        }
        sidebar.innerHTML = tables.map(t => `
            <div class="db-table-item" data-table="${escHtml(t.name)}" style="padding:8px 12px; margin-bottom:4px; border-radius:8px; cursor:pointer; font-size:13px; color:var(--text-main); display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;">
                <span>${escHtml(t.name)}</span>
                <span style="font-size:11px; color:var(--text-muted); background:var(--primary-light); padding:2px 8px; border-radius:10px;">${escHtml(t.count)}</span>
            </div>
        `).join('');

        sidebar.querySelectorAll('.db-table-item').forEach(item => {
            item.onclick = () => {
                sidebar.querySelectorAll('.db-table-item').forEach(i => i.style.background = '');
                item.style.background = 'var(--primary-light)';
                loadTableData(item.getAttribute('data-table'));
            };
            item.onmouseenter = () => { if (!item.style.background) item.style.background = 'var(--bg-hover, rgba(0,0,0,0.04))'; };
            item.onmouseleave = () => { if (item.style.background === 'var(--bg-hover, rgba(0,0,0,0.04))') item.style.background = ''; };
        });

        // 默认选中第一个表
        const firstItem = sidebar.querySelector('.db-table-item');
        if (firstItem) firstItem.click();
    } catch (err) {
        overlay.querySelector('#dbTablesSidebar').innerHTML = `<div style="color:var(--danger); font-size:13px; text-align:center; padding:20px;">加载失败</div>`;
    }
}

async function loadTableData(tableName, offset = 0) {
    const container = document.getElementById('dbTableDataContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">加载中...</div>';

    try {
        const limit = 50;
        const result = await Api.getDbTableData(tableName, { limit, offset });
        const { columns, rows, total } = result;

        let html = `
            <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; color:var(--text-muted);">表: <strong>${escHtml(tableName)}</strong> · 共 ${escHtml(total)} 行 · 显示 ${offset + 1}-${Math.min(offset + limit, total)}</span>
                <div style="display:flex; gap:8px;">
                    <button id="dbPrevPage" ${offset === 0 ? 'disabled' : ''} style="padding:4px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); cursor:${offset === 0 ? 'default' : 'pointer'}; font-size:12px; ${offset === 0 ? 'opacity:0.5;' : ''}">上一页</button>
                    <button id="dbNextPage" ${offset + limit >= total ? 'disabled' : ''} style="padding:4px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); cursor:${offset + limit >= total ? 'default' : 'pointer'}; font-size:12px; ${offset + limit >= total ? 'opacity:0.5;' : ''}">下一页</button>
                </div>
            </div>
        `;

        if (!rows || rows.length === 0) {
            html += '<div style="text-align:center; padding:40px; color:var(--text-muted);">此表无数据</div>';
        } else {
            html += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:12px;"><thead><tr>';
            columns.forEach(col => {
                html += `<th style="padding:8px 10px; text-align:left; border-bottom:2px solid var(--border-color); color:var(--text-main); font-weight:700; white-space:nowrap;">${escHtml(col)}</th>`;
            });
            html += '</tr></thead><tbody>';
            rows.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    const display = cell === null ? '<span style="color:var(--text-muted); font-style:italic;">NULL</span>' :
                        typeof cell === 'object' ? escHtml(JSON.stringify(cell)) :
                        escHtml(String(cell));
                    const isLong = String(cell || '').length > 100;
                    html += `<td style="padding:6px 10px; border-bottom:1px solid var(--border-color); color:var(--text-main); ${isLong ? 'max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' : ''}" title="${isLong ? escHtml(String(cell)) : ''}">${display}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }

        container.innerHTML = html;

        // 绑定分页按钮
        const prevBtn = container.querySelector('#dbPrevPage');
        const nextBtn = container.querySelector('#dbNextPage');
        if (prevBtn && offset > 0) prevBtn.onclick = () => loadTableData(tableName, offset - limit);
        if (nextBtn && offset + limit < total) nextBtn.onclick = () => loadTableData(tableName, offset + limit);
    } catch (err) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">加载失败: ${escHtml(err && err.message || '未知错误')}</div>`;
    }
}
