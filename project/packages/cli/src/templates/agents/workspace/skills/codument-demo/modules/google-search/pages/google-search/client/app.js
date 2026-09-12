import { bindAgent, connectPage, listAgentTargets, sendAgentTask } from '/page-runner.js';

const SOP_FQN = 'Codument.Demo.SOP.GoogleSearch';

const targetSelect = document.querySelector('#agent-target');
const bindingStatus = document.querySelector('#binding-status');
const refreshTargetsButton = document.querySelector('#refresh-targets');
const sharedView = globalThis.__AI_CLI_PAGE_VIEWS__?.['google-search'];
if (!sharedView) throw new Error('Shared google-search business view is unavailable');
let lastRun;
let page;

const view = sharedView.mount(document.querySelector('#business-page'), {
  async submit() {
    const targetRef = await page.ready;
    await sendAgentTask({ action: SOP_FQN, targetRef });
  },
});

function render(run) {
  lastRun = run;
  view.renderRun(run);
}

page = connectPage('google-search', {
  registered(targetRef) {
    view.setStatus(`页面实例已连接 · ${targetRef.slice(-8)}`);
  },
  getState() {
    return { ...view.getState(), run: lastRun };
  },
  setResult({ run }) {
    render(run);
    return { accepted: true, targetRef: page.targetRef };
  },
});

async function refreshTargets() {
  refreshTargetsButton.disabled = true;
  bindingStatus.textContent = '正在刷新会话列表…';
  bindingStatus.dataset.kind = '';
  try {
    const payload = await listAgentTargets();
    targetSelect.replaceChildren();
    for (const target of payload.targets ?? []) {
      const option = document.createElement('option');
      option.value = target.targetId;
      option.dataset.scopeId = target.scopeId || '';
      option.textContent = target.detail ? `${target.label} · ${target.detail}` : target.label;
      option.selected = target.targetId === payload.lockedTargetId && (target.scopeId || '') === (payload.lockedScopeId || '');
      targetSelect.append(option);
    }
    if (!targetSelect.options.length) {
      targetSelect.append(new Option('当前 workspace 没有可用会话', ''));
    }
    bindingStatus.textContent = payload.lockedTargetId ? '已关联，可发送任务' : '请选择会话并关联';
  } catch (error) {
    bindingStatus.textContent = String(error.message || error);
    bindingStatus.dataset.kind = 'error';
  } finally {
    refreshTargetsButton.disabled = false;
  }
}

refreshTargetsButton.addEventListener('click', refreshTargets);

document.querySelector('#bind').addEventListener('click', async () => {
  const option = targetSelect.selectedOptions[0];
  if (!option?.value) return;
  try {
    const result = await bindAgent(option.value, option.dataset.scopeId || '');
    bindingStatus.textContent = `已关联：${result.label || option.textContent}`;
    bindingStatus.dataset.kind = 'ok';
  } catch (error) {
    bindingStatus.textContent = String(error.message || error);
    bindingStatus.dataset.kind = 'error';
  }
});

refreshTargets();
