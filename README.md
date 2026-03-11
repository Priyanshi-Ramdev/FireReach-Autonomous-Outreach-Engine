# FireReach - Autonomous Outreach Engine

FireReach is an AI-powered autonomous GTM outreach agent that automates the workflow of SDRs by capturing live company signals, analyzing alignment with your Ideal Customer Profile (ICP), and drafting hyper-personalized outreach emails.

🌐 Live Demo

Frontend:
https://firereach-frontend.netlify.app/

Backend API:
https://firereach-autonomous-outreach-engine.onrender.com/docs

## Tech Stack
- **Backend**: FastAPI, LangChain, Groq/Gemini, Serper API, Resend.
- **Frontend**: React, Vite, TailwindCSS, Framer Motion, Lucide React.
- **Architecture**: LangChain Function Calling Agent with 3 custom tools.

## Setup Instructions

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   SERPER_API_KEY=your_serper_api_key_here
   RESEND_API_KEY=your_resend_api_key_here
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend will be available at `http://localhost:8000`.

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend UI will be available at `http://localhost:5173`.

## Deployment

**Backend (Render):**
1. Connect your repository to Render.
2. Create a new Web Service using the `backend` directory.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add the necessary Environment Variables.

**Frontend (Netlify):**
HEAD
1. Connect your repository to Netlify.
2. Set the Root Directory to `frontend`.
3.Set the **Build Command**: 
4. Set the **Publish Directory**:
5. Add the following **Environment Variable** in Netlify:
6. Deploy the project.

Your frontend will be available at your Netlify domain after deployment.


