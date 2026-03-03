<div align="center">

# ☁️ CloudVault

**Unlimited cloud storage powered by Telegram's infrastructure**

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss)
![Zustand](https://img.shields.io/badge/Zustand-5-brown?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)



</div>

---

## Overview

CloudVault is a modern web application that turns your Telegram account into a personal cloud drive. Upload, organize, and manage files through a polished dashboard — all stored securely in Telegram's infrastructure, giving you virtually **unlimited storage at no cost**.

---

## Features

### File Management
- **Drag-and-drop uploads** via React Dropzone
- **Folder navigation** with breadcrumb trail
- **Grid & List view** toggle for flexible browsing
- **Multi-select** files with Shift+Click support
- **Search** files by name within any folder
- **Download & delete** files individually or in bulk
- **Image preview** with full-size modal viewer

### Storage Channels
- Use **Saved Messages** as your default personal storage
- **Create private Telegram channels** for organized, categorized storage
- **Switch between channels** in the settings panel
- Track per-channel storage usage and file statistics

### AI Image Analysis
- Powered by **Google Gemini 2.5 Flash**
- Extract text from images (OCR)
- Identify objects and generate detailed descriptions
- Results displayed inline in the details panel

### Authentication
- **Telegram 2FA login** (phone → SMS code → optional password)
- Secure session management via `gram-js` StringSession
- Persistent login with Zustand state

### UI/UX
- Dark Telegram-inspired theme (`#17212B`, `#242F3D`, `#2AABEE`)
- Smooth animations powered by Motion
- Responsive layout with collapsible sidebar and right panel
- Toast notifications for all user actions
- Loading skeletons for a polished async experience

---



### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Souvik65/Cloudvault-Telegram-Storage.git
cd cloudvault

# 2. Install dependencies
npm install

# 3. Configure environment variables (see below)
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Configuration

Create a `.env.local` file in the project root with the following variables:

```env
# Required — Telegram API credentials
# Obtain from https://my.telegram.org/apps
TG_API_ID=your_api_id
TG_API_HASH=your_api_hash

# Optional — Google Gemini API key for AI image analysis
# Obtain from https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key
```

---


---

## How It Works

1. **Login** — Authenticate with your Telegram phone number. CloudVault uses the official Telegram MTProto API via `gram-js`.
2. **Storage channels** — Files are uploaded as messages (with captions containing JSON metadata) to Telegram channels. Your "Saved Messages" is the default channel.
3. **Folder structure** — Folders are simulated via metadata paths stored in message captions — no server required.
4. **AI analysis** — Images can be sent to Gemini for analysis directly from the file preview modal.

---


## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)

---

<div align="center">
  <sub>Built with Next.js and the Telegram MTProto API</sub>
</div>
