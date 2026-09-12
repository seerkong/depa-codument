import { inflateRawSync } from 'node:zlib';

function inputRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('input must be an object');
  return input;
}

const OWID_CHART_SLUG = 'life-expectancy';
const OWID_MAX_ENTITIES = 12;
const OWID_MAX_ZIP_ENTRIES = 32;
const OWID_MAX_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
const OWID_PREVIEW_ROWS = 10;

class OwidWorkflowError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'OwidWorkflowError';
    this.kind = kind;
  }
}

export function normalizeOwidInput(value) {
  const input = inputRecord(value);
  const chartSlug = String(input.chartSlug ?? '').trim();
  if (chartSlug !== OWID_CHART_SLUG) throw new Error(`chartSlug must be ${OWID_CHART_SLUG}`);
  if (!Array.isArray(input.entityCodes) || input.entityCodes.length < 1 || input.entityCodes.length > OWID_MAX_ENTITIES) {
    throw new Error(`entityCodes must contain 1-${OWID_MAX_ENTITIES} ISO-like codes`);
  }
  const entityCodes = [...new Set(input.entityCodes.map((code) => String(code).trim().toUpperCase()))];
  if (entityCodes.length !== input.entityCodes.length || entityCodes.some((code) => !/^[A-Z]{3}$/.test(code))) {
    throw new Error('entityCodes must be unique three-letter uppercase codes');
  }
  const startYear = Number(input.startYear);
  const endYear = Number(input.endYear);
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 1543 || endYear > 2023 || startYear > endYear) {
    throw new Error('year range must be integer years from 1543 through 2023 with startYear <= endYear');
  }
  const downloadScope = String(input.downloadScope ?? '').trim();
  if (downloadScope !== 'displayed' && downloadScope !== 'full') throw new Error('downloadScope must be displayed or full');
  return { chartSlug, entityCodes, startYear, endYear, downloadScope };
}

function findEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('ZIP end-of-central-directory record is missing');
}

export function decodeZipEntries(value) {
  const bytes = Buffer.from(value);
  const end = findEndOfCentralDirectory(bytes);
  const entryCount = bytes.readUInt16LE(end + 10);
  const centralOffset = bytes.readUInt32LE(end + 16);
  if (entryCount < 1 || entryCount > OWID_MAX_ZIP_ENTRIES) throw new Error(`ZIP entry count exceeds ${OWID_MAX_ZIP_ENTRIES}`);
  const entries = new Map();
  let offset = centralOffset;
  let totalSize = 0;
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP central directory is invalid');
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (!name || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..') || entries.has(name)) {
      throw new Error(`ZIP entry path is invalid or duplicated: ${name || '(empty)'}`);
    }
    if (!/\.(?:csv|json|md)$/i.test(name)) throw new Error(`ZIP entry type is not allowlisted: ${name}`);
    totalSize += uncompressedSize;
    if (totalSize > OWID_MAX_UNCOMPRESSED_BYTES) throw new Error('ZIP uncompressed data exceeds the size limit');
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`ZIP local header is invalid: ${name}`);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    if (compressed.byteLength !== compressedSize) throw new Error(`ZIP entry data is truncated: ${name}`);
    const decoded = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : undefined;
    if (!decoded) throw new Error(`ZIP compression method is unsupported: ${method}`);
    if (decoded.byteLength !== uncompressedSize) throw new Error(`ZIP entry size does not match: ${name}`);
    entries.set(name, new Uint8Array(decoded));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"' && field === '') { quoted = true; continue; }
    if (character === ',') { row.push(field); field = ''; continue; }
    if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += character;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field');
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function findEntry(entries, suffix) {
  const matches = [...entries.entries()].filter(([name]) => name.toLowerCase().endsWith(suffix));
  if (matches.length !== 1) throw new Error(`OWID ZIP must contain exactly one ${suffix.toUpperCase()} entry`);
  return matches[0];
}

function safeMetadata(metadata) {
  const chart = metadata?.chart && typeof metadata.chart === 'object' ? metadata.chart : {};
  const columns = metadata?.columns && typeof metadata.columns === 'object' ? metadata.columns : {};
  return {
    chartTitle: typeof chart.title === 'string' ? chart.title : '',
    citation: typeof chart.citation === 'string' ? chart.citation : '',
    columnCount: Object.keys(columns).length,
  };
}

export function processOwidArchive(artifact, rawInput) {
  const input = normalizeOwidInput(rawInput);
  if (!(artifact?.bytes instanceof Uint8Array)) throw new Error('Downloaded ZIP bytes are missing');
  const entries = decodeZipEntries(artifact.bytes);
  const [, csvBytes] = findEntry(entries, '.csv');
  const [, metadataBytes] = findEntry(entries, '.metadata.json');
  findEntry(entries, 'readme.md');
  const rows = parseCsv(new TextDecoder().decode(csvBytes));
  if (rows.length < 2 || rows[0].some((column) => !column)) throw new Error('OWID CSV has no header or data rows');
  const columns = rows[0];
  const previewRows = rows.slice(1, OWID_PREVIEW_ROWS + 1).map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ''])));
  if (input.downloadScope === 'displayed') {
    const codeIndex = columns.indexOf('Code');
    const yearIndex = columns.indexOf('Year');
    if (codeIndex < 0 || yearIndex < 0) throw new OwidWorkflowError('business-response', 'OWID displayed CSV is missing Code or Year columns');
    const unexpected = rows.slice(1).find((values) => (
      !input.entityCodes.includes(values[codeIndex])
      || !Number.isInteger(Number(values[yearIndex]))
      || Number(values[yearIndex]) < input.startYear
      || Number(values[yearIndex]) > input.endYear
    ));
    if (unexpected) throw new OwidWorkflowError('business-response', 'OWID displayed download did not honor the requested entities or year range');
  }
  let metadata;
  try { metadata = JSON.parse(new TextDecoder().decode(metadataBytes)); } catch (error) { throw new Error(`OWID metadata JSON is invalid: ${error instanceof Error ? error.message : String(error)}`); }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('OWID metadata JSON must be an object');
  return {
    columns,
    previewRows,
    rowCount: rows.length - 1,
    metadata: safeMetadata(metadata),
    files: [...entries.keys()].sort(),
    selection: input,
  };
}

function owidConfigureExpression(input) {
  const expected = JSON.stringify(input);
  return `(() => {
    const expected = ${expected};
    if (location.origin !== 'https://ourworldindata.org' || location.pathname !== '/grapher/' + expected.chartSlug) {
      return { ok: false, error: 'Unexpected OWID chart location' };
    }
    const next = new URL(location.href);
    next.searchParams.set('tab', 'chart');
    next.searchParams.set('time', expected.startYear + '..' + expected.endYear);
    next.searchParams.set('country', expected.entityCodes.join('~'));
    next.searchParams.delete('overlay');
    if (next.href !== location.href) location.assign(next.href);
    return { ok: true, url: next.href };
  })()`;
}

function owidVerifyExpression(input) {
  const expected = JSON.stringify(input);
  return `(() => {
    const expected = ${expected};
    const params = new URL(location.href).searchParams;
    const download = [...document.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === 'Download');
    const ok = location.origin === 'https://ourworldindata.org'
      && location.pathname === '/grapher/' + expected.chartSlug
      && params.get('tab') === 'chart'
      && params.get('time') === expected.startYear + '..' + expected.endYear
      && params.get('country') === expected.entityCodes.join('~')
      && Boolean(download);
    return ok ? { ok: true } : { ok: false, error: 'OWID chart state or Download control did not match the requested selection' };
  })()`;
}

const owidOpenDownloadExpression = `(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === 'Download');
  if (!button) return { ok: false, error: 'OWID Download control was not found' };
  button.click();
  return { ok: true };
})()`;

function owidVerifyDownloadExpression(input) {
  const target = input.downloadScope === 'displayed' ? 'download-filtered-data' : 'download-full-data';
  return `(() => {
    const link = document.querySelector('a[data-owid-download-url-target="${target}"]');
    return link ? { ok: true } : { ok: false, error: 'OWID ${input.downloadScope} ZIP link is not ready' };
  })()`;
}

function owidDownloadExpression(input) {
  const target = input.downloadScope === 'displayed' ? 'download-filtered-data' : 'download-full-data';
  const expected = JSON.stringify(input);
  return `(() => {
    const expected = ${expected};
    const link = document.querySelector('a[data-owid-download-url-target="${target}"]');
    if (!link) throw new Error('OWID ${input.downloadScope} ZIP link was not found');
    const url = new URL(link.href);
    const expectedType = expected.downloadScope === 'displayed' ? 'filtered' : 'full';
    if (url.origin !== 'https://ourworldindata.org' || url.pathname !== '/grapher/' + expected.chartSlug + '.zip' || url.searchParams.get('csvType') !== expectedType) {
      throw new Error('OWID ZIP link escaped the allowlisted chart or scope');
    }
    link.click();
  })()`;
}

function unwrapOwid(response) {
  return response?.result?.value ?? response;
}

async function owidStage(session, expression, kind, fallback) {
  const outcome = unwrapOwid(await session.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }));
  if (!outcome?.ok) throw new OwidWorkflowError(kind, outcome?.error || fallback);
  return outcome;
}

async function pollOwidStage(session, expression, kind, fallback) {
  let detail = fallback;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const outcome = unwrapOwid(await session.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }));
      if (outcome?.ok) return outcome;
      detail = outcome?.error || fallback;
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new OwidWorkflowError(kind, detail);
}

export const OwidChartPage = {
  configure: (session, input) => owidStage(session, owidConfigureExpression(input), 'page-interaction', 'Unable to configure OWID chart'),
  verify: (session, input) => pollOwidStage(session, owidVerifyExpression(input), 'page-structure', 'Unable to verify OWID chart'),
  async openDownload(session, input) {
    await owidStage(session, owidOpenDownloadExpression, 'page-interaction', 'Unable to open OWID download options');
    return pollOwidStage(session, owidVerifyDownloadExpression(input), 'page-structure', 'OWID download options did not become ready');
  },
  download(session, input) {
    return session.send('Page.download', {
      expression: owidDownloadExpression(input),
      timeoutMs: 30_000,
      maxBytes: 16 * 1024 * 1024,
      expectedExtensions: ['.zip'],
    });
  },
};

export const OwidChartActions = {
  configure: (session, _targets, input) => OwidChartPage.configure(session, normalizeOwidInput(input)),
  verify: (session, _targets, input) => OwidChartPage.verify(session, normalizeOwidInput(input)),
  openDownload: (session, _targets, input) => OwidChartPage.openDownload(session, normalizeOwidInput(input)),
  download: (session, _targets, input) => OwidChartPage.download(session, normalizeOwidInput(input)),
};

export const OpenDataExportPage = {
  async setResult(session, input) {
    return session.send('Page.setResult', inputRecord(input));
  },
};

function owidFailure(kind, detail, meta) {
  return { code: 1, message: detail, error: { kind, detail }, meta };
}

export const OwidOpenDataWorkflow = {
  async run(session, rawInput) {
    let input;
    try { input = normalizeOwidInput(rawInput); } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return owidFailure('input-validation', detail, { chartSlug: String(rawInput?.chartSlug ?? '') });
    }
    const meta = { chartSlug: input.chartSlug, entityCodes: input.entityCodes, startYear: input.startYear, endYear: input.endYear, downloadScope: input.downloadScope };
    try {
      await OwidChartPage.configure(session, input);
      await OwidChartPage.verify(session, input);
      await OwidChartPage.openDownload(session, input);
      let artifact;
      try { artifact = await OwidChartPage.download(session, input); } catch (error) {
        throw new OwidWorkflowError('download', error instanceof Error ? error.message : String(error));
      }
      let data;
      try { data = processOwidArchive(artifact, input); } catch (error) {
        if (error instanceof OwidWorkflowError) throw error;
        throw new OwidWorkflowError('decode', error instanceof Error ? error.message : String(error));
      }
      return {
        code: 0,
        message: `Downloaded and decoded ${data.rowCount} OWID rows`,
        data,
        meta: { ...meta, downloadGuid: artifact.guid, fileName: artifact.fileName, downloadBytes: artifact.size },
      };
    } catch (error) {
      const kind = error instanceof OwidWorkflowError ? error.kind : 'business-response';
      const detail = error instanceof Error ? error.message : String(error);
      return owidFailure(kind, detail, meta);
    }
  },
};

export { owidConfigureExpression, owidDownloadExpression, owidOpenDownloadExpression, owidVerifyDownloadExpression, owidVerifyExpression };
