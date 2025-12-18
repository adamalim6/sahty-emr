# Sahty EMR System

Complete hospital Electronic Medical Records (EMR) system with integrated pharmacy module.

## Features

- **Patient Management**: Comprehensive patient records and dossiers
- **Admission Management**: Patient admissions, ward mapping, and bed management
- **Pharmacy Module**: Integrated pharmacy with inventory, prescriptions, and stock management
- **AI Assistant**: Gemini-powered medical assistant
- **Multi-language Support**: French and Arabic interface

## Run Locally

**Prerequisites:** Node.js

### Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the backend server:
   ```bash
   npm run dev
   ```

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Styling**: Custom CSS
- **AI Integration**: Google Gemini API

## License

Proprietary
