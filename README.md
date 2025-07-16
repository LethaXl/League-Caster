# [League Caster](https://league-caster.vercel.app/)

> **League Caster** is a sophisticated web application built with Next.js that allows football enthusiasts to predict outcomes across Europe's top five leagues (Premier League, La Liga, Bundesliga, Serie A, and Ligue 1). Using real-time data from the official football data API, users can simulate match results, visualize dynamic table updates, and forecast end-of-season standings, making it an essential tool for football analytics and entertainment.

<div align="center">
  <img src="./public/home.png" alt="League Caster Home Page" width="680">
</div>

---

## ✨ Key Features:

- **Multi-League Support:** Forecast matches across the five major European football leagues.
- **Real-time Data:** Automatically fetches current standings and fixtures via the Football Data API.
- **Interactive Predictions:** Intuitive interface for predicting match outcomes with various options.
- **Dynamic Table Updates:** Watch league standings adjust instantly as you submit your predictions.
- **Responsive Design:** Optimized for all devices with a modern, clean UI using Tailwind CSS.
- **High-Performance Caching:** Server-side Redis caching for optimal API efficiency and user experience.

---

## 🛠 Technical Overview:

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router) with React 19 and TypeScript
- **UI/Styling:** [Tailwind CSS 4](https://tailwindcss.com/) for responsive design
- **API Integration:** [Football-Data.org API](https://www.football-data.org/) with Axios
- **Hosting:** Deployed on [Vercel](https://vercel.com/) for optimal Next.js performance
- **Caching:** [Upstash Redis](https://upstash.com/) server-side caching with 10-minute TTL
- **SEO:** Comprehensive optimization with structured data, sitemaps, and meta tags
- **Data Processing:** Real-time standings calculation based on user predictions
- **Scalability:** Handles 50+ concurrent users with intelligent cache management

---

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/league-caster.git
   ```

2. Navigate into the repository directory:
   ```bash
   cd league-caster
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env.local` file with your API key and Redis configuration:
   ```env
   API_KEY='your_football_data_api_key'
   UPSTASH_REDIS_REST_URL='your_upstash_redis_rest_url'
   UPSTASH_REDIS_REST_TOKEN='your_upstash_redis_rest_token'
   ```
   
   You can obtain:
   - API key from [Football-Data.org](https://www.football-data.org/client/register)
   - Redis credentials from [Upstash](https://upstash.com/) (free tier available)

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## ⚽ Usage

1. **Select a League:** Choose from the five major European leagues on the home screen.
2. **View Current Standings:** See the current league table based on real-time data.
3. **Start Forecasting:** Click the "Start Forecasting" button to begin predicting matches.
4. **Make Predictions:**
   - Each match defaults to a draw
   - Select "Home" or "Away" for a team win
   - Use custom scoring for specific score predictions
5. **Submit Predictions:** Click "Submit Predictions" to calculate new standings.
6. **Continue Through Season:** The app progresses through each matchday, allowing you to forecast the entire season.
7. **View Standings:** Toggle between current and predicted standings at any time.

---

## 🌐 Deployment

League Caster is deployed on Vercel. Experience the live application at [https://league-caster.vercel.app/](https://league-caster.vercel.app/).

**Important:** Make sure to add your environment variables (API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) to your Vercel project settings.

---

## 🧠 Advanced Features

- **Server-Side Redis Caching:** Implements intelligent caching with Upstash Redis to minimize API calls and improve response times
- **Cache Management:** 10-minute TTL with automatic cache invalidation and stampede protection
- **Rate Limiting Protection:** The application implements smart request queuing and exponential backoff to handle API rate limits
- **Concurrent User Support:** Efficiently handles multiple users with cache hits serving data in milliseconds
- **Error Recovery:** Multiple fallback mechanisms for handling API failures or timeouts
- **Performance Optimization:** Reduces football-data.org API calls by 95%+ through strategic caching

---

## 📊 Performance & Scalability

### Caching Benefits:
- **API Call Reduction:** 95%+ reduction in football-data.org API calls
- **Response Time:** Cache hits respond in <100ms vs 8-10s for API calls
- **User Capacity:** Supports 50+ concurrent users without rate limiting
- **Cost Efficiency:** Minimizes API usage while maintaining data freshness

### Cache Strategy:
- **TTL:** 10 minutes per league data
- **Key Structure:** `league_{leagueCode}` (e.g., `league_PL`)
- **Automatic Refresh:** Cache refreshes on misses with stampede protection
- **Multi-League Support:** Independent caching per league for optimal performance