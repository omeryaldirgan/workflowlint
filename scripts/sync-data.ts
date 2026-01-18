/**
 * Sync Data Script
 * 
 * Fetches data from official sources:
 * - SchemaStore: GitHub Workflow JSON Schema
 * - GitHub Docs: Security guidelines
 * - GitHub API: Runner labels
 * 
 * Usage: npx tsx scripts/sync-data.ts
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// =============================================================================
// Types
// =============================================================================

interface SyncResult {
  source: string;
  success: boolean;
  items: number;
  error?: string;
}

// =============================================================================
// Fetch Functions
// =============================================================================

async function fetchSchemaStore(): Promise<any> {
  console.log('📥 Fetching GitHub Workflow Schema from SchemaStore...');
  
  const response = await fetch('https://json.schemastore.org/github-workflow.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch schema: ${response.status}`);
  }
  
  return response.json();
}

async function fetchGitHubRunners(): Promise<string[]> {
  console.log('📥 Fetching GitHub-hosted runner labels...');
  
  // GitHub's official runner images README
  const response = await fetch('https://raw.githubusercontent.com/actions/runner-images/main/README.md');
  if (!response.ok) {
    throw new Error(`Failed to fetch runners: ${response.status}`);
  }
  
  const text = await response.text();
  const runners: string[] = [];
  
  // Parse runner labels from the table - capture all variations
  const patterns = [
    /ubuntu-\d+\.\d+[\w-]*/g,  // ubuntu-24.04, ubuntu-24.04-arm, etc.
    /ubuntu-latest[\w-]*/g,    // ubuntu-latest, ubuntu-latest-8-cores, etc.
    /macos-\d+[\w-]*/g,        // macos-14, macos-14-xlarge, macos-14-large, etc.
    /macos-latest[\w-]*/g,     // macos-latest, macos-latest-xlarge, etc.
    /windows-\d+[\w-]*/g,      // windows-2022, windows-2025, etc.
    /windows-latest[\w-]*/g,   // windows-latest, windows-latest-8-cores, etc.
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      runners.push(...matches);
    }
  }
  
  // Add known standard labels (from GitHub docs)
  // https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners
  const knownLabels = [
    // Self-hosted labels
    'self-hosted',
    'linux',
    'macos', 
    'windows',
    'x64',
    'arm64',
    'arm',
    
    // Larger runners (if not captured)
    'ubuntu-latest-4-cores',
    'ubuntu-latest-8-cores',
    'ubuntu-latest-16-cores',
    'ubuntu-22.04-arm',
    'ubuntu-24.04-arm',
    
    'macos-latest-xlarge',
    'macos-latest-large',
    'macos-14-xlarge',
    'macos-14-large',
    'macos-15-xlarge',
    'macos-15-large',
    
    'windows-latest-8-cores',
    'windows-2022-8-cores',
    'windows-11-arm',
  ];
  
  return [...new Set([...runners, ...knownLabels])].sort();
}

async function fetchDangerousContexts(): Promise<{ context: string; description: string }[]> {
  console.log('📥 Fetching dangerous contexts from GitHub Security docs...');
  
  // These are documented in GitHub Security Lab research
  // https://securitylab.github.com/research/github-actions-preventing-pwn-requests/
  // https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions
  
  return [
    { context: 'github.event.issue.title', description: 'Issue title - user controlled' },
    { context: 'github.event.issue.body', description: 'Issue body - user controlled' },
    { context: 'github.event.pull_request.title', description: 'PR title - user controlled' },
    { context: 'github.event.pull_request.body', description: 'PR body - user controlled' },
    { context: 'github.event.pull_request.head.ref', description: 'PR head branch name - user controlled' },
    { context: 'github.event.pull_request.head.label', description: 'PR head label - user controlled' },
    { context: 'github.event.pull_request.head.repo.default_branch', description: 'PR head repo default branch' },
    { context: 'github.event.comment.body', description: 'Comment body - user controlled' },
    { context: 'github.event.review.body', description: 'Review body - user controlled' },
    { context: 'github.event.review_comment.body', description: 'Review comment - user controlled' },
    { context: 'github.event.pages.*.page_name', description: 'Wiki page name - user controlled' },
    { context: 'github.event.commits.*.message', description: 'Commit message - user controlled' },
    { context: 'github.event.commits.*.author.email', description: 'Commit author email' },
    { context: 'github.event.commits.*.author.name', description: 'Commit author name' },
    { context: 'github.event.head_commit.message', description: 'Head commit message - user controlled' },
    { context: 'github.event.head_commit.author.email', description: 'Head commit author email' },
    { context: 'github.event.head_commit.author.name', description: 'Head commit author name' },
    { context: 'github.event.discussion.title', description: 'Discussion title - user controlled' },
    { context: 'github.event.discussion.body', description: 'Discussion body - user controlled' },
    { context: 'github.head_ref', description: 'Head branch reference - user controlled for PRs' },
    { context: 'github.event.workflow_run.head_branch', description: 'Triggering workflow head branch' },
    { context: 'github.event.workflow_run.head_commit.message', description: 'Triggering workflow commit message' },
  ];
}

function extractPermissions(schema: any): string[] {
  console.log('📦 Extracting permissions from schema...');
  
  const permissions: string[] = [];
  
  // Extract from permissions-event definition
  const permissionsEvent = schema.definitions?.['permissions-event']?.properties;
  if (permissionsEvent) {
    permissions.push(...Object.keys(permissionsEvent));
  }
  
  return permissions.sort();
}

function extractEventTypes(schema: any): { event: string; types?: string[] }[] {
  console.log('📦 Extracting event types from schema...');
  
  const events: { event: string; types?: string[] }[] = [];
  // Events are in properties.on.oneOf[2].properties
  const eventDefs = schema.properties?.on?.oneOf?.[2]?.properties || {};
  
  for (const [eventName, eventDef] of Object.entries(eventDefs)) {
    const def = eventDef as any;
    // Types might be in oneOf[1].properties.types.items.enum
    const types = def?.oneOf?.[1]?.properties?.types?.items?.enum;
    events.push({
      event: eventName,
      types: types || undefined,
    });
  }
  
  return events.sort((a, b) => a.event.localeCompare(b.event));
}

function extractEventKeys(schema: any): Record<string, string[]> {
  console.log('📦 Extracting valid keys for each event type...');
  
  const eventKeys: Record<string, string[]> = {};
  // Events are in properties.on.oneOf[2].properties
  const eventDefs = schema.properties?.on?.oneOf?.[2]?.properties || {};
  
  for (const [eventName, eventDef] of Object.entries(eventDefs)) {
    const def = eventDef as any;
    const keys: string[] = [];
    
    // Check for oneOf structure (like push, pull_request)
    const oneOf = def?.oneOf;
    if (oneOf) {
      for (const option of oneOf) {
        if (option?.allOf) {
          for (const allOfItem of option.allOf) {
            if (allOfItem?.properties) {
              keys.push(...Object.keys(allOfItem.properties));
            }
          }
        }
        if (option?.properties) {
          keys.push(...Object.keys(option.properties));
        }
      }
    }
    
    // Direct properties
    if (def?.properties) {
      keys.push(...Object.keys(def.properties));
    }
    
    eventKeys[eventName] = [...new Set(keys)].sort();
  }
  
  return eventKeys;
}

function getSecretPatterns(): { name: string; pattern: string; description: string }[] {
  console.log('📦 Getting secret patterns...');
  
  // These patterns are well-known and documented
  // Sources: 
  // - https://github.com/Yelp/detect-secrets
  // - https://github.com/trufflesecurity/trufflehog
  // - https://docs.gitguardian.com/secrets-detection/detectors/supported_credentials
  
  return [
    { name: 'AWS Access Key ID', pattern: 'AKIA[0-9A-Z]{16}', description: 'AWS Access Key ID' },
    { name: 'GitHub Personal Access Token', pattern: 'ghp_[a-zA-Z0-9]{36}', description: 'GitHub PAT (classic)' },
    { name: 'GitHub OAuth Token', pattern: 'gho_[a-zA-Z0-9]{36}', description: 'GitHub OAuth access token' },
    { name: 'GitHub User-to-Server Token', pattern: 'ghu_[a-zA-Z0-9]{36}', description: 'GitHub user-to-server token' },
    { name: 'GitHub Server-to-Server Token', pattern: 'ghs_[a-zA-Z0-9]{36}', description: 'GitHub server-to-server token' },
    { name: 'GitHub Refresh Token', pattern: 'ghr_[a-zA-Z0-9]{36}', description: 'GitHub refresh token' },
    { name: 'GitHub Fine-grained PAT', pattern: 'github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}', description: 'GitHub fine-grained PAT' },
    { name: 'Slack Bot Token', pattern: 'xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}', description: 'Slack bot token' },
    { name: 'Slack User Token', pattern: 'xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}', description: 'Slack user token' },
    { name: 'Slack Webhook URL', pattern: 'https://hooks\\.slack\\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[a-zA-Z0-9]+', description: 'Slack incoming webhook' },
    { name: 'Private Key', pattern: '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----', description: 'Private key header' },
    { name: 'Google API Key', pattern: 'AIza[0-9A-Za-z\\-_]{35}', description: 'Google API key' },
    { name: 'Stripe Live Key', pattern: 'sk_live_[0-9a-zA-Z]{24}', description: 'Stripe live secret key' },
    { name: 'Stripe Test Key', pattern: 'sk_test_[0-9a-zA-Z]{24}', description: 'Stripe test secret key' },
    { name: 'npm Token', pattern: 'npm_[A-Za-z0-9]{36}', description: 'npm access token' },
    { name: 'PyPI Token', pattern: 'pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\\-_]{50,}', description: 'PyPI API token' },
  ];
}

// =============================================================================
// Popular Actions - Fetch action.yml for input validation
// =============================================================================

// Top 50+ most used GitHub Actions
// Source: https://github.com/marketplace?type=actions (sorted by usage)
const POPULAR_ACTIONS = [
  // Official GitHub Actions
  'actions/checkout',
  'actions/setup-node',
  'actions/setup-python',
  'actions/setup-java',
  'actions/setup-go',
  'actions/setup-dotnet',
  'actions/cache',
  'actions/upload-artifact',
  'actions/download-artifact',
  'actions/github-script',
  'actions/create-release',
  'actions/labeler',
  'actions/stale',
  'actions/first-interaction',
  'actions/setup-ruby',
  
  // Docker
  'docker/setup-buildx-action',
  'docker/setup-qemu-action',
  'docker/login-action',
  'docker/build-push-action',
  'docker/metadata-action',
  
  // AWS
  'aws-actions/configure-aws-credentials',
  'aws-actions/amazon-ecr-login',
  'aws-actions/amazon-ecs-deploy-task-definition',
  'aws-actions/amazon-ecs-render-task-definition',
  
  // Azure
  'azure/login',
  'azure/webapps-deploy',
  'azure/docker-login',
  
  // Google Cloud
  'google-github-actions/auth',
  'google-github-actions/setup-gcloud',
  'google-github-actions/deploy-cloudrun',
  
  // Code Quality
  'codecov/codecov-action',
  'sonarsource/sonarcloud-github-action',
  'github/codeql-action',
  
  // Notifications
  'slackapi/slack-github-action',
  '8398a7/action-slack',
  
  // Deployment
  'peaceiris/actions-gh-pages',
  'JamesIves/github-pages-deploy-action',
  'cloudflare/pages-action',
  'vercel/actions',
  'amondnet/vercel-action',
  
  // Security
  'snyk/actions',
  'aquasecurity/trivy-action',
  'ossf/scorecard-action',
  
  // Release
  'softprops/action-gh-release',
  'changesets/action',
  'semantic-release/semantic-release',
  'google-github-actions/release-please-action',
  
  // Linting & Testing
  'super-linter/super-linter',
  'golangci/golangci-lint-action',
  'ruby/setup-ruby',
  'erlef/setup-beam',
  
  // Utilities
  'peter-evans/create-pull-request',
  'peter-evans/repository-dispatch',
  'dorny/paths-filter',
  'dawidd6/action-download-artifact',
];

interface ActionInput {
  description?: string;
  required?: boolean;
  default?: string;
}

interface ActionMetadata {
  name: string;
  description?: string;
  inputs: Record<string, ActionInput>;
  outputs?: Record<string, { description?: string }>;
}

async function fetchActionMetadata(action: string): Promise<ActionMetadata | null> {
  // Try main branch first, then master
  const branches = ['main', 'master', 'v4', 'v3', 'v2', 'v1'];
  
  for (const branch of branches) {
    try {
      const url = `https://raw.githubusercontent.com/${action}/${branch}/action.yml`;
      const response = await fetch(url);
      
      if (response.ok) {
        const text = await response.text();
        return parseActionYaml(text, action);
      }
      
      // Try action.yaml as well
      const urlYaml = `https://raw.githubusercontent.com/${action}/${branch}/action.yaml`;
      const responseYaml = await fetch(urlYaml);
      
      if (responseYaml.ok) {
        const text = await responseYaml.text();
        return parseActionYaml(text, action);
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

function parseActionYaml(content: string, action: string): ActionMetadata {
  const metadata: ActionMetadata = {
    name: action,
    inputs: {},
  };
  
  // Simple YAML parsing for action.yml structure
  const lines = content.split('\n');
  let inInputs = false;
  let currentInput = '';
  let inputIndent = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.search(/\S/);
    
    // Detect name
    if (trimmed.startsWith('name:')) {
      metadata.name = trimmed.replace('name:', '').trim().replace(/^['"]|['"]$/g, '');
    }
    
    // Detect description
    if (trimmed.startsWith('description:') && !inInputs) {
      metadata.description = trimmed.replace('description:', '').trim().replace(/^['"]|['"]$/g, '');
    }
    
    // Detect inputs section
    if (trimmed === 'inputs:') {
      inInputs = true;
      inputIndent = indent;
      continue;
    }
    
    // Exit inputs section
    if (inInputs && indent <= inputIndent && trimmed && !trimmed.startsWith('#')) {
      if (trimmed === 'outputs:' || trimmed === 'runs:' || trimmed === 'branding:') {
        inInputs = false;
        continue;
      }
    }
    
    // Parse input names
    if (inInputs && trimmed && !trimmed.startsWith('#')) {
      const inputMatch = trimmed.match(/^([a-zA-Z0-9_-]+):$/);
      if (inputMatch && indent === inputIndent + 2) {
        currentInput = inputMatch[1];
        metadata.inputs[currentInput] = {};
      }
      
      // Parse input properties
      if (currentInput && indent > inputIndent + 2) {
        if (trimmed.startsWith('required:')) {
          metadata.inputs[currentInput].required = trimmed.includes('true');
        }
        if (trimmed.startsWith('default:')) {
          metadata.inputs[currentInput].default = trimmed.replace('default:', '').trim().replace(/^['"]|['"]$/g, '');
        }
        if (trimmed.startsWith('description:')) {
          metadata.inputs[currentInput].description = trimmed.replace('description:', '').trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }
  }
  
  return metadata;
}

async function fetchPopularActions(): Promise<Record<string, ActionMetadata>> {
  console.log('📥 Fetching popular actions metadata...');
  
  const actions: Record<string, ActionMetadata> = {};
  let success = 0;
  let failed = 0;
  
  for (const action of POPULAR_ACTIONS) {
    const metadata = await fetchActionMetadata(action);
    if (metadata && Object.keys(metadata.inputs).length > 0) {
      actions[action] = metadata;
      success++;
      process.stdout.write(`  ✓ ${action}\n`);
    } else {
      failed++;
      process.stdout.write(`  ✗ ${action}\n`);
    }
  }
  
  console.log(`\n📦 Fetched ${success} actions (${failed} failed)\n`);
  return actions;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('🚀 WorkflowLint Data Sync\n');
  console.log('Sources:');
  console.log('  - SchemaStore: https://json.schemastore.org/github-workflow.json');
  console.log('  - GitHub Runner Images: https://github.com/actions/runner-images');
  console.log('  - GitHub Security Docs: https://docs.github.com/en/actions/security-guides');
  console.log('  - Popular Actions: GitHub Marketplace top actions\n');
  
  // Create data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const results: SyncResult[] = [];
  
  try {
    // 1. Fetch and process schema
    const schema = await fetchSchemaStore();
    const permissions = extractPermissions(schema);
    const eventTypes = extractEventTypes(schema);
    const eventKeys = extractEventKeys(schema);
    
    // Save schema data
    const schemaData = {
      $source: 'https://json.schemastore.org/github-workflow.json',
      $updated: new Date().toISOString(),
      permissions,
      events: eventTypes,
      eventKeys, // Valid keys for each trigger type (push, pull_request, etc.)
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'schema.json'),
      JSON.stringify(schemaData, null, 2)
    );
    
    // Also save full schema for validation
    fs.writeFileSync(
      path.join(DATA_DIR, 'github-workflow-schema.json'),
      JSON.stringify(schema, null, 2)
    );
    
    results.push({ source: 'SchemaStore', success: true, items: permissions.length + eventTypes.length });
    console.log(`Schema: ${permissions.length} permissions, ${eventTypes.length} events\n`);
    console.log(`Full schema saved for validation\n`);
    
    // 2. Fetch runners
    const runners = await fetchGitHubRunners();
    const runnersData = {
      $source: 'https://github.com/actions/runner-images',
      $updated: new Date().toISOString(),
      runners,
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'runners.json'),
      JSON.stringify(runnersData, null, 2)
    );
    results.push({ source: 'GitHub Runners', success: true, items: runners.length });
    console.log(`Runners: ${runners.length} labels\n`);
    
    // 3. Dangerous contexts
    const contexts = await fetchDangerousContexts();
    const contextsData = {
      $source: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
      $updated: new Date().toISOString(),
      contexts,
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'contexts.json'),
      JSON.stringify(contextsData, null, 2)
    );
    results.push({ source: 'Dangerous Contexts', success: true, items: contexts.length });
    console.log(`Dangerous contexts: ${contexts.length} patterns\n`);
    
    // 4. Secret patterns
    const secrets = getSecretPatterns();
    const secretsData = {
      $sources: [
        'https://github.com/Yelp/detect-secrets',
        'https://github.com/trufflesecurity/trufflehog',
        'https://docs.gitguardian.com/secrets-detection/detectors/supported_credentials',
      ],
      $updated: new Date().toISOString(),
      patterns: secrets,
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'secrets.json'),
      JSON.stringify(secretsData, null, 2)
    );
    results.push({ source: 'Secret Patterns', success: true, items: secrets.length });
    console.log(`Secret patterns: ${secrets.length} patterns\n`);
    
    // 5. Popular Actions Metadata
    const actions = await fetchPopularActions();
    const actionsData = {
      $source: 'GitHub Action repositories (action.yml)',
      $updated: new Date().toISOString(),
      actions,
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'actions.json'),
      JSON.stringify(actionsData, null, 2)
    );
    results.push({ source: 'Popular Actions', success: true, items: Object.keys(actions).length });
    console.log(`Popular actions: ${Object.keys(actions).length} actions\n`);
    
    // Summary
    console.log('═══════════════════════════════════════════════');
    console.log('📊 Sync Complete!\n');
    for (const r of results) {
      console.log(`  ${r.success ? '✅' : '❌'} ${r.source}: ${r.items} items`);
    }
    console.log('\n📁 Data saved to: data/');
    console.log('  - schema.json');
    console.log('  - runners.json');
    console.log('  - contexts.json');
    console.log('  - secrets.json');
    console.log('  - actions.json');
    
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

main();
