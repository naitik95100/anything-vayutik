# Nexus - AI-Native Automation Platform 
#The Creator - Naitik Gupta founder of VayuTik, VayuStacks TM and Primestar Co.
#Note: Don't forget to claim 10$ credits to the this app to your new account. 

[![Deploy with Vercel](https://vercel.com/button)](https://v0-nexus99.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Framework: Next.js](https://img.shields.io/badge/Framework-Next.js%2014+-black?logo=next.js)](https://nextjs.org/)
[![Style: Tailwind CSS](https://img.shields.io/badge/Style-Tailwind%20CSS-blue?logo=tailwind-css)](https://tailwindcss.com/)

**Nexus** is an open-source, AI-native automation platform designed for indie hackers, power developers, and small teams. Positioned as a smarter, more flexible alternative to legacy tools like Zapier and IFTTT, Nexus integrates intelligent decision-making directly into simple workflows via its core feature: the **AI-Filter**.

🚀 **Live Demo:** [https://v0-nexus99.vercel.app/](https://v0-nexus99.vercel.app/)

---

## ✨ Features

- **Trigger ➔ AI-Filter ➔ Action Workflow:** Build complex automated tasks that don't just route data, but *understand* it using embedded LLMs (like GPT-4o).
- **Intelligent Decision-Making:** Use natural language instructions to filter data streams (e.g., *"If a post mentions Apple or Google and indicates a strong intent to buy, proceed"*).
- **Developer-First Design:** Built explicitly for tech-savvy teams with native code previews, structured logging, and full observability.
- **Modern UI/UX:** A highly aesthetic and minimal "Orange & White" theme engineered using shadcn/ui and Geist/Inter typography.
- **Responsive & Accessible:** Fully optimized across desktop, tablet, and mobile browsers with native micro-interactions and smooth layout transitions.

---

## 🛠️ Tech Stack

Nexus is engineered using a robust, ultra-fast frontend stack:

- **Framework:** [Next.js](https://nextjs.org/) (App Router architecture)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) (New York style)
- **Icons:** [lucide-react](https://lucide.dev/)
- **Hosting/Deployment:** [Vercel](https://vercel.com/)

---

## 🚀 Getting Started

Follow these steps to set up and run Nexus locally.

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18.x or later recommended)
- npm, yarn, or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/nexus.git](https://github.com/your-username/nexus.git)
   cd nexus

  1. Install dependencies:
    npm install
# or
yarn install
# or
pnpm install

  2.Set up Environment Variables:

  Create a .env.local file in the root directory and add any required tokens (e.g., for AI services or database integrations if applicable):

  NEXT_PUBLIC_APP_URL=http://localhost:3000
# Add your specific API keys below if you are hooking up backend endpoints

  3. Run the development server:

  npm run dev
# or
yarn dev
# or
pnpm dev

  4. Open the application:
     
     Navigate to http://localhost:3000 with your browser to view the application.

     📂 Project Structure

     nexus/
├── app/                  # Next.js App Router (pages, layouts, and routing)
│   ├── layout.tsx        # Global layout configuration & fonts
│   └── page.tsx          # Main high-converting landing page component
├── components/           # Reusable UI component repository
│   ├── ui/               # shadcn/ui components (Buttons, Cards, Dialogs, etc.)
│   ├── navbar.tsx        # Sticky blur-backdrop navigation header
│   └── sections/         # Feature blocks, Hero, Pricing, and FAQs
├── public/               # Static assets (images, logos, etc.)
├── styles/               # Global CSS styles (Tailwind config hooks)
├── tailwind.config.js    # Customized Orange & White color tokens
└── tsconfig.json         # TypeScript configurations

🎨 Theme Customization
The design utilizes a high-contrast theme defined in tailwind.config.js:

Background: White (#FFFFFF)

Foreground: Near Black (#0C0A09)

Primary Accent: Vivid Orange (#F56513)

To change the primary identity to match your own branding, edit the HSL maps inside your root global CSS stylesheet or the Tailwind configuration file.

🤝 Contributing
Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

Fork the Project

Create your Feature Branch (git checkout -b feature/AmazingFeature)

Commit your Changes (git commit -m 'Add some AmazingFeature')

Push to the Branch (git push origin feature/AmazingFeature)

Open a Pull Request

📄 License
Distributed under the MIT License. See LICENSE for more information.
