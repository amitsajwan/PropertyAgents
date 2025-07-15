# 🏡 RealEstate GenAI Assistant

A LangGraph + FastAPI based assistant that helps real estate agents and builders:

* Generate Facebook page branding and property posts using GenAI
* Post automatically to Facebook Pages with images
* Collects user input via a WebSocket-powered chat interface

---

## 📦 Features

* ✅ Interactive WebSocket chat interface
* ✅ Auto-generates brand identity (names, taglines, about section)
* ✅ AI prompts for logo and cover image generation
* ✅ SEO-optimized property listing posts
* ✅ 3 post variants: Emotional, Luxury, Casual
* ✅ One-click posting to Facebook Page
* ✅ Uses LangGraph for agentic flow orchestration

---

## 🧱 Project Structure

```
real_estate_assistant/
├── main.py                         # FastAPI WebSocket server
├── branding_to_post_graph.py      # LangGraph for branding + post generation
├── post_to_facebook_with_image.py # Uploads image + post to Facebook
├── .env                           # Contains FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN
├── images/
│   └── building.png               # Placeholder image to post
└── requirements.txt               # Dependencies
```

---

## ⚒️ Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/real_estate_assistant.git
cd real_estate_assistant
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Set up your `.env`

```env
FB_PAGE_ID=699986296533656
FB_PAGE_ACCESS_TOKEN=EAAXXXXXXXX... (from me/accounts?access_token=...)
```

### 4. Run the server

```bash
uvicorn main:app --reload
```

### 5. Connect WebSocket

Use a browser frontend or tools like Postman / browser client to connect:

```
ws://localhost:8000/chat
```

Then type `start` to begin the assistant flow.

---

## 🚀 Example Flow

1. Assistant asks branding questions.
2. You reply with branding preferences.
3. Assistant generates:

   * Brand name + tagline
   * Logo and cover image prompts
   * About section
4. You enter property details (location, price, etc.)
5. Assistant generates:

   * Base post + 3 variants
6. You confirm posting to Facebook Page.
7. Assistant posts using image `images/building.png`.

---

## 📸 Facebook Requirements

Ensure your Page has:

* ✅ `pages_manage_posts` & `pages_read_engagement`
* ✅ App has correct permissions and is live
* ✅ You are an admin of the Page

---

## 🧠 Powered by

* [LangGraph](https://github.com/langchain-ai/langgraph)
* [FastAPI](https://fastapi.tiangolo.com/)
* [Groq LLM via LangChain](https://python.langchain.com/docs/integrations/llms/groq)

---

## 📌 TODO

* [ ] Auto-generate and upload logo/cover images
* [ ] Schedule Facebook posts
* [ ] Add Instagram integration
* [ ] Save user projects to database

---

## 🧑‍💻 Author

**Amit Sajwan** — powered by Python, GenAI & LangGraph
