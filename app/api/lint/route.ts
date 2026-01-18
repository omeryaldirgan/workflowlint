import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// =============================================================================
// Types
// =============================================================================

type Locale = 'tr' | 'en';

interface Finding {
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  message: string;
  line: number;
  column: number;
  snippet?: string;
  recommendation: string;
  docs?: string;
}

interface LintResult {
  findings: Finding[];
  summary: { critical: number; high: number; medium: number; low: number; info: number };
  score: number;
  grade: string;
  duration: number;
}

// =============================================================================
// Load Data from JSON files (synced from official sources)
// =============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');

function loadJsonData<T>(filename: string): T | null {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    console.warn(`Warning: Could not load ${filename}`);
    return null;
  }
}

// Load data once at startup
const runnersData = loadJsonData<{ runners: string[] }>('runners.json');
const contextsData = loadJsonData<{ contexts: { context: string; description: string }[] }>('contexts.json');
const secretsData = loadJsonData<{ patterns: { name: string; pattern: string; description: string }[] }>('secrets.json');
const schemaData = loadJsonData<{ 
  permissions: string[]; 
  eventKeys: Record<string, string[]>;
  events: { event: string; types?: string[] }[];
}>('schema.json');

interface ActionMetadata {
  name: string;
  inputs: Record<string, { required?: boolean; default?: string; description?: string }>;
}
const actionsData = loadJsonData<{ actions: Record<string, ActionMetadata> }>('actions.json');

// Extract values
const VALID_RUNNERS = runnersData?.runners || [];
const DANGEROUS_CONTEXTS = contextsData?.contexts?.map(c => c.context) || [];
const SECRET_PATTERNS = secretsData?.patterns?.map(p => ({ name: p.name, regex: new RegExp(p.pattern) })) || [];
const VALID_PERMISSIONS = schemaData?.permissions || [];
const EVENT_KEYS = schemaData?.eventKeys || {};
const VALID_EVENTS = schemaData?.events?.map(e => e.event) || [];
const ACTIONS = actionsData?.actions || {};

// =============================================================================
// Localized Messages
// =============================================================================

const messages = {
  tr: {
    expressionInjection: 'Expression Injection',
    expressionInjectionMsg: (ctx: string) => `"${ctx}" kullanıcı tarafından kontrol edilebilir. Inline script'lerde doğrudan kullanımı tehlikeli.`,
    expressionInjectionRec: 'Değişkeni env: ile environment variable olarak geçirin.',
    
    hardcodedSecret: 'Hardcoded Secret',
    hardcodedSecretMsg: (name: string) => `${name} tespit edildi. Secret'ları asla kod içinde tutmayın.`,
    hardcodedSecretRec: 'GitHub Secrets kullanın: ${{ secrets.YOUR_SECRET }}',
    
    dangerousTrigger: 'Dangerous Trigger',
    dangerousTriggerPRT: 'pull_request_target fork PR\'larında write izinleri ve secret erişimi ile çalışır.',
    dangerousTriggerPRTRec: 'Mümkünse pull_request trigger kullanın. Gerekiyorsa checkout ref dikkatli seçin.',
    dangerousTriggerWR: 'workflow_run fork PR\'larının artifact\'larını işleyebilir.',
    dangerousTriggerWRRec: 'Artifact içeriğini doğrulayın, güvenilmeyen veri çalıştırmayın.',
    
    excessivePermissions: 'Excessive Permissions',
    excessivePermissionsMsg: 'write-all tüm scope\'lara full write erişimi verir.',
    excessivePermissionsRec: 'Sadece gerekli izinleri açıkça belirtin (contents: read, issues: write vb.).',
    
    unpinnedAction: 'Unpinned Action',
    unpinnedActionMsg: (action: string, ref: string) => `"${action}" mutable ref "${ref}" kullanıyor. Supply chain saldırısına açık.`,
    unpinnedActionRec: 'Action\'ları tam commit SHA ile sabitleyin.',
    
    dangerousCommand: 'Dangerous Command',
    dangerousCommandMsg: 'HTTP içeriğini doğrudan shell\'e pipe etmek güvensiz kod çalıştırır.',
    dangerousCommandRec: 'Önce dosyayı indirin, checksum doğrulayın, sonra çalıştırın.',
    
    unsafeCheckout: 'Unsafe Checkout',
    unsafeCheckoutMsg: 'pull_request_target ile PR head ref checkout etmek repository yazma yetkisi verir.',
    unsafeCheckoutRec: 'PR kodunu ayrı bir workflow\'da işleyin veya sadece PR numarasını kullanın.',
    
    invalidRunner: 'Invalid Runner',
    invalidRunnerMsg: (runner: string) => `"${runner}" geçerli bir GitHub-hosted runner değil.`,
    invalidRunnerRec: 'ubuntu-latest, macos-latest veya windows-latest kullanın.',
    
    invalidKey: 'Invalid Key',
    invalidKeyMsg: '"branch" yerine "branches" kullanılmalı.',
    invalidKeyRec: 'branch: → branches:',
    
    unknownEventKey: 'Bilinmeyen Event Key',
    unknownEventKeyMsg: (key: string, event: string, valid: string[]) => 
      `"${key}" "${event}" trigger'ı için geçerli bir key değil. Geçerli key'ler: ${valid.join(', ') || 'yok'}`,
    unknownEventKeyRec: 'Geçerli key kullanın veya typo kontrolü yapın.',
    
    missingJobs: 'Jobs Section Eksik',
    missingJobsMsg: 'Workflow dosyasında "jobs" bölümü zorunludur.',
    missingJobsRec: 'jobs: bölümü ekleyin ve en az bir job tanımlayın.',
    
    invalidGlobPattern: 'Geçersiz Glob Pattern',
    invalidGlobPatternMsg: (char: string) => 
      `"${char}" karakteri branch/tag isimlerinde geçersiz. Sadece [, ?, +, *, \\ özel karakterleri kullanılabilir.`,
    invalidGlobPatternRec: 'Glob pattern kullanın, regex değil. Örnek: v* veya release/**',
    
    invalidActionInput: 'Geçersiz Action Input',
    invalidActionInputMsg: (input: string, action: string, valid: string[]) =>
      `"${input}" input'u "${action}" action'ında tanımlı değil. Geçerli input'lar: ${valid.slice(0, 5).join(', ')}${valid.length > 5 ? '...' : ''}`,
    invalidActionInputRec: 'Action\'ın dokümantasyonunu kontrol edin ve doğru input adını kullanın.',
    
    missingSteps: 'Steps Eksik',
    missingStepsMsg: (job: string) => `"${job}" job'unda "steps" bölümü zorunludur.`,
    missingStepsRec: 'Her job\'a en az bir step ekleyin.',
    
    missingRunsOn: 'Runs-on Eksik',
    missingRunsOnMsg: (job: string) => `"${job}" job'unda "runs-on" tanımı zorunludur.`,
    missingRunsOnRec: 'runs-on: ubuntu-latest veya başka bir runner belirtin.',
    
    invalidYaml: 'Geçersiz YAML',
    invalidYamlMsg: (error: string) => `YAML parse hatası: ${error}`,
    invalidYamlRec: 'YAML syntax\'ınızı kontrol edin.',
    
    invalidEvent: 'Geçersiz Event',
    invalidEventMsg: (event: string, valid: string[]) => 
      `"${event}" geçerli bir GitHub Actions event'i değil. Örnek geçerli event'ler: ${valid.slice(0, 5).join(', ')}...`,
    invalidEventRec: 'GitHub Actions dokümantasyonundan geçerli event\'leri kontrol edin.',
    
    invalidPermission: 'Geçersiz Permission',
    invalidPermissionMsg: (perm: string, valid: string[]) => 
      `"${perm}" geçerli bir permission scope değil. Geçerli scope'lar: ${valid.join(', ')}`,
    invalidPermissionRec: 'Sadece geçerli permission scope\'larını kullanın.',
    
    invalidPermissionLevel: 'Geçersiz Permission Level',
    invalidPermissionLevelMsg: (level: string) => 
      `"${level}" geçerli bir permission level değil. Geçerli değerler: read, write, none`,
    invalidPermissionLevelRec: 'read, write veya none kullanın.',
    
    invalidCron: 'Geçersiz Cron',
    invalidCronMsg: (cron: string) => `"${cron}" geçerli bir cron ifadesi değil.`,
    invalidCronRec: 'Cron formatı: dakika saat gün ay gün_adı (örn: 0 0 * * 0)',
  },
  en: {
    expressionInjection: 'Expression Injection',
    expressionInjectionMsg: (ctx: string) => `"${ctx}" is user-controllable. Direct use in inline scripts is dangerous.`,
    expressionInjectionRec: 'Pass the variable as environment variable using env:',
    
    hardcodedSecret: 'Hardcoded Secret',
    hardcodedSecretMsg: (name: string) => `${name} detected. Never store secrets in code.`,
    hardcodedSecretRec: 'Use GitHub Secrets: ${{ secrets.YOUR_SECRET }}',
    
    dangerousTrigger: 'Dangerous Trigger',
    dangerousTriggerPRT: 'pull_request_target runs with write permissions and secret access for fork PRs.',
    dangerousTriggerPRTRec: 'Use pull_request trigger if possible. Choose checkout ref carefully if needed.',
    dangerousTriggerWR: 'workflow_run can process artifacts from fork PRs.',
    dangerousTriggerWRRec: 'Validate artifact content, don\'t execute untrusted data.',
    
    excessivePermissions: 'Excessive Permissions',
    excessivePermissionsMsg: 'write-all grants full write access to all scopes.',
    excessivePermissionsRec: 'Explicitly specify only required permissions (contents: read, issues: write, etc.).',
    
    unpinnedAction: 'Unpinned Action',
    unpinnedActionMsg: (action: string, ref: string) => `"${action}" uses mutable ref "${ref}". Vulnerable to supply chain attacks.`,
    unpinnedActionRec: 'Pin actions to full commit SHA.',
    
    dangerousCommand: 'Dangerous Command',
    dangerousCommandMsg: 'Piping HTTP content directly to shell executes untrusted code.',
    dangerousCommandRec: 'Download file first, verify checksum, then execute.',
    
    unsafeCheckout: 'Unsafe Checkout',
    unsafeCheckoutMsg: 'Checking out PR head ref with pull_request_target grants repository write access.',
    unsafeCheckoutRec: 'Process PR code in a separate workflow or use only PR number.',
    
    invalidRunner: 'Invalid Runner',
    invalidRunnerMsg: (runner: string) => `"${runner}" is not a valid GitHub-hosted runner.`,
    invalidRunnerRec: 'Use ubuntu-latest, macos-latest, or windows-latest.',
    
    invalidKey: 'Invalid Key',
    invalidKeyMsg: 'Use "branches" instead of "branch".',
    invalidKeyRec: 'branch: → branches:',
    
    unknownEventKey: 'Unknown Event Key',
    unknownEventKeyMsg: (key: string, event: string, valid: string[]) => 
      `"${key}" is not a valid key for "${event}" trigger. Valid keys: ${valid.join(', ') || 'none'}`,
    unknownEventKeyRec: 'Use a valid key or check for typos.',
    
    missingJobs: 'Missing Jobs Section',
    missingJobsMsg: '"jobs" section is required in workflow file.',
    missingJobsRec: 'Add a jobs: section with at least one job defined.',
    
    invalidGlobPattern: 'Invalid Glob Pattern',
    invalidGlobPatternMsg: (char: string) => 
      `Character "${char}" is invalid for branch/tag names. Only special characters [, ?, +, *, \\ are allowed.`,
    invalidGlobPatternRec: 'Use glob patterns, not regex. Example: v* or release/**',
    
    invalidActionInput: 'Invalid Action Input',
    invalidActionInputMsg: (input: string, action: string, valid: string[]) =>
      `Input "${input}" is not defined in action "${action}". Available inputs: ${valid.slice(0, 5).join(', ')}${valid.length > 5 ? '...' : ''}`,
    invalidActionInputRec: 'Check action documentation and use the correct input name.',
    
    missingSteps: 'Missing Steps',
    missingStepsMsg: (job: string) => `Job "${job}" requires a "steps" section.`,
    missingStepsRec: 'Add at least one step to each job.',
    
    missingRunsOn: 'Missing Runs-on',
    missingRunsOnMsg: (job: string) => `Job "${job}" requires a "runs-on" definition.`,
    missingRunsOnRec: 'Specify runs-on: ubuntu-latest or another runner.',
    
    invalidYaml: 'Invalid YAML',
    invalidYamlMsg: (error: string) => `YAML parse error: ${error}`,
    invalidYamlRec: 'Check your YAML syntax.',
    
    invalidEvent: 'Invalid Event',
    invalidEventMsg: (event: string, valid: string[]) => 
      `"${event}" is not a valid GitHub Actions event. Example valid events: ${valid.slice(0, 5).join(', ')}...`,
    invalidEventRec: 'Check GitHub Actions documentation for valid events.',
    
    invalidPermission: 'Invalid Permission',
    invalidPermissionMsg: (perm: string, valid: string[]) => 
      `"${perm}" is not a valid permission scope. Valid scopes: ${valid.join(', ')}`,
    invalidPermissionRec: 'Use only valid permission scopes.',
    
    invalidPermissionLevel: 'Invalid Permission Level',
    invalidPermissionLevelMsg: (level: string) => 
      `"${level}" is not a valid permission level. Valid values: read, write, none`,
    invalidPermissionLevelRec: 'Use read, write, or none.',
    
    invalidCron: 'Invalid Cron',
    invalidCronMsg: (cron: string) => `"${cron}" is not a valid cron expression.`,
    invalidCronRec: 'Cron format: minute hour day month weekday (e.g., 0 0 * * 0)',
  },
};

// =============================================================================
// Linter
// =============================================================================

function lint(code: string, locale: Locale = 'en'): LintResult {
  const start = performance.now();
  const findings: Finding[] = [];
  const lines = code.split('\n');
  const msg = messages[locale];

  // ==========================================================================
  // YAML Parsing & Structure Validation
  // ==========================================================================
  
  let workflow: any = null;
  try {
    workflow = YAML.parse(code);
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    findings.push({
      ruleId: 'invalid-yaml',
      severity: 'critical',
      category: 'syntax',
      title: msg.invalidYaml,
      message: msg.invalidYamlMsg(error),
      line: 1,
      column: 1,
      recommendation: msg.invalidYamlRec,
      docs: 'https://yaml.org/spec/',
    });
    // Return early if YAML is invalid
    return {
      findings,
      summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
      score: 0,
      grade: 'F',
      duration: performance.now() - start,
    };
  }

  // Check for required 'jobs' section
  if (!workflow || !workflow.jobs) {
    const onLineIdx = lines.findIndex(l => l.trim().startsWith('on:'));
    findings.push({
      ruleId: 'missing-jobs',
      severity: 'high',
      category: 'syntax',
      title: msg.missingJobs,
      message: msg.missingJobsMsg,
      line: onLineIdx >= 0 ? onLineIdx + 1 : 1,
      column: 1,
      recommendation: msg.missingJobsRec,
      docs: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobs',
    });
  }

  // ==========================================================================
  // Event Validation (from SchemaStore)
  // ==========================================================================
  
  if (workflow?.on && typeof workflow.on === 'object' && !Array.isArray(workflow.on)) {
    for (const eventName of Object.keys(workflow.on)) {
      if (VALID_EVENTS.length > 0 && !VALID_EVENTS.includes(eventName)) {
        const eventLineIdx = lines.findIndex(l => l.trim().startsWith(`${eventName}:`));
        findings.push({
          ruleId: 'invalid-event',
          severity: 'high',
          category: 'syntax',
          title: msg.invalidEvent,
          message: msg.invalidEventMsg(eventName, VALID_EVENTS),
          line: eventLineIdx >= 0 ? eventLineIdx + 1 : 1,
          column: 1,
          recommendation: msg.invalidEventRec,
          docs: 'https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows',
        });
      }
    }
  }

  // ==========================================================================
  // Permission Validation (from SchemaStore)
  // ==========================================================================
  
  if (workflow?.permissions && typeof workflow.permissions === 'object') {
    for (const [scope, level] of Object.entries(workflow.permissions)) {
      // Validate scope
      if (VALID_PERMISSIONS.length > 0 && !VALID_PERMISSIONS.includes(scope)) {
        const permLineIdx = lines.findIndex(l => l.trim().startsWith(`${scope}:`));
        findings.push({
          ruleId: 'invalid-permission',
          severity: 'high',
          category: 'syntax',
          title: msg.invalidPermission,
          message: msg.invalidPermissionMsg(scope, VALID_PERMISSIONS),
          line: permLineIdx >= 0 ? permLineIdx + 1 : 1,
          column: 1,
          recommendation: msg.invalidPermissionRec,
          docs: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token',
        });
      }
      
      // Validate level
      const validLevels = ['read', 'write', 'none'];
      if (typeof level === 'string' && !validLevels.includes(level)) {
        const permLineIdx = lines.findIndex(l => l.includes(`${scope}:`) && l.includes(level as string));
        findings.push({
          ruleId: 'invalid-permission-level',
          severity: 'medium',
          category: 'syntax',
          title: msg.invalidPermissionLevel,
          message: msg.invalidPermissionLevelMsg(level as string),
          line: permLineIdx >= 0 ? permLineIdx + 1 : 1,
          column: 1,
          recommendation: msg.invalidPermissionLevelRec,
          docs: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token',
        });
      }
    }
  }

  // ==========================================================================
  // Cron Validation
  // ==========================================================================
  
  if (workflow?.on?.schedule && Array.isArray(workflow.on.schedule)) {
    for (const scheduleItem of workflow.on.schedule) {
      if (scheduleItem?.cron) {
        const cronParts = scheduleItem.cron.trim().split(/\s+/);
        // Cron should have 5 parts: minute hour day month weekday
        if (cronParts.length !== 5) {
          const cronLineIdx = lines.findIndex(l => l.includes(scheduleItem.cron));
          findings.push({
            ruleId: 'invalid-cron',
            severity: 'high',
            category: 'syntax',
            title: msg.invalidCron,
            message: msg.invalidCronMsg(scheduleItem.cron),
            line: cronLineIdx >= 0 ? cronLineIdx + 1 : 1,
            column: 1,
            recommendation: msg.invalidCronRec,
            docs: 'https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule',
          });
        }
      }
    }
  }

  // Validate each job has required fields
  if (workflow && workflow.jobs && typeof workflow.jobs === 'object') {
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const jobObj = job as any;
      
      // Find line number for this job
      const jobLineIdx = lines.findIndex(l => l.match(new RegExp(`^\\s*${jobName}:`)));
      const jobLine = jobLineIdx >= 0 ? jobLineIdx + 1 : 1;
      
      // Check for runs-on (unless it uses 'uses' for reusable workflow)
      if (!jobObj?.['runs-on'] && !jobObj?.uses) {
        findings.push({
          ruleId: 'missing-runs-on',
          severity: 'high',
          category: 'syntax',
          title: msg.missingRunsOn,
          message: msg.missingRunsOnMsg(jobName),
          line: jobLine,
          column: 1,
          recommendation: msg.missingRunsOnRec,
          docs: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idruns-on',
        });
      }
      
      // Check for steps (unless it uses 'uses' for reusable workflow)
      if (!jobObj?.steps && !jobObj?.uses) {
        findings.push({
          ruleId: 'missing-steps',
          severity: 'high',
          category: 'syntax',
          title: msg.missingSteps,
          message: msg.missingStepsMsg(jobName),
          line: jobLine,
          column: 1,
          recommendation: msg.missingStepsRec,
          docs: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idsteps',
        });
      }
    }
  }

  // ==========================================================================
  // Line-by-line Security Checks
  // ==========================================================================

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Expression Injection - using data from contexts.json
    if (line.includes('run:') || line.trim().startsWith('echo ')) {
      DANGEROUS_CONTEXTS.forEach((ctx) => {
        if (line.includes(ctx)) {
          findings.push({
            ruleId: 'expression-injection',
            severity: 'critical',
            category: 'security',
            title: msg.expressionInjection,
            message: msg.expressionInjectionMsg(ctx),
            line: lineNum,
            column: line.indexOf(ctx) + 1,
            snippet: line.trim(),
            recommendation: msg.expressionInjectionRec,
            docs: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#understanding-the-risk-of-script-injections',
          });
        }
      });
    }

    // Hardcoded Secrets - using data from secrets.json
    SECRET_PATTERNS.forEach((sp) => {
      if (sp.regex.test(line) && !line.includes('${{ secrets.')) {
        const match = line.match(sp.regex);
        findings.push({
          ruleId: 'hardcoded-secret',
          severity: 'critical',
          category: 'security',
          title: msg.hardcodedSecret,
          message: msg.hardcodedSecretMsg(sp.name),
          line: lineNum,
          column: match ? line.indexOf(match[0]) + 1 : 1,
          snippet: line.trim().replace(sp.regex, '***REDACTED***'),
          recommendation: msg.hardcodedSecretRec,
          docs: 'https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions',
        });
      }
    });

    // Dangerous Triggers
    if (line.includes('pull_request_target')) {
      findings.push({
        ruleId: 'dangerous-trigger',
        severity: 'critical',
        category: 'security',
        title: msg.dangerousTrigger,
        message: msg.dangerousTriggerPRT,
        line: lineNum,
        column: line.indexOf('pull_request_target') + 1,
        snippet: line.trim(),
        recommendation: msg.dangerousTriggerPRTRec,
        docs: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
      });
    }

    if (line.includes('workflow_run')) {
      findings.push({
        ruleId: 'dangerous-trigger',
        severity: 'high',
        category: 'security',
        title: msg.dangerousTrigger,
        message: msg.dangerousTriggerWR,
        line: lineNum,
        column: line.indexOf('workflow_run') + 1,
        snippet: line.trim(),
        recommendation: msg.dangerousTriggerWRRec,
        docs: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
      });
    }

    // Excessive Permissions
    if (line.includes('write-all') || line.match(/permissions:\s*write-all/)) {
      findings.push({
        ruleId: 'excessive-permissions',
        severity: 'high',
        category: 'security',
        title: msg.excessivePermissions,
        message: msg.excessivePermissionsMsg,
        line: lineNum,
        column: 1,
        snippet: line.trim(),
        recommendation: msg.excessivePermissionsRec,
        docs: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token',
      });
    }

    // Unpinned Actions
    const actionMatch = line.match(/uses:\s*([^@\s]+)@(main|master|latest|dev|HEAD)/);
    if (actionMatch) {
      findings.push({
        ruleId: 'unpinned-action',
        severity: 'high',
        category: 'security',
        title: msg.unpinnedAction,
        message: msg.unpinnedActionMsg(actionMatch[1], actionMatch[2]),
        line: lineNum,
        column: line.indexOf('uses:') + 1,
        snippet: line.trim(),
        recommendation: msg.unpinnedActionRec,
        docs: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions',
      });
    }

    // Dangerous Commands
    if (/curl\s+[^|]*\|\s*(ba)?sh/.test(line) || /wget\s+[^|]*\|\s*(ba)?sh/.test(line)) {
      findings.push({
        ruleId: 'dangerous-command',
        severity: 'high',
        category: 'security',
        title: msg.dangerousCommand,
        message: msg.dangerousCommandMsg,
        line: lineNum,
        column: 1,
        snippet: line.trim(),
        recommendation: msg.dangerousCommandRec,
        docs: 'https://www.idontplaydarts.com/2016/04/detecting-curl-pipe-bash-server-side/',
      });
    }

    // Unsafe checkout
    if (line.includes('actions/checkout') && code.includes('pull_request_target')) {
      const refMatch = code.match(/ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/);
      if (refMatch) {
        findings.push({
          ruleId: 'unsafe-checkout',
          severity: 'critical',
          category: 'security',
          title: msg.unsafeCheckout,
          message: msg.unsafeCheckoutMsg,
          line: lineNum,
          column: 1,
          snippet: line.trim(),
          recommendation: msg.unsafeCheckoutRec,
          docs: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
        });
      }
    }

    // Invalid Runner - using data from runners.json
    const runnerMatch = line.match(/runs-on:\s*(\S+)/);
    if (runnerMatch) {
      const runner = runnerMatch[1].replace(/['"]/g, '').split('#')[0].trim();
      if (!runner.includes('${{') && !VALID_RUNNERS.includes(runner) && !runner.includes('matrix.')) {
        findings.push({
          ruleId: 'invalid-runner',
          severity: 'medium',
          category: 'syntax',
          title: msg.invalidRunner,
          message: msg.invalidRunnerMsg(runner),
          line: lineNum,
          column: line.indexOf(runner) + 1,
          snippet: line.trim(),
          recommendation: msg.invalidRunnerRec,
          docs: 'https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners',
        });
      }
    }

    // Invalid YAML keys - only in 'on:' block, not in action inputs (with:)
    // We'll check this in the context-aware section below

  });

  // Context-aware glob pattern validation
  // Only check patterns under branches:, tags:, paths: sections
  let inGlobSection = false;
  let globSectionIndent = 0;
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    const indent = line.search(/\S/);
    
    // Detect glob sections
    if (trimmed.match(/^(branches|branches-ignore|tags|tags-ignore|paths|paths-ignore):$/)) {
      inGlobSection = true;
      globSectionIndent = indent;
      return;
    }
    
    // Exit glob section
    if (inGlobSection && indent <= globSectionIndent && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
      inGlobSection = false;
    }
    
    // Check patterns in glob sections
    if (inGlobSection && trimmed.startsWith('-')) {
      const patternMatch = trimmed.match(/^-\s*['"]?(.+?)['"]?\s*$/);
      if (patternMatch) {
        const pattern = patternMatch[1];
        // Check for regex-like patterns (not valid in globs)
        const invalidChars = pattern.match(/\\[dDwWsS]/g);
        if (invalidChars) {
          findings.push({
            ruleId: 'invalid-glob-pattern',
            severity: 'high',
            category: 'syntax',
            title: msg.invalidGlobPattern,
            message: msg.invalidGlobPatternMsg(invalidChars[0]),
            line: lineNum,
            column: line.indexOf(invalidChars[0]) + 1,
            snippet: trimmed,
            recommendation: msg.invalidGlobPatternRec,
            docs: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet',
          });
        }
      }
    }
  });

  // Action input validation
  // Parse uses: and with: blocks to validate inputs
  let currentAction: string | null = null;
  let currentActionLine = 0;
  let inWithBlock = false;
  let withIndent = 0;
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    const indent = line.search(/\S/);
    
    // Detect uses: action@version
    const usesMatch = trimmed.match(/^-?\s*uses:\s*([^@\s]+)@/);
    if (usesMatch) {
      currentAction = usesMatch[1];
      currentActionLine = lineNum;
      inWithBlock = false;
      return;
    }
    
    // Detect with: block
    if (trimmed === 'with:' && currentAction) {
      inWithBlock = true;
      withIndent = indent;
      return;
    }
    
    // Exit with block if indentation decreases
    if (inWithBlock && indent <= withIndent && trimmed && !trimmed.startsWith('#')) {
      if (!trimmed.startsWith('with:')) {
        inWithBlock = false;
        currentAction = null;
      }
    }
    
    // Validate inputs in with: block
    if (inWithBlock && currentAction && trimmed && !trimmed.startsWith('#')) {
      const inputMatch = trimmed.match(/^([a-zA-Z0-9_-]+):/);
      if (inputMatch) {
        const inputName = inputMatch[1];
        const actionMetadata = ACTIONS[currentAction];
        
        if (actionMetadata) {
          const validInputs = Object.keys(actionMetadata.inputs);
          if (!validInputs.includes(inputName)) {
            findings.push({
              ruleId: 'invalid-action-input',
              severity: 'high',
              category: 'syntax',
              title: msg.invalidActionInput,
              message: msg.invalidActionInputMsg(inputName, currentAction, validInputs),
              line: lineNum,
              column: line.indexOf(inputName) + 1,
              snippet: trimmed,
              recommendation: msg.invalidActionInputRec,
              docs: `https://github.com/${currentAction}`,
            });
          }
        }
      }
    }
  });

  // Context-aware event key validation
  // Parse YAML structure to find invalid keys under event triggers
  let currentEvent: string | null = null;
  let inOnBlock = false;
  let onIndent = 0;
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    const indent = line.search(/\S/);
    
    // Detect 'on:' block
    if (trimmed.startsWith('on:')) {
      inOnBlock = true;
      onIndent = indent;
      return;
    }
    
    // Exit on block if we're at same or lower indent
    if (inOnBlock && indent <= onIndent && trimmed && !trimmed.startsWith('#')) {
      inOnBlock = false;
      currentEvent = null;
    }
    
    if (!inOnBlock) return;
    
    // Detect event name (e.g., "push:", "pull_request:")
    const eventMatch = trimmed.match(/^([a-z_]+):$/);
    if (eventMatch && EVENT_KEYS[eventMatch[1]]) {
      currentEvent = eventMatch[1];
      return;
    }
    
    // Check keys under current event
    if (currentEvent && trimmed) {
      const keyMatch = trimmed.match(/^([a-z_-]+):/);
      if (keyMatch) {
        const key = keyMatch[1];
        const validKeys = EVENT_KEYS[currentEvent] || [];
        
        if (validKeys.length > 0 && !validKeys.includes(key)) {
          findings.push({
            ruleId: 'unknown-event-key',
            severity: 'high',
            category: 'syntax',
            title: msg.unknownEventKey,
            message: msg.unknownEventKeyMsg(key, currentEvent, validKeys),
            line: lineNum,
            column: line.indexOf(key) + 1,
            snippet: trimmed,
            recommendation: msg.unknownEventKeyRec,
            docs: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions',
          });
        }
      }
    }
  });

  // Calculate score
  let score = 100;
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  
  findings.forEach((f) => {
    summary[f.severity]++;
    if (f.severity === 'critical') score -= 25;
    else if (f.severity === 'high') score -= 15;
    else if (f.severity === 'medium') score -= 10;
    else if (f.severity === 'low') score -= 5;
  });
  
  score = Math.max(0, score);
  
  const grade = 
    score >= 90 ? 'A' :
    score >= 80 ? 'B' :
    score >= 70 ? 'C' :
    score >= 60 ? 'D' : 'F';

  return {
    findings,
    summary,
    score,
    grade,
    duration: performance.now() - start,
  };
}

// =============================================================================
// API Route
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { code, locale = 'en' } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const result = lint(code, locale as Locale);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Health Check - shows data sources
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    data: {
      runners: { count: VALID_RUNNERS.length, source: runnersData ? 'data/runners.json' : 'fallback' },
      contexts: { count: DANGEROUS_CONTEXTS.length, source: contextsData ? 'data/contexts.json' : 'fallback' },
      secrets: { count: SECRET_PATTERNS.length, source: secretsData ? 'data/secrets.json' : 'fallback' },
      permissions: { count: VALID_PERMISSIONS.length, source: schemaData ? 'data/schema.json' : 'fallback' },
    },
  });
}
