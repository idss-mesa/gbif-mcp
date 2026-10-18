# GBIF MCP Server Documentation

This directory contains the source files for the GBIF MCP Server documentation, built with Zensical (Material for MkDocs).

## Building the Documentation

### Prerequisites

- Python 3.8+
- pip package manager

### Setup

Install dependencies:

```bash
pip install -r requirements.txt
```

### Local Development

Serve documentation locally with live reload:

```bash
zensical serve
```

Then open http://localhost:8000 in your browser.

### Build for Production

Build static site:

```bash
zensical build
```

Output will be in the `site/` directory.

## Automatic Deployment

Documentation automatically deploys to GitHub Pages on push to main branch via GitHub Actions workflow (`.github/workflows/docs.yml`).

**Live documentation:** https://[username].github.io/gbif-mcp/

## Documentation Structure

```
docs/
├── index.md                    # Homepage
├── getting-started/            # Installation & setup
│   ├── installation.md
│   ├── quick-start.md
│   ├── configuration.md
│   └── features.md
├── user-guide/                 # Tool guides
│   └── overview.md
├── api-reference/              # API docs
│   └── tools.md
├── examples/                   # Usage examples
│   └── basic-queries.md
├── stylesheets/               # Custom CSS
│   └── extra.css
└── requirements.txt           # Python dependencies
```

## Adding Content

### Create New Page

1. Create markdown file in appropriate directory
2. Add to the `nav` list in `zensical.toml`
3. Test locally with `zensical serve`
4. Commit and push (auto-deploys)

### Style Guide

- Use clear, concise language
- Include code examples for tools
- Use admonitions for tips/warnings
- Test all examples
- Follow existing page structure

## Configuration

Main configuration in `zensical.toml` at project root (Zensical, the successor to Material for MkDocs):
- Site metadata
- Theme settings (Material)
- Navigation structure
- Plugins (search)
- Markdown extensions

## Theme

Using Material for MkDocs with:
- GBIF green color scheme
- Light/dark mode toggle
- Search functionality
- Code syntax highlighting
- Responsive design

## Contributing

When adding documentation:
1. Follow existing structure
2. Test builds locally
3. Check for broken links
4. Use consistent formatting
5. Include practical examples

## Support

- [Zensical Documentation](https://zensical.org/docs/)
- [Zensical Documentation](https://zensical.org/)
