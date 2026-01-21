# Multi Trip 🚀 (The Boys Edition)

A premium, modern expense management and trip planning application built for groups. Manage multiple adventures, track expenses, settle debts, and visualize your trip stats with a stunning, glassmorphic UI.

![Trip Dashboard](https://campacampa.netlify.app/og-image.jpg)

## ✨ key Features

- **🌍 Multi-Trip Support** - Create and switch between multiple trips seamlessly.
- **💰 Expense Tracking** - Log expenses, categorize them, and see who paid.
- **📊 Visual Analytics** - Beautiful interactive charts for spending breakdowns.
- **👥 Member Management** - Track individual contributions and balances.
- **🔄 Real-time Sync** - Powered by Supabase for instant updates across devices.
- **⚖️ Debt Settlement** - Smart algorithms to calculate who owes who.
- **📅 Timeline Builder** - Plan your itinerary with a visual timeline.
- **🎨 Premium UI** - Glassmorphism design, smooth animations, and a "The Boys" themed interface.
- **📱 Responsive** - Works perfectly on mobile and desktop.

## 🚀 Live Demo

*[Link removed for privacy]*

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Radix UI
- **Backend:** Supabase (PostgreSQL + Realtime)
- **State Management:** Zustand (with Persistence)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Hosting:** Netlify

## 📦 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/AbinashBalaraman/multi_trip.git
   cd multi_trip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 🗄️ Database Schema

The app uses a relational schema designed for multi-tenancy (per trip):

- **`trips`**: Stores trip metadata (name, dates).
- **`members`**: Participants linked to a specific `trip_id`.
- **`categories`**: Budget categories linked to a `trip_id`.
- **`expenses`**: Transactions linked to `category_id` and `trip_id`.

## 🤝 Contributing

This is a personal project used for managing our group trips. Feel free to fork it for your own adventures!

## 📄 License

MIT License - build something cool!

---

**Built with ❤️ by [Abinash Balaraman](https://github.com/AbinashBalaraman)**
