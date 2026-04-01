# TripSync — Group Expense Manager

## Overview
TripSync is a real-time, collaborative trip planning and expense tracking application. It is engineered to seamlessly manage group adventures by implementing complex state synchronization alongside smart debt settlement algorithms. The application features a highly responsive, modern glassmorphic interface built to visualize travel metrics and financial data interactively.

## Architecture & Technology Stack
*   **Framework**: Next.js 16 (React)
*   **Language**: TypeScript
*   **Database & Auth**: Supabase (PostgreSQL)
*   **Styling**: Tailwind CSS
*   **Data Visualization**: Recharts

## Core Features
*   **Collaborative Sessions**: Real-time update integrations for shared itineraries and multi-user inputs.
*   **Debt Settlement Algorithm**: Computationally resolves "who owes whom" utilizing optimized graph reconciliation to minimize transactions.
*   **Visual Analytics**: Interactive charting and graphs to breakdown expenses by category, user, and timeline safely.
*   **Modern Interface**: Complete custom CSS adhering to a sophisticated dark-mode glassmorphism design system.

## Setup and Installation

### Prerequisites
*   Node.js 18+
*   Supabase Account and Project

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/AbinashBalaraman/multi_trip.git
   cd multi_trip
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (`.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage
Deploy the initialized project locally at `http://localhost:3000`. Authenticate interacting users and initialize a new trip state. Add iterative expenses allowing the internal algorithm to map optimal debt reduction paths continuously.

## License
Provided for portfolio demonstration and educational purposes.