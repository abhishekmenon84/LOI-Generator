import "./globals.css";

export const metadata = {
  title: "Ledgerlot — Letter of Intent Generator for Business & Real Estate Deals",
  description:
    "The fastest way to draft a combined business and real estate Letter of Intent. Free, no signup — export a polished Word or PDF.",
  keywords: "letter of intent, LOI generator, business acquisition, real estate LOI, purchase agreement",
  openGraph: {
    title: "Ledgerlot — Professional Letter of Intent Generator",
    description: "The fastest way to draft a combined business and real estate Letter of Intent. Free, no signup.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f8fafc" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('app-theme');
                  if (!theme) { theme = 'light'; }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
