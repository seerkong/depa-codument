(() => {
  const views = globalThis.__AI_CLI_PAGE_VIEWS__ ??= Object.create(null);
  if (views['open-data-export']) throw new Error('Duplicate business page view: open-data-export');

  function element(tag, attributes = {}, text = '') {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    if (text) node.textContent = text;
    return node;
  }

  views['open-data-export'] = Object.freeze({
    mount(root, actions) {
      if (!actions || typeof actions.submit !== 'function') throw new Error('open-data-export submit action is required');
      const style = element('style');
      style.textContent = `
        .owid-view { margin-top: 22px; color: #17243a; }
        .owid-view header { padding: 34px 4px 16px; }
        .owid-view .eyebrow { margin: 0; color: #147066; font-size: 12px; font-weight: 850; letter-spacing: .16em; }
        .owid-view h1 { max-width: 900px; margin: 9px 0 14px; font: 750 clamp(38px, 6vw, 68px)/1.02 Georgia, serif; }
        .owid-view .intro { max-width: 790px; margin: 0; color: #60727c; font-size: 17px; line-height: 1.65; }
        .owid-view .panel { margin-top: 16px; padding: 24px; border: 1px solid #cad9df; border-radius: 18px; background: rgba(255,255,255,.92); box-shadow: 0 18px 50px rgba(31,59,73,.07); }
        .owid-view .grid { display: grid; grid-template-columns: 1.4fr .7fr .7fr 1fr; gap: 12px; }
        .owid-view label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 800; }
        .owid-view input, .owid-view select, .owid-view button { width: 100%; min-height: 44px; border-radius: 10px; font: inherit; }
        .owid-view input, .owid-view select { border: 1px solid #bdccd2; padding: 0 12px; background: #fff; }
        .owid-view button { margin-top: 16px; border: 0; color: #fff; background: #135f5a; cursor: pointer; font-weight: 800; }
        .owid-view .status { margin: 12px 0 0; color: #647783; font-size: 13px; }
        .owid-view .status[data-kind="error"], .owid-view pre { color: #a33a32; }
        .owid-view .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .owid-view .pill { padding: 6px 10px; border-radius: 999px; background: #e5f3f0; color: #165e58; font-size: 12px; font-weight: 750; }
        .owid-view .table-wrap { overflow: auto; }
        .owid-view table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .owid-view th, .owid-view td { padding: 9px 11px; border-bottom: 1px solid #dce5e8; text-align: left; white-space: nowrap; }
        .owid-view th { position: sticky; top: 0; background: #f2f7f7; }
        .owid-view pre { overflow: auto; padding: 14px; border-radius: 10px; background: #fff0ed; white-space: pre-wrap; }
        @media (max-width: 780px) { .owid-view .grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 520px) { .owid-view .grid { grid-template-columns: 1fr; } }
      `;
      const viewRoot = element('div', { class: 'owid-view' });
      const header = element('header');
      header.append(
        element('p', { class: 'eyebrow' }, 'PUBLIC DATA · ADVANCED WORKFLOW DEMO'),
        element('h1', {}, 'OWID Open Data Export'),
        element('p', { class: 'intro' }, '筛选 Our World in Data 的 life-expectancy 图表，触发一次真实 ZIP 下载，并把 CSV 预览、metadata 与下载 receipt 精确回填。'),
      );
      const form = element('form', { class: 'panel', id: 'open-data-form' });
      const grid = element('div', { class: 'grid' });
      const fields = [
        ['entities', '实体代码（逗号分隔）', element('input', { id: 'entities', value: 'CHN,TUR', required: '', maxlength: '47' })],
        ['start-year', '起始年份', element('input', { id: 'start-year', type: 'number', value: '2000', min: '1543', max: '2023', required: '' })],
        ['end-year', '结束年份', element('input', { id: 'end-year', type: 'number', value: '2023', min: '1543', max: '2023', required: '' })],
        ['scope', '下载范围', element('select', { id: 'scope' })],
      ];
      fields[3][2].append(element('option', { value: 'displayed' }, 'Displayed data'), element('option', { value: 'full' }, 'Full data'));
      for (const [id, labelText, control] of fields) {
        const field = element('div');
        field.append(element('label', { for: id }, labelText), control);
        grid.append(field);
      }
      const submit = element('button', { type: 'submit' }, '通过 Agent 下载并解析');
      const status = element('p', { class: 'status', 'aria-live': 'polite' }, '等待提交…');
      form.append(grid, submit, status);
      const results = element('section', { class: 'panel' });
      results.append(element('h2', {}, '结构化结果'));
      const summary = element('div', { class: 'summary' });
      const tableWrap = element('div', { class: 'table-wrap' });
      const table = element('table');
      tableWrap.append(table);
      const errorBox = element('pre', { hidden: '' });
      results.append(summary, tableWrap, errorBox);
      viewRoot.append(header, form, results);
      root.append(style, viewRoot);

      function state() {
        return {
          chartSlug: 'life-expectancy',
          entityCodes: fields[0][2].value.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean),
          startYear: Number(fields[1][2].value),
          endYear: Number(fields[2][2].value),
          downloadScope: fields[3][2].value,
        };
      }
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        errorBox.hidden = true;
        status.textContent = '正在发送 schema 校验后的 typed input…';
        try {
          await actions.submit(state());
          status.textContent = '任务已发送；等待 PageWorkflow 下载、解码并回填…';
        } catch (error) {
          status.textContent = '发送失败'; status.dataset.kind = 'error';
          errorBox.textContent = String(error?.message || error); errorBox.hidden = false;
        } finally { submit.disabled = false; }
      });

      return Object.freeze({
        getState: state,
        setStatus(message, kind = '') { status.textContent = message; status.dataset.kind = kind; },
        renderRun(run) {
          summary.replaceChildren(); table.replaceChildren(); errorBox.hidden = true;
          if (run?.status === 'failed') {
            status.textContent = `基础设施失败${run.runId ? ` · ${run.runId}` : ''}`; status.dataset.kind = 'error';
            errorBox.textContent = run.error || 'Unknown PageWorkflow error'; errorBox.hidden = false; return;
          }
          if (run?.status !== 'completed') { status.textContent = '等待 PageWorkflow 结果…'; status.dataset.kind = 'running'; return; }
          const envelope = run.result || {};
          if (envelope.code !== 0) {
            status.textContent = `业务失败${run.runId ? ` · ${run.runId}` : ''}`; status.dataset.kind = 'error';
            errorBox.textContent = `${envelope.error?.kind || 'business-response'}: ${envelope.error?.detail || envelope.message || 'Unknown error'}`;
            errorBox.hidden = false; return;
          }
          const data = envelope.data || {};
          status.textContent = `已完成${run.runId ? ` · ${run.runId}` : ''}`; status.dataset.kind = 'success';
          for (const text of [`${data.rowCount || 0} rows`, `${(data.columns || []).length} columns`, envelope.meta?.downloadScope || '', envelope.meta?.fileName || '']) {
            if (text) summary.append(element('span', { class: 'pill' }, String(text)));
          }
          const columns = Array.isArray(data.columns) ? data.columns : [];
          const head = element('tr'); columns.forEach((column) => head.append(element('th', {}, String(column))));
          const thead = element('thead'); thead.append(head); table.append(thead);
          const tbody = element('tbody');
          for (const row of Array.isArray(data.previewRows) ? data.previewRows : []) {
            const tr = element('tr'); columns.forEach((column) => tr.append(element('td', {}, String(row?.[column] ?? '')))); tbody.append(tr);
          }
          table.append(tbody);
        },
      });
    },
  });
})();
