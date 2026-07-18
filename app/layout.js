import "./globals.css";

export const metadata = {
  title: "LOI Builder — Letter of Intent Generator for Business & Real Estate Deals",
  description:
    "Build a professional Letter of Intent for a business and real estate acquisition. Preview free, export a polished Word or PDF document for $1.",
  keywords: "letter of intent, LOI generator, business acquisition, real estate LOI, purchase agreement",
  openGraph: {
    title: "LOI Builder — Professional Letter of Intent Generator",
    description: "Preview free. Export a polished Word or PDF document for $1. No account needed.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#07080f" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
