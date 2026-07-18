# LOI Builder — Free Letter of Intent Generator

A web application designed for generating a comprehensive, non-binding Letter of Intent (LOI) for business and real estate acquisitions. The tool provides a clean, modern interface where you can fill out transaction details and instantly preview the resulting legal document.

Once the form is complete, you can export the document for free in **Word (.docx)**, **PDF**, or **Google Doc** formats.

Built with **Next.js 14 (App Router)**, the application uses `@react-pdf/renderer` for PDF generation, `docx` for Word documents, and a custom HTML builder for Google Doc compatibility. The application is completely stateless, requiring no user accounts or databases.

## Features

- **Live Document Preview**: The document updates in real time as you fill out the form.
- **Multiple Export Formats**: 
  - **Word**: Native `.docx` format.
  - **PDF**: Clean, well-styled PDF documents.
  - **Google Doc**: A specially formatted HTML document that seamlessly opens in Google Docs and Word.
- **Premium Dark UI**: A modern, responsive design using glassmorphism components and a clear progress tracker.
- **Dynamic Content Engine**: Intelligently compiles sections, transaction totals, and conditions based on whether the transaction involves Business Operations, Real Estate, or both.

## Local Setup

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (version 18 or higher recommended) and `npm` installed.

### Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/abhishekmenon84/LOI-Generator.git
   cd loi-generator
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser to view and interact with the application.

## Project Structure

- `app/` — Next.js 14 App Router configuration and API routes (`/api/export`).
- `components/` — React components comprising the UI (`LOIForm`, `LOIPreview`, `Navbar`, `SectionCard`).
- `lib/` — Core business logic:
  - `loiEngine.js`: Parses raw form data into a structured content model used by all exporters.
  - `docxBuilder.js`: Generates the `.docx` file using the `docx` library.
  - `pdfBuilder.jsx`: Generates the `.pdf` file using `@react-pdf/renderer`.
  - `htmlBuilder.js`: Generates the Google Docs compatible HTML output.

## Deploying (Vercel)

This project is optimized for deployment on Vercel:

1. Push your code to a GitHub repository.
2. Import the repository into [Vercel](https://vercel.com/new).
3. Vercel will automatically detect the Next.js framework and configure the build settings.
4. Click **Deploy**. No external databases or API keys are required for the core functionality.

## Legal Disclaimer

This tool generates non-binding letters of intent and is not a substitute for formal legal advice. Please consult a qualified attorney before executing any binding agreements.
