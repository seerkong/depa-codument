(() => {
  const views = globalThis.__AI_CLI_PAGE_VIEWS__ ??= Object.create(null);
  if (views['google-search']) throw new Error('Duplicate business page view: google-search');

  function element(tag, attributes = {}, text = '') {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    if (text) node.textContent = text;
    return node;
  }

  views['google-search'] = Object.freeze({
    mount(root, actions) {
      if (!actions || typeof actions.submit !== 'function') throw new Error('google-search submit action is required');
      const style = element('style');
      style.textContent = `
        .google-search-view { width: min(980px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 72px; color: #20251f; }
        .google-search-view header { margin-bottom: 26px; }
        .google-search-view .eyebrow { color: #586a45; font-size: 12px; font-weight: 800; letter-spacing: .16em; }
        .google-search-view h1 { margin: 8px 0 16px; font: 700 clamp(36px, 6vw, 64px)/1 Georgia, serif; }
        .google-search-view .intro { max-width: 720px; color: #626a5e; font-size: 17px; line-height: 1.65; }
        .google-search-view .panel { margin-top: 18px; padding: 24px; border: 1px solid #d6dacd; border-radius: 20px; background: #fff; }
        .google-search-view label { display: block; margin-bottom: 10px; font-size: 13px; font-weight: 750; }
        .google-search-view .row { display: grid; grid-template-columns: 1fr max-content; gap: 10px; }
        .google-search-view input, .google-search-view button { min-height: 46px; border-radius: 12px; font: inherit; }
        .google-search-view input { width: 100%; border: 1px solid #c7ccbe; padding: 0 14px; }
        .google-search-view button { border: 0; padding: 0 20px; color: #fff; background: #365c3b; cursor: pointer; font-weight: 750; }
        .google-search-view .status { margin: 12px 0 0; color: #667061; font-size: 13px; }
        .google-search-view .status[data-kind="error"], .google-search-view pre { color: #a23225; }
        .google-search-view .results-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .google-search-view h2 { margin: 0; font: 700 26px Georgia, serif; }
        .google-search-view li { padding: 17px 4px; border-bottom: 1px solid #e1e4dc; }
        .google-search-view li a { color: #1b552c; font-size: 18px; font-weight: 750; }
        .google-search-view li p { margin: 7px 0 0; line-height: 1.55; }
        @media (max-width: 640px) { .google-search-view .row { grid-template-columns: 1fr; } }
      `;
      const viewRoot = element('div', { class: 'google-search-view' });
      const header = element('header');
      header.append(
        element('p', { class: 'eyebrow' }, 'DEPA CODUMENT DEMO'),
        element('h1', {}, 'Google 搜索结果结构化演示'),
        element('p', { class: 'intro' }, '通过当前 Agent 按 SOP 启动 Ego PageWorkflow，并把 Google HK 首页结果精确回填到本页。'),
      );

      const form = element('form', { id: 'search-form', class: 'panel' });
      const label = element('label', { for: 'query' }, 'Google HK 搜索词');
      const row = element('div', { class: 'row' });
      const queryInput = element('input', {
        id: 'query', name: 'query', required: '', maxlength: '200', value: 'agentic workflows', autocomplete: 'off',
      });
      const submit = element('button', { type: 'submit' }, '通过 Agent 搜索');
      row.append(queryInput, submit);
      const runStatus = element('p', { class: 'status', 'aria-live': 'polite' }, '等待提交…');
      form.append(label, row, runStatus);

      const resultsPanel = element('section', { class: 'panel results' });
      const heading = element('div', { class: 'results-heading' });
      const resultCount = element('span', {}, '0 条');
      heading.append(element('h2', {}, '第一页自然搜索结果'), resultCount);
      const resultList = element('ol');
      const errorBox = element('pre', { hidden: '' });
      resultsPanel.append(heading, resultList, errorBox);
      viewRoot.append(header, form, resultsPanel);
      root.append(style, viewRoot);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const query = queryInput.value.trim();
        if (!query) return;
        submit.disabled = true;
        errorBox.hidden = true;
        runStatus.textContent = '正在把结构化任务发送给当前 Agent…';
        try {
          await actions.submit({ query });
          runStatus.textContent = '任务已发送；等待 Agent 启动 PageWorkflow 并回填结果…';
        } catch (error) {
          runStatus.textContent = '发送失败';
          runStatus.dataset.kind = 'error';
          errorBox.textContent = String(error?.message || error);
          errorBox.hidden = false;
        } finally {
          submit.disabled = false;
        }
      });

      return Object.freeze({
        getState() {
          return { query: queryInput.value };
        },
        setStatus(message, kind = '') {
          runStatus.textContent = message;
          runStatus.dataset.kind = kind;
        },
        renderRun(run) {
          resultList.replaceChildren();
          errorBox.hidden = true;
          const results = Array.isArray(run?.result?.results) ? run.result.results : [];
          resultCount.textContent = `${results.length} 条`;
          if (run?.status === 'failed') {
            runStatus.textContent = `执行失败${run.runId ? ` · ${run.runId}` : ''}`;
            runStatus.dataset.kind = 'error';
            errorBox.textContent = run.error || 'Unknown PageWorkflow error';
            errorBox.hidden = false;
            return;
          }
          if (run?.status !== 'completed') {
            runStatus.textContent = '等待 PageWorkflow 结果…';
            runStatus.dataset.kind = 'running';
            return;
          }
          runStatus.textContent = `已完成${run.runId ? ` · ${run.runId}` : ''} · ${results.length} 条`;
          runStatus.dataset.kind = 'success';
          for (const result of results) {
            const item = element('li');
            const link = element('a', {
              href: String(result.url || '#'), target: '_blank', rel: 'noreferrer',
            }, String(result.title || result.url || 'Untitled result'));
            const url = element('p', { class: 'url' }, String(result.displayUrl || result.url || ''));
            const snippet = element('p', {}, String(result.snippet || '（该结果没有可见摘要）'));
            item.append(link, url, snippet);
            resultList.append(item);
          }
        },
      });
    },
  });
})();
