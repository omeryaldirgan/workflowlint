export type Locale = 'tr' | 'en';

export const translations = {
  tr: {
    // Header
    examples: 'Örnekler',
    url: 'URL',
    
    // Examples
    selectExample: 'Örnek Workflow Seç',
    vulnerableWorkflow: 'Vulnerable Workflow',
    vulnerableDesc: 'Birçok güvenlik açığı içeren örnek',
    secureWorkflow: 'Secure Workflow',
    secureDesc: 'Best practice\'lere uygun güvenli örnek',
    deployWorkflow: 'Deploy Workflow',
    deployDesc: 'Production deployment örneği',
    matrixBuild: 'Matrix Build',
    matrixDesc: 'Çoklu platform/versiyon testi',
    releaseWorkflow: 'Release Workflow',
    releaseDesc: 'Otomatik release ve changelog',
    
    // URL Modal
    loadFromUrl: 'GitHub URL\'den Yükle',
    urlPlaceholder: 'Workflow URL yapıştır...',
    load: 'Yükle',
    supportedFormats: 'GitHub repo URL\'si otomatik olarak raw formatına çevrilir.',
    urlError: 'URL yüklenemedi. Geçerli bir GitHub workflow URL\'si girin.',
    
    // Editor
    workflowFile: 'workflow.yml',
    
    // Results
    results: 'Sonuçlar',
    noIssues: 'Sorun bulunamadı',
    analyzing: 'Analiz ediliyor...',
    documentation: 'Dokümantasyon',
    
    // Findings
    expressionInjection: 'Expression Injection',
    expressionInjectionMsg: 'kullanıcı tarafından kontrol edilebilir. Inline script\'lerde doğrudan kullanımı tehlikeli.',
    expressionInjectionRec: 'Değişkeni env: ile environment variable olarak geçirin.',
    
    hardcodedSecret: 'Hardcoded Secret',
    hardcodedSecretMsg: 'tespit edildi. Secret\'ları asla kod içinde tutmayın.',
    hardcodedSecretRec: 'GitHub Secrets kullanın: ${{ secrets.YOUR_SECRET }}',
    
    dangerousTrigger: 'Tehlikeli Trigger',
    dangerousTriggerPRT: 'pull_request_target fork PR\'larında write izinleri ve secret erişimi ile çalışır.',
    dangerousTriggerPRTRec: 'Mümkünse pull_request trigger kullanın. Gerekiyorsa checkout ref dikkatli seçin.',
    dangerousTriggerWR: 'workflow_run fork PR\'larının artifact\'larını işleyebilir.',
    dangerousTriggerWRRec: 'Artifact içeriğini doğrulayın, güvenilmeyen veri çalıştırmayın.',
    
    excessivePermissions: 'Aşırı İzinler',
    excessivePermissionsMsg: 'write-all tüm scope\'lara full write erişimi verir.',
    excessivePermissionsRec: 'Sadece gerekli izinleri açıkça belirtin (contents: read, issues: write vb.).',
    
    unpinnedAction: 'Sabitlenmemiş Action',
    unpinnedActionMsg: 'mutable ref kullanıyor. Supply chain saldırısına açık.',
    unpinnedActionRec: 'Action\'ları tam commit SHA ile sabitleyin.',
    
    dangerousCommand: 'Tehlikeli Komut',
    dangerousCommandMsg: 'HTTP içeriğini doğrudan shell\'e pipe etmek güvensiz kod çalıştırır.',
    dangerousCommandRec: 'Önce dosyayı indirin, checksum doğrulayın, sonra çalıştırın.',
    
    unsafeCheckout: 'Unsafe Checkout',
    unsafeCheckoutMsg: 'pull_request_target ile PR head ref checkout etmek repository yazma yetkisi verir.',
    unsafeCheckoutRec: 'PR kodunu ayrı bir workflow\'da işleyin veya sadece PR numarasını kullanın.',
    
    invalidRunner: 'Geçersiz Runner',
    invalidRunnerMsg: 'geçerli bir GitHub-hosted runner değil.',
    invalidRunnerRec: 'ubuntu-latest, macos-latest veya windows-latest kullanın.',
    
    invalidKey: 'Geçersiz Key',
    invalidKeyMsg: '"branch" yerine "branches" kullanılmalı.',
    invalidKeyRec: 'branch: → branches:',
  },
  en: {
    // Header
    examples: 'Examples',
    url: 'URL',
    
    // Examples
    selectExample: 'Select Example Workflow',
    vulnerableWorkflow: 'Vulnerable Workflow',
    vulnerableDesc: 'Example with multiple security issues',
    secureWorkflow: 'Secure Workflow',
    secureDesc: 'Best practices compliant example',
    deployWorkflow: 'Deploy Workflow',
    deployDesc: 'Production deployment example',
    matrixBuild: 'Matrix Build',
    matrixDesc: 'Multi-platform/version testing',
    releaseWorkflow: 'Release Workflow',
    releaseDesc: 'Automatic release and changelog',
    
    // URL Modal
    loadFromUrl: 'Load from GitHub URL',
    urlPlaceholder: 'Paste workflow URL...',
    load: 'Load',
    supportedFormats: 'GitHub repo URLs are automatically converted to raw format.',
    urlError: 'Failed to load URL. Enter a valid GitHub workflow URL.',
    
    // Editor
    workflowFile: 'workflow.yml',
    
    // Results
    results: 'Results',
    noIssues: 'No issues found',
    analyzing: 'Analyzing...',
    documentation: 'Documentation',
    
    // Findings
    expressionInjection: 'Expression Injection',
    expressionInjectionMsg: 'is user-controllable. Direct use in inline scripts is dangerous.',
    expressionInjectionRec: 'Pass the variable as environment variable using env:',
    
    hardcodedSecret: 'Hardcoded Secret',
    hardcodedSecretMsg: 'detected. Never store secrets in code.',
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
    unpinnedActionMsg: 'uses mutable ref. Vulnerable to supply chain attacks.',
    unpinnedActionRec: 'Pin actions to full commit SHA.',
    
    dangerousCommand: 'Dangerous Command',
    dangerousCommandMsg: 'Piping HTTP content directly to shell executes untrusted code.',
    dangerousCommandRec: 'Download file first, verify checksum, then execute.',
    
    unsafeCheckout: 'Unsafe Checkout',
    unsafeCheckoutMsg: 'Checking out PR head ref with pull_request_target grants repository write access.',
    unsafeCheckoutRec: 'Process PR code in a separate workflow or use only PR number.',
    
    invalidRunner: 'Invalid Runner',
    invalidRunnerMsg: 'is not a valid GitHub-hosted runner.',
    invalidRunnerRec: 'Use ubuntu-latest, macos-latest, or windows-latest.',
    
    invalidKey: 'Invalid Key',
    invalidKeyMsg: 'Use "branches" instead of "branch".',
    invalidKeyRec: 'branch: → branches:',
  },
} as const;

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('tr')) return 'tr';
  return 'en';
}

export function t(locale: Locale, key: keyof typeof translations.en): string {
  return translations[locale][key] || translations.en[key] || key;
}
