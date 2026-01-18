'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { detectLocale, t, type Locale } from './i18n';

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

// ============================================================================
// Example Workflows
// ============================================================================

const getExamples = (locale: Locale) => ({
  vulnerable: {
    name: t(locale, 'vulnerableWorkflow'),
    description: t(locale, 'vulnerableDesc'),
    status: 'danger' as const,
    code: `name: CI
on:
  push:
    branch: main
  pull_request_target:
    types: [opened]

permissions: write-all

jobs:
  build:
    runs-on: linux-latest
    steps:
      - uses: actions/checkout@main
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      
      - name: Log PR
        run: echo "\${{ github.event.pull_request.title }}"
      
      - name: Install
        run: curl https://install.sh | bash
        env:
          API_KEY: "AKIAIOSFODNN7EXAMPLE"
`,
  },
  secure: {
    name: t(locale, 'secureWorkflow'),
    description: t(locale, 'secureDesc'),
    status: 'success' as const,
    code: `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@b39b52d1213e96004bfcb1c61a8a6fa8ab84f3e8
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
        env:
          CI: true
`,
  },
  deploy: {
    name: t(locale, 'deployWorkflow'),
    description: t(locale, 'deployDesc'),
    status: 'info' as const,
    code: `name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
          aws-region: eu-west-1
      
      - name: Deploy
        run: |
          echo "Deploying to production..."
          aws s3 sync ./dist s3://\${{ secrets.S3_BUCKET }}
`,
  },
  matrix: {
    name: t(locale, 'matrixBuild'),
    description: t(locale, 'matrixDesc'),
    status: 'info' as const,
    code: `name: Matrix CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
    
    runs-on: \${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node \${{ matrix.node }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
      
      - run: npm ci
      - run: npm test
`,
  },
  release: {
    name: t(locale, 'releaseWorkflow'),
    description: t(locale, 'releaseDesc'),
    status: 'info' as const,
    code: `name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Generate changelog
        id: changelog
        uses: orhun/git-cliff-action@v3
        with:
          args: --latest
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          body: \${{ steps.changelog.outputs.content }}
          draft: false
`,
  },
});

export default function Home() {
  const [locale, setLocale] = useState<Locale>('en');
  
  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const EXAMPLES = getExamples(locale);
  const [code, setCode] = useState(EXAMPLES.vulnerable.code);
  const [result, setResult] = useState<LintResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showExamples, setShowExamples] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const syntaxRef = useRef<HTMLDivElement>(null);

  const analyze = useCallback(async (content: string) => {
    if (!content.trim()) {
      setResult(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: content, locale }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => analyze(code), 400);
    return () => clearTimeout(debounceRef.current);
  }, [code, analyze, locale]);

  const toggleExpand = (index: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const goToLine = (lineNum: number) => {
    setHighlightedLine(lineNum);
    if (textareaRef.current) {
      const lines = code.split('\n');
      let pos = 0;
      for (let i = 0; i < lineNum - 1; i++) {
        pos += lines[i].length + 1;
      }
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos + (lines[lineNum - 1]?.length || 0));
      const lineHeight = 24;
      textareaRef.current.scrollTop = (lineNum - 5) * lineHeight;
    }
    setTimeout(() => setHighlightedLine(null), 2000);
  };

  const loadFromUrl = async () => {
    if (!urlInput.trim()) return;
    
    setUrlLoading(true);
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch');
      }
      
      setCode(data.content);
      setShowUrlInput(false);
      setUrlInput('');
    } catch (e) {
      alert(t(locale, 'urlError') + (e instanceof Error ? `\n${e.message}` : ''));
    } finally {
      setUrlLoading(false);
    }
  };

  const errorLines = new Set(result?.findings.map(f => f.line) || []);

  // Sync scroll between textarea, syntax highlight, and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    if (syntaxRef.current) {
      syntaxRef.current.scrollTop = scrollTop;
      syntaxRef.current.scrollLeft = scrollLeft;
    }
  };

  const severityColor = (s: string) => ({
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    info: 'bg-[#6E7681]',
  }[s] || 'bg-[#6E7681]');

  const scoreColor = (s: number) => 
    s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';

  // Theme classes - GitHub Dark colors
  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-[#0D1117]' : 'bg-gray-50';
  const text = isDark ? 'text-[#E6EDF3]' : 'text-gray-900';
  const border = isDark ? 'border-[#3D444D]' : 'border-gray-200';
  const panelBg = isDark ? 'bg-[#151B23]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1C2128]' : 'bg-gray-100';
  const mutedText = isDark ? 'text-[#7D8590]' : 'text-gray-500';
  const lineNumColor = isDark ? 'text-[#6E7681]' : 'text-gray-400';

  return (
    <div className={`min-h-screen flex flex-col ${bg} ${text}`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-4 md:px-6 py-3 border-b ${border} relative`} style={{ zIndex: 100 }}>
        <div className="flex items-center gap-2 md:gap-3">
          <Logo />
          <span className="font-semibold text-base md:text-lg">WorkflowLint</span>
          <span className={`hidden sm:inline text-[10px] ${mutedText} ${isDark ? 'bg-[#21262D]' : 'bg-gray-200'} px-2 py-0.5 rounded font-mono`}>
            v1.0.0
          </span>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Examples Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowExamples(!showExamples); setShowUrlInput(false); }}
              className={`p-2 md:px-3 md:py-1.5 text-sm rounded-lg border ${border} ${isDark ? 'hover:bg-[#21262D]' : 'hover:bg-gray-100'} transition-colors flex items-center gap-1.5`}
              title="Örnekler"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span className="hidden md:inline">{t(locale, 'examples')}</span>
            </button>
          </div>

          {/* URL Input */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowUrlInput(!showUrlInput); setShowExamples(false); }}
              className={`p-2 md:px-3 md:py-1.5 text-sm rounded-lg border ${border} ${isDark ? 'hover:bg-[#21262D]' : 'hover:bg-gray-100'} transition-colors flex items-center gap-1.5`}
              title="URL'den yükle"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="hidden md:inline">{t(locale, 'url')}</span>
            </button>
          </div>


          {/* Language Toggle */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowLangMenu(!showLangMenu); setShowExamples(false); setShowUrlInput(false); }}
              className={`p-2 rounded-lg border ${border} ${isDark ? 'hover:bg-[#21262D]' : 'hover:bg-gray-100'} transition-colors flex items-center gap-1.5`}
              title="Change language"
            >
              <span className="text-base">{locale === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
              <span className="text-xs font-medium hidden sm:inline">{locale === 'tr' ? 'TR' : 'EN'}</span>
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-lg border ${border} ${isDark ? 'hover:bg-[#21262D]' : 'hover:bg-gray-100'} transition-colors`}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Loading indicator */}
          {loading && (
            <div className={`flex items-center gap-2 ${mutedText}`}>
              <div className={`w-3 h-3 border-2 ${isDark ? 'border-[#6E7681]' : 'border-gray-400'} border-t-transparent rounded-full animate-spin`} />
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row relative" style={{ zIndex: 1 }} onClick={() => { setShowExamples(false); setShowUrlInput(false); setShowLangMenu(false); }}>
        {/* Editor Panel */}
        <div className={`flex-1 flex flex-col border-b lg:border-b-0 lg:border-r ${border} min-h-[300px] lg:min-h-0`}>
          <div className={`flex items-center justify-between px-4 py-2 border-b ${border}`}>
            <span className={`text-xs ${mutedText} font-mono`}>workflow.yml</span>
          </div>
          <div className="flex-1 relative overflow-hidden flex">
            {/* Gutter with line numbers */}
            <div 
              ref={lineNumbersRef}
              className={`w-14 shrink-0 ${isDark ? 'bg-[#151B23]/80' : 'bg-gray-100'} border-r ${border} overflow-hidden`}
            >
              <div className="py-4 text-right pr-3 text-[11px] font-mono select-none">
                {code.split('\n').map((_, i) => {
                  const lineNum = i + 1;
                  const hasError = errorLines.has(lineNum);
                  const isHighlighted = highlightedLine === lineNum;
                  const defaultColor = isDark ? 'text-[#7D8590]' : 'text-gray-400';
                  return (
                    <div 
                      key={i} 
                      onClick={() => goToLine(lineNum)}
                      className={`leading-6 transition-all cursor-pointer hover:text-blue-400 ${
                        isHighlighted 
                          ? 'text-yellow-400 font-bold bg-yellow-500/10 -mr-3 pr-3 rounded-l' 
                          : hasError 
                            ? 'text-red-400 font-medium' 
                            : defaultColor
                      }`}
                    >
                      {lineNum}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Editor area */}
            <div className="flex-1 relative">
              {/* Error indicators on the right edge */}
              <div className={`absolute right-2 top-4 bottom-4 w-2 ${isDark ? 'bg-[#21262D]/50' : 'bg-gray-200'} rounded-full overflow-hidden z-20 pointer-events-none`}>
                {code.split('\n').map((_, i) => {
                  const lineNum = i + 1;
                  const hasError = errorLines.has(lineNum);
                  const totalLines = code.split('\n').length;
                  if (!hasError) return null;
                  const severity = result?.findings.find(f => f.line === lineNum)?.severity;
                  const color = severity === 'critical' ? 'bg-red-500' : severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500';
                  return (
                    <div
                      key={i}
                      className={`absolute w-2 h-1 ${color} rounded-full pointer-events-auto cursor-pointer hover:scale-150 transition-transform`}
                      style={{ top: `${(lineNum / totalLines) * 100}%` }}
                      onClick={() => goToLine(lineNum)}
                      title={`Line ${lineNum}`}
                    />
                  );
                })}
              </div>

              {/* Syntax highlighted code (background layer) */}
              <div 
                ref={syntaxRef}
                className="absolute inset-0 overflow-hidden pointer-events-none"
              >
                <div className="py-4 px-4 font-mono text-sm">
                  {code.split('\n').map((line, i) => {
                    const lineNum = i + 1;
                    const hasError = errorLines.has(lineNum);
                    const isHighlighted = highlightedLine === lineNum;
                    
                    return (
                      <div 
                        key={i} 
                        className={`leading-6 whitespace-pre transition-colors rounded-sm ${
                          isHighlighted 
                            ? 'bg-yellow-500/20 border-l-2 border-yellow-500 -ml-1 pl-1' 
                            : hasError 
                              ? isDark ? 'bg-red-500/10 border-l-2 border-red-500 -ml-1 pl-1' : 'bg-red-50 border-l-2 border-red-500 -ml-1 pl-1'
                              : ''
                        }`}
                      >
                        <HighlightedLine line={line} isDark={isDark} />
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Editable textarea */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleScroll}
                className="absolute inset-0 w-full h-full bg-transparent px-4 py-4 font-mono text-sm leading-6 resize-none z-10 text-transparent caret-blue-500 selection:bg-blue-500/30 overflow-auto"
                spellCheck={false}
                onClick={(e) => e.stopPropagation()}
                style={{ caretColor: isDark ? '#60a5fa' : '#2563eb' }}
              />
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className={`w-full lg:w-[440px] flex flex-col ${panelBg} min-h-[250px] lg:min-h-0`}>
          <div className={`flex items-center justify-between px-4 py-2 border-b ${border}`}>
            <span className={`text-xs ${mutedText}`}>{t(locale, 'results')}</span>
            {result && (
              <span className={`text-xs font-mono font-semibold ${scoreColor(result.score)}`}>
                {result.score}/100
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!result || result.findings.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full ${mutedText}`}>
                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{t(locale, 'noIssues')}</span>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {result.findings.map((f, i) => (
                  <div
                    key={i}
                    className={`${cardBg} border ${border} rounded-lg overflow-hidden hover:border-opacity-60 transition-colors`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(i);
                        goToLine(f.line);
                      }}
                      className="w-full p-3 flex items-start gap-3 text-left"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityColor(f.severity)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{f.title}</div>
                        <div className={`text-[11px] ${mutedText} mt-0.5 font-mono`}>
                          L{f.line} · {f.category}
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 ${mutedText} transition-transform shrink-0 ${expanded.has(i) ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {expanded.has(i) && (
                      <div className={`px-3 pb-3 pt-0 border-t ${border}`}>
                        <p className={`text-xs ${isDark ? 'text-[#8B949E]' : 'text-gray-600'} mt-3 leading-relaxed`}>{f.message}</p>
                        
                        {f.snippet && (
                          <pre className={`mt-2 p-2 ${isDark ? 'bg-[#151B23] text-[#C9D1D9]' : 'bg-gray-200 text-gray-800'} rounded text-[11px] font-mono overflow-x-auto`}>
                            {f.snippet}
                          </pre>
                        )}

                        <div className="mt-2 text-xs text-emerald-500">
                          → {f.recommendation}
                        </div>

                        {f.docs && (
                          <a
                            href={f.docs}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-2 text-[11px] text-blue-500 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t(locale, 'documentation')} ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {result && result.findings.length > 0 && (
            <div className={`px-4 py-3 border-t ${border} flex items-center gap-3 text-xs`}>
              {result.summary.critical > 0 && (
                <span className="text-red-500">{result.summary.critical} critical</span>
              )}
              {result.summary.high > 0 && (
                <span className="text-orange-500">{result.summary.high} high</span>
              )}
              {result.summary.medium > 0 && (
                <span className="text-yellow-500">{result.summary.medium} medium</span>
              )}
              {result.summary.low > 0 && (
                <span className="text-blue-500">{result.summary.low} low</span>
              )}
              <span className={`${mutedText} ml-auto`}>{result.duration.toFixed(0)}ms</span>
            </div>
          )}
        </div>
      </main>

      {/* Popover Overlays - Fixed positioning for proper z-index */}
      {showExamples && (
        <div 
          className="fixed inset-0" 
          style={{ zIndex: 9998 }}
          onClick={() => setShowExamples(false)}
        >
          <div 
            className={`fixed top-14 left-4 right-4 md:left-auto md:right-24 md:w-72 ${isDark ? 'bg-[#151B23] border-[#3D444D]' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-4 py-2 text-xs font-medium ${isDark ? 'bg-[#21262D] text-[#8B949E]' : 'bg-gray-100 text-gray-500'} border-b ${border}`}>
              {t(locale, 'selectExample')}
            </div>
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <button
                key={key}
                onClick={() => { setCode(ex.code); setShowExamples(false); }}
                className={`w-full px-4 py-3 text-left ${isDark ? 'hover:bg-[#21262D]' : 'hover:bg-gray-50'} transition-colors border-b ${border} last:border-0 flex items-start gap-3`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  ex.status === 'danger' ? 'bg-red-500' : 
                  ex.status === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{ex.name}</div>
                  <div className={`text-xs ${mutedText} mt-0.5`}>{ex.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showLangMenu && (
        <div 
          className="fixed inset-0" 
          style={{ zIndex: 9998 }}
          onClick={() => setShowLangMenu(false)}
        >
          <div 
            className={`fixed top-14 right-4 md:right-14 w-40 ${isDark ? 'bg-[#151B23] border-[#3D444D]' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setLocale('tr'); setShowLangMenu(false); }}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 ${isDark ? 'hover:bg-[#21262D]' : 'hover:bg-gray-50'} transition-colors border-b ${border} ${locale === 'tr' ? (isDark ? 'bg-[#21262D]' : 'bg-gray-100') : ''}`}
            >
              <span className="text-xl">🇹🇷</span>
              <span className="font-medium">Türkçe</span>
              {locale === 'tr' && <span className="ml-auto text-emerald-500">✓</span>}
            </button>
            <button
              onClick={() => { setLocale('en'); setShowLangMenu(false); }}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 ${isDark ? 'hover:bg-[#21262D]' : 'hover:bg-gray-50'} transition-colors ${locale === 'en' ? (isDark ? 'bg-[#21262D]' : 'bg-gray-100') : ''}`}
            >
              <span className="text-xl">🇬🇧</span>
              <span className="font-medium">English</span>
              {locale === 'en' && <span className="ml-auto text-emerald-500">✓</span>}
            </button>
          </div>
        </div>
      )}

      {showUrlInput && (
        <div 
          className="fixed inset-0" 
          style={{ zIndex: 9998 }}
          onClick={() => setShowUrlInput(false)}
        >
          <div 
            className={`fixed top-14 left-4 right-4 md:left-auto md:right-16 md:w-[420px] ${isDark ? 'bg-[#151B23] border-[#3D444D]' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl p-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`text-sm font-medium mb-3 ${isDark ? 'text-[#E6EDF3]' : 'text-gray-800'}`}>
              {t(locale, 'loadFromUrl')}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t(locale, 'urlPlaceholder')}
                className={`flex-1 px-3 py-2.5 text-sm rounded-lg border ${isDark ? 'bg-[#21262D] border-[#3D444D] text-white placeholder:text-[#7D8590]' : 'bg-gray-50 border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                onKeyDown={(e) => e.key === 'Enter' && loadFromUrl()}
                autoFocus
              />
              <button
                onClick={loadFromUrl}
                disabled={urlLoading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {urlLoading ? '...' : t(locale, 'load')}
              </button>
            </div>
            <p className={`text-[11px] ${mutedText} mt-3`}>
              {t(locale, 'supportedFormats')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 6L8 18L12 10L16 18L20 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21H21" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

// YAML Line Highlighter
function HighlightedLine({ line, isDark }: { line: string; isDark: boolean }) {
  // GitHub syntax colors
  const colors = isDark ? {
    key: 'text-[#79C0FF]',      // Light blue
    string: 'text-[#A5D6FF]',    // Lighter blue
    number: 'text-[#A5D6FF]',    // Lighter blue
    boolean: 'text-[#FF7B72]',   // Red
    comment: 'text-[#8B949E] italic',
    action: 'text-[#7EE787]',    // Green
    variable: 'text-[#FFA657]',  // Orange
    keyword: 'text-[#FF7B72]',   // Red
    default: 'text-[#E6EDF3]',
  } : {
    key: 'text-blue-600',
    string: 'text-blue-800',
    number: 'text-blue-800',
    boolean: 'text-red-600',
    comment: 'text-gray-400 italic',
    action: 'text-green-600',
    variable: 'text-orange-600',
    keyword: 'text-red-600',
    default: 'text-gray-800',
  };

  // Comment
  if (line.trim().startsWith('#')) {
    return <span className={colors.comment}>{line || ' '}</span>;
  }

  const tokens: JSX.Element[] = [];
  let key = 0;

  const patterns: [RegExp, string][] = [
    [/(\$\{\{[^}]+\}\})/, colors.variable],
    [/([a-zA-Z0-9-]+\/[a-zA-Z0-9-]+@[a-zA-Z0-9.-]+)/, colors.action],
    [/("[^"]*"|'[^']*')/, colors.string],
    [/\b(true|false|null|yes|no|on|off)\b/, colors.boolean],
    [/\b(\d+)\b/, colors.number],
    [/\b(name|on|jobs|steps|runs-on|uses|with|env|if|run|needs|permissions|strategy|matrix|secrets|outputs|inputs)\s*:/, colors.keyword],
    [/^(\s*)([a-zA-Z_-]+)(:)/, 'key'],
  ];

  let i = 0;
  while (i < line.length) {
    let matched = false;
    
    for (const [pattern, colorClass] of patterns) {
      const match = line.slice(i).match(pattern);
      if (match && match.index === 0) {
        if (colorClass === 'key') {
          const [, indent, keyName, colon] = match;
          if (indent) tokens.push(<span key={key++}>{indent}</span>);
          tokens.push(<span key={key++} className={colors.key}>{keyName}</span>);
          tokens.push(<span key={key++} className={colors.default}>{colon}</span>);
        } else {
          tokens.push(<span key={key++} className={colorClass}>{match[1] || match[0]}</span>);
        }
        i += match[0].length;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      let nextPatternStart = line.length;
      for (const [pattern] of patterns) {
        const match = line.slice(i).match(pattern);
        if (match && match.index !== undefined && match.index > 0) {
          nextPatternStart = Math.min(nextPatternStart, i + match.index);
        }
      }
      
      const plainText = line.slice(i, nextPatternStart);
      if (plainText) {
        tokens.push(<span key={key++} className={colors.default}>{plainText}</span>);
        i = nextPatternStart;
      } else {
        tokens.push(<span key={key++} className={colors.default}>{line[i]}</span>);
        i++;
      }
    }
  }

  return <>{tokens.length > 0 ? tokens : ' '}</>;
}
