import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkflowLint - GitHub Actions Security Scanner',
  description: 'Scan your GitHub Actions workflows for security vulnerabilities and best practices',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0D1117] text-[#E6EDF3] antialiased">
        {children}
      </body>
    </html>
  );
}
