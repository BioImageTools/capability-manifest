// ============================================================================
// IMPORTS
// ============================================================================
import yaml from 'js-yaml';
import * as omezarr from 'ome-zarr.js';
import { FetchStore } from 'zarrita';
import type {
  Schema,
  ViewerManifest,
  OmeZarrMetadata,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './types';
import './style.css';

// ============================================================================
// CONSTANTS
// ============================================================================
const VIEWER_FILES = [
  'viewers/neuroglancer.yaml',
  'viewers/n5-ij.yaml',
  'viewers/vizarr.yaml'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function getUrlParameter(name: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function formatValue(value: any, defaultValue: any): string {
  const actualValue = value !== undefined ? value : defaultValue;

  if (typeof actualValue === 'boolean') {
    return actualValue
      ? '<span class="check">✓</span>'
      : '<span class="cross">✗</span>';
  } else if (Array.isArray(actualValue)) {
    if (actualValue.length === 0) return '<span class="array-value">None</span>';
    return '<span class="array-value">' + actualValue.join(', ') + '</span>';
  } else if (actualValue !== undefined && actualValue !== null) {
    return '<span class="value">' + actualValue + '</span>';
  } else {
    return '<span style="color: #ccc;">—</span>';
  }
}

function formatDefaultValue(defaultVal: any): string {
  if (defaultVal === null || defaultVal === undefined) {
    return '';
  }
  if (typeof defaultVal === 'boolean') {
    return defaultVal ? 'true' : 'false';
  } else if (Array.isArray(defaultVal)) {
    return defaultVal.length === 0 ? '[]' : JSON.stringify(defaultVal);
  }
  return String(defaultVal);
}

// ============================================================================
// DATA LOADING
// ============================================================================
async function loadSchema(): Promise<Schema> {
  const response = await fetch('schema.json');
  return response.json();
}

async function loadViewers(files: string[]): Promise<ViewerManifest[]> {
  const promises = files.map(async (file) => {
    const response = await fetch(file);
    const text = await response.text();
    return yaml.load(text) as ViewerManifest;
  });
  return Promise.all(promises);
}

async function loadZarrMetadata(url: string): Promise<OmeZarrMetadata> {
  try {
    console.log('Loading Zarr metadata from:', url);
    const store = new FetchStore(url);

    // Use ome-zarr.js to get multiscale data
    const { multiscale, omero, zarr_version } = await omezarr.getMultiscaleWithArray(store, 0);

    console.log('ome-zarr.js returned:');
    console.log('  multiscale:', multiscale);
    console.log('  omero:', omero);
    console.log('  zarr_version:', zarr_version);

    // Infer OME-Zarr version from Zarr version
    // Zarr v3 -> OME-Zarr 0.5
    // Zarr v2 -> OME-Zarr 0.4
    let omeZarrVersion: string;
    if (zarr_version === 3) {
      omeZarrVersion = '0.5';
    } else if (zarr_version === 2) {
      omeZarrVersion = '0.4';
    } else {
      omeZarrVersion = String(zarr_version); // fallback
    }

    console.log(`Zarr v${zarr_version} -> OME-Zarr v${omeZarrVersion}`);

    // Extract axes from multiscale and cast to our types
    const axes = (multiscale?.axes || []) as any;
    const multiscales = multiscale ? [multiscale as any] : [];

    const metadata: OmeZarrMetadata = {
      version: omeZarrVersion,
      axes: axes,
      multiscales: multiscales,
      omero: omero,
      labels: undefined,
      plate: undefined,
      compressor: undefined
    };

    console.log('Parsed metadata:', metadata);

    return metadata;
  } catch (error: any) {
    console.error('Error loading Zarr metadata:', error);
    throw new Error(`Failed to load Zarr metadata: ${error.message}`);
  }
}

// ============================================================================
// VALIDATION
// ============================================================================
function validateViewer(viewer: ViewerManifest, metadata: OmeZarrMetadata): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  console.log('='.repeat(80));
  console.log(`Validating viewer: ${viewer.viewer.name}`);
  console.log('Metadata:', metadata);
  console.log('Viewer capabilities:', viewer.capabilities);

  // Check version compatibility - this is critical
  let dataVersion: number | null = null;

  // Try to extract version from metadata (could be in root or in multiscales)
  if (metadata.version) {
    dataVersion = parseFloat(metadata.version);
    console.log(`Found version in root: ${dataVersion}`);
  } else if (metadata.multiscales && metadata.multiscales.length > 0 && metadata.multiscales[0].version) {
    dataVersion = parseFloat(metadata.multiscales[0].version);
    console.log(`Found version in multiscales[0]: ${dataVersion}`);
  } else {
    console.log('No version found in metadata');
  }

  if (dataVersion !== null) {
    console.log(`Data version: ${dataVersion}`);
    console.log(`Viewer supports versions:`, viewer.capabilities.ome_zarr_versions);

    if (!viewer.capabilities.ome_zarr_versions || viewer.capabilities.ome_zarr_versions.length === 0) {
      console.log('ERROR: Viewer does not specify OME-Zarr version support');
      errors.push({
        capability: 'ome_zarr_versions',
        message: `Viewer does not specify OME-Zarr version support (data is v${dataVersion})`,
        required: dataVersion,
        found: []
      });
    } else if (!viewer.capabilities.ome_zarr_versions.includes(dataVersion)) {
      console.log(`ERROR: Viewer does not support v${dataVersion}`);
      errors.push({
        capability: 'ome_zarr_versions',
        message: `Viewer does not support OME-Zarr v${dataVersion} (supports: ${viewer.capabilities.ome_zarr_versions.join(', ')})`,
        required: dataVersion,
        found: viewer.capabilities.ome_zarr_versions
      });
    } else {
      console.log(`OK: Viewer supports v${dataVersion}`);
    }
  }

  // Check compression codecs
  if (metadata.compressor) {
    const codec = metadata.compressor.id || metadata.compressor;
    if (viewer.capabilities.compression_codecs &&
        !viewer.capabilities.compression_codecs.includes(codec)) {
      errors.push({
        capability: 'compression_codecs',
        message: `Viewer does not support compression codec: ${codec}`,
        required: codec,
        found: viewer.capabilities.compression_codecs
      });
    }
  }

  // Check axes support
  if (metadata.axes && !viewer.capabilities.axes) {
    warnings.push({
      capability: 'axes',
      message: 'Dataset has axis metadata but viewer may not respect it'
    });
  }

  // Check for multiple channels
  const hasChannels = metadata.axes?.some(ax => ax.name === 'c' || ax.type === 'channel');
  if (hasChannels && !viewer.capabilities.channels) {
    errors.push({
      capability: 'channels',
      message: 'Dataset has multiple channels but viewer does not support them',
      required: true,
      found: false
    });
  }

  // Check for timepoints
  const hasTime = metadata.axes?.some(ax => ax.name === 't' || ax.type === 'time');
  if (hasTime && !viewer.capabilities.timepoints) {
    errors.push({
      capability: 'timepoints',
      message: 'Dataset has multiple timepoints but viewer does not support them',
      required: true,
      found: false
    });
  }

  // Check for labels
  if (metadata.labels && metadata.labels.length > 0 && !viewer.capabilities.labels) {
    errors.push({
      capability: 'labels',
      message: 'Dataset has labels but viewer does not support them',
      required: true,
      found: false
    });
  }

  // Check for HCS plates
  if (metadata.plate && !viewer.capabilities.hcs_plates) {
    errors.push({
      capability: 'hcs_plates',
      message: 'Dataset is an HCS plate but viewer does not support plates',
      required: true,
      found: false
    });
  }

  // Check OMERO metadata
  if (metadata.omero && !viewer.capabilities.omero_metadata) {
    warnings.push({
      capability: 'omero_metadata',
      message: 'Dataset has OMERO metadata but viewer may not use it'
    });
  }

  const result = {
    compatible: errors.length === 0,
    errors,
    warnings
  };

  console.log(`Validation result for ${viewer.viewer.name}:`, result);
  console.log(`  Compatible: ${result.compatible}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  console.log('='.repeat(80));

  return result;
}

// ============================================================================
// UI RENDERING
// ============================================================================
function displayDataInfo(dataUrl: string, metadata: OmeZarrMetadata): void {
  const dataInfoEl = document.getElementById('data-info')!;
  dataInfoEl.style.display = 'block';

  const html = `
    <h2>Dataset Information</h2>
    <div class="data-url">${dataUrl}</div>
    <div class="metadata-list">
      <div class="metadata-item">
        <span class="metadata-label">OME-Zarr Version:</span>
        <span class="metadata-value">${metadata.version || 'Unknown'}</span>
      </div>
      ${metadata.axes && metadata.axes.length > 0 ? `
        <div class="metadata-item">
          <span class="metadata-label">Axes:</span>
          <span class="metadata-value">${metadata.axes.map(a => a.name).join(', ')}</span>
        </div>
      ` : ''}
      ${metadata.multiscales && metadata.multiscales.length > 0 ? `
        <div class="metadata-item">
          <span class="metadata-label">Scale Levels:</span>
          <span class="metadata-value">${metadata.multiscales[0].datasets?.length || 'Unknown'}</span>
        </div>
      ` : ''}
      ${metadata.omero ? `
        <div class="metadata-item">
          <span class="metadata-label">OMERO Metadata:</span>
          <span class="metadata-value">✓ Present</span>
        </div>
      ` : ''}
      ${metadata.labels && metadata.labels.length > 0 ? `
        <div class="metadata-item">
          <span class="metadata-label">Labels:</span>
          <span class="metadata-value">${metadata.labels.length}</span>
        </div>
      ` : ''}
      ${metadata.plate ? `
        <div class="metadata-item">
          <span class="metadata-label">HCS Plate:</span>
          <span class="metadata-value">✓ Present</span>
        </div>
      ` : ''}
    </div>
  `;

  dataInfoEl.innerHTML = html;
}

function createLaunchButton(
  viewer: ViewerManifest,
  validation: ValidationResult | undefined,
  dataUrl: string | null
): HTMLElement {
  const container = document.createElement('div');

  if (!viewer.viewer.template_url) {
    return container; // Empty if no template_url
  }

  const button = document.createElement('a');
  button.className = 'viewer-link';
  button.textContent = 'Launch';
  button.target = '_blank';

  if (validation && !validation.compatible) {
    button.classList.add('disabled');
    button.setAttribute('aria-disabled', 'true');

    const errorList = document.createElement('ul');
    errorList.className = 'validation-errors';
    validation.errors.forEach(error => {
      const li = document.createElement('li');
      li.textContent = error.message;
      errorList.appendChild(li);
    });
    container.appendChild(errorList);
  } else {
    let url = viewer.viewer.template_url;
    if (dataUrl) {
      url = url.replace('{DATA_URL}', encodeURIComponent(dataUrl));
    }
    button.href = url;

    if (validation && validation.warnings.length > 0) {
      const warningList = document.createElement('ul');
      warningList.className = 'validation-warnings';
      validation.warnings.forEach(warning => {
        const li = document.createElement('li');
        li.textContent = warning.message;
        warningList.appendChild(li);
      });
      container.appendChild(warningList);
    }
  }

  container.insertBefore(button, container.firstChild);
  return container;
}

function renderTable(
  viewers: ViewerManifest[],
  schema: Schema,
  validations: Map<string, ValidationResult> | undefined,
  dataUrl: string | null
): void {
  const table = document.getElementById('capabilities-table')!;
  const thead = table.querySelector('thead tr')!;
  const tbody = document.getElementById('table-body')!;

  // Add viewer columns to header
  viewers.forEach(viewer => {
    const th = document.createElement('th');
    th.textContent = viewer.viewer.name;
    thead.appendChild(th);
  });

  // Helper to create metadata rows
  function createMetadataRow(fieldName: string): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.className = 'metadata-row';

    const labelCell = document.createElement('td');
    const nameSpan = document.createElement('div');
    nameSpan.textContent = fieldName;
    labelCell.appendChild(nameSpan);

    if (schema.properties?.viewer?.properties?.[fieldName]?.description) {
      const descSpan = document.createElement('span');
      descSpan.className = 'capability-description';
      descSpan.textContent = schema.properties.viewer.properties[fieldName].description!;
      labelCell.appendChild(descSpan);
    }

    row.appendChild(labelCell);
    return row;
  }

  // Add metadata rows: version, repo, template_url
  const versionRow = createMetadataRow('version');
  viewers.forEach(viewer => {
    const cell = document.createElement('td');
    cell.className = 'capability-cell';
    cell.textContent = viewer.viewer.version;
    versionRow.appendChild(cell);
  });
  tbody.appendChild(versionRow);

  const repoRow = createMetadataRow('repo');
  viewers.forEach(viewer => {
    const cell = document.createElement('td');
    cell.className = 'capability-cell';
    if (viewer.viewer.repo) {
      const link = document.createElement('a');
      link.href = viewer.viewer.repo;
      link.target = '_blank';
      link.className = 'viewer-link';
      link.textContent = 'Repository';
      cell.appendChild(link);
    }
    repoRow.appendChild(cell);
  });
  tbody.appendChild(repoRow);

  const linkRow = createMetadataRow('template_url');
  viewers.forEach(viewer => {
    const cell = document.createElement('td');
    cell.className = 'capability-cell';
    const validation = validations?.get(viewer.viewer.name);
    const buttonContainer = createLaunchButton(viewer, validation, dataUrl);
    cell.appendChild(buttonContainer);
    linkRow.appendChild(cell);
  });
  tbody.appendChild(linkRow);

  // Add capability rows
  const capabilitiesOrder = Object.keys(schema.properties.capabilities.properties);
  capabilitiesOrder.forEach(capability => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    const nameSpan = document.createElement('div');
    nameSpan.textContent = capability;
    nameCell.appendChild(nameSpan);

    const capSchema = schema.properties.capabilities.properties[capability];
    if (capSchema.description) {
      const descSpan = document.createElement('span');
      descSpan.className = 'capability-description';
      descSpan.textContent = capSchema.description;
      nameCell.appendChild(descSpan);
    }

    if (capSchema.default !== undefined) {
      const defaultSpan = document.createElement('span');
      defaultSpan.className = 'default-value';
      defaultSpan.textContent = 'Default: ' + formatDefaultValue(capSchema.default);
      nameCell.appendChild(defaultSpan);
    }

    row.appendChild(nameCell);

    viewers.forEach(viewer => {
      const cell = document.createElement('td');
      cell.className = 'capability-cell';
      const value = (viewer.capabilities as any)[capability];
      cell.innerHTML = formatValue(value, capSchema.default);
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================
async function main(): Promise<void> {
  try {
    const loadingEl = document.getElementById('loading')!;
    const errorEl = document.getElementById('error')!;

    // Load schema and viewers
    const [schema, viewers] = await Promise.all([
      loadSchema(),
      loadViewers(VIEWER_FILES)
    ]);

    // Get data URL from query string
    const dataUrl = getUrlParameter('url');

    // Load and validate Zarr metadata if URL provided
    let validations: Map<string, ValidationResult> | undefined;
    if (dataUrl) {
      try {
        const metadata = await loadZarrMetadata(dataUrl);

        // Display data info at the top
        displayDataInfo(dataUrl, metadata);

        validations = new Map();
        viewers.forEach(viewer => {
          validations!.set(
            viewer.viewer.name,
            validateViewer(viewer, metadata)
          );
        });
      } catch (error: any) {
        console.error('Failed to load Zarr metadata:', error);
        errorEl.textContent = `Failed to load Zarr metadata: ${error.message}`;
        errorEl.style.display = 'block';
      }
    }

    // Render table
    renderTable(viewers, schema, validations, dataUrl);

    // Hide loading, show table
    loadingEl.style.display = 'none';
    document.getElementById('capabilities-table')!.style.display = 'table';

  } catch (error: any) {
    console.error('Failed to initialize:', error);
    document.getElementById('loading')!.style.display = 'none';
    const errorEl = document.getElementById('error')!;
    errorEl.textContent = `Error: ${error.message}`;
    errorEl.style.display = 'block';
  }
}

// Start the application
main();
