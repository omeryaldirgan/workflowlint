# WorkflowLint

**Real-time GitHub Actions workflow security scanner**

A powerful linting tool that analyzes your GitHub Actions workflows for security vulnerabilities, syntax errors, and best practice violations — all validated against official GitHub documentation.

![WorkflowLint Screenshot](https://img.shields.io/badge/Score-100%2F100-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## 🎯 What It Does

WorkflowLint scans your GitHub Actions workflow files and detects:

| Category | Examples |
|----------|----------|
| **Security** | Expression injection, hardcoded secrets, dangerous triggers |
| **Syntax** | Invalid YAML, missing required fields, typos |
| **Best Practices** | Unpinned actions, excessive permissions, unsafe checkouts |

## ✨ Features

- **🔍 Real-time Analysis** — Instant feedback as you type
- **📋 Schema Validation** — Validated against [SchemaStore](https://json.schemastore.org/github-workflow.json)
- **🔐 Security Checks** — 22 dangerous context patterns detected
- **📦 Action Validation** — 51 popular actions with input validation
- **🌍 Multi-language** — English & Turkish support
- **🌙 Dark/Light Theme** — GitHub-inspired color scheme
- **📱 Responsive** — Works on desktop and mobile

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/omeryaldirgan/workflowlint.git
cd workflowlint

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 Data Sources

All validation rules are sourced from **official documentation**, not hardcoded:

| Data | Source | Auto-Sync |
|------|--------|-----------|
| Events & Permissions | [SchemaStore](https://json.schemastore.org/github-workflow.json) | ✅ Weekly |
| Runner Labels | [actions/runner-images](https://github.com/actions/runner-images) | ✅ Weekly |
| Dangerous Contexts | [GitHub Security Docs](https://docs.github.com/en/actions/security-guides) | ✅ Weekly |
| Action Inputs | GitHub Repositories | ✅ Weekly |
| Secret Patterns | [detect-secrets](https://github.com/Yelp/detect-secrets), [trufflehog](https://github.com/trufflesecurity/trufflehog) | ✅ Weekly |

### Sync Data Manually

```bash
npm run sync
```

## 🔒 Security Rules

### Critical
- **Expression Injection** — User-controlled inputs in `run:` scripts
- **Hardcoded Secrets** — AWS keys, GitHub tokens, API keys in code
- **Unsafe Checkout** — `pull_request_target` with PR head checkout

### High
- **Dangerous Triggers** — `pull_request_target`, `workflow_run`
- **Unpinned Actions** — Using `@main`, `@master` instead of SHA
- **Excessive Permissions** — `permissions: write-all`
- **Invalid Action Inputs** — Typos like `node_version` vs `node-version`

### Medium
- **Invalid Runner** — Non-existent runner labels
- **Invalid Event Keys** — Typos like `branch:` vs `branches:`
- **Invalid Permissions** — Non-existent permission scopes

## 🏗️ Project Structure

```
workflowlint/
├── app/
│   ├── api/
│   │   ├── lint/route.ts      # Linting API endpoint
│   │   └── fetch-url/route.ts # GitHub URL proxy
│   ├── page.tsx               # Web UI
│   ├── i18n.ts                # Translations
│   └── globals.css            # Styles
├── data/                       # Synced from official sources
│   ├── schema.json            # Events, permissions, eventKeys
│   ├── actions.json           # 51 action metadata
│   ├── runners.json           # 39 valid runner labels
│   ├── contexts.json          # 22 dangerous contexts
│   └── secrets.json           # 16 secret patterns
├── scripts/
│   └── sync-data.ts           # Data synchronization script
└── .github/workflows/
    └── sync-data.yml          # Weekly auto-sync workflow
```

## 🔧 API Usage

### Lint Endpoint

```bash
curl -X POST http://localhost:3000/api/lint \
  -H "Content-Type: application/json" \
  -d '{
    "code": "on:\n  push:\n    branch: main\njobs:\n  test:\n    runs-on: ubuntu-latest",
    "locale": "en"
  }'
```

**Response:**
```json
{
  "findings": [
    {
      "ruleId": "missing-steps",
      "severity": "high",
      "title": "Missing Steps",
      "message": "Job \"test\" requires a \"steps\" section.",
      "line": 5
    }
  ],
  "score": 85,
  "grade": "B"
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [actionlint](https://github.com/rhysd/actionlint) — Inspiration for comprehensive workflow linting
- [SchemaStore](https://www.schemastore.org/) — GitHub Actions JSON Schema
- [GitHub Security Lab](https://securitylab.github.com/) — Security research and best practices

---

**Made with ❤️ for the GitHub Actions community**
