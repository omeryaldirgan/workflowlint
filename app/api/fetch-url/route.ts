import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Convert GitHub URLs to raw
    let rawUrl = url.trim();
    if (rawUrl.includes('github.com') && !rawUrl.includes('raw.githubusercontent.com')) {
      rawUrl = rawUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }

    // Validate URL
    if (!rawUrl.includes('githubusercontent.com') && !rawUrl.includes('github.com')) {
      return NextResponse.json({ error: 'Only GitHub URLs are supported' }, { status: 400 });
    }

    const response = await fetch(rawUrl, {
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'WorkflowLint/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const content = await response.text();

    // Basic validation - should look like YAML
    if (!content.includes(':') || content.includes('<!DOCTYPE')) {
      return NextResponse.json({ error: 'Not a valid YAML file' }, { status: 400 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
